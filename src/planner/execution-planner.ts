/**
 * Idempotent Execution Planner
 * Computes precise action plans and executes them safely
 */

import { IntegrationSnapshot, AuditResult } from '../types';

export interface ExecutionAction {
  id: string;
  type: 'create' | 'delete' | 'patch' | 'reconnect' | 'clearUpdateFlag';
  target: {
    integrationId: string;
    resourceType: 'import' | 'export' | 'flow' | 'connection' | 'setting';
    resourceId?: string;
    path?: string;
  };
  payload: {
    before?: any;
    after?: any;
    diff?: any;
  };
  metadata: {
    reason: string;
    priority: number;
    dependencies: string[];
    retryable: boolean;
    rollbackable: boolean;
  };
}

export interface ExecutionPlan {
  integrationId: string;
  email: string;
  planId: string;
  createdAt: string;
  actions: ExecutionAction[];
  summary: {
    totalActions: number;
    actionsByType: Record<string, number>;
    estimatedDuration: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
  };
  safety: {
    requiresConfirmation: boolean;
    maxRetries: number;
    rollbackPlan?: ExecutionAction[];
  };
}

export interface ExecutionOptions {
  dryRun: boolean;
  maxOpsPerIntegration: number;
  rateLimit: {
    actionsPerSecond: number;
    burstLimit: number;
  };
  retries: {
    maxAttempts: number;
    backoffMultiplier: number;
    maxDelay: number;
  };
  safety: {
    requireConfirmation: boolean;
    allowDestructive: boolean;
    maintenanceWindow?: {
      start: string;
      end: string;
      timezone: string;
    };
  };
}

export interface ExecutionResult {
  planId: string;
  integrationId: string;
  status: 'success' | 'partial' | 'failed' | 'cancelled';
  startTime: string;
  endTime: string;
  duration: number;
  actions: {
    executed: ExecutionAction[];
    failed: { action: ExecutionAction; error: string }[];
    skipped: { action: ExecutionAction; reason: string }[];
  };
  rollback?: {
    available: boolean;
    actions: ExecutionAction[];
  };
}

export class ExecutionPlanner {
  private actionIdCounter = 0;

  /**
   * Create execution plan from audit result
   */
  createExecutionPlan(
    integration: IntegrationSnapshot,
    auditResult: AuditResult,
    _businessConfig: any = {},
    options: Partial<ExecutionOptions> = {}
  ): ExecutionPlan {
    const planId = this.generatePlanId();
    const actions: ExecutionAction[] = [];

    // Generate actions for missing resources
    actions.push(...this.createResourceActions(integration, auditResult, _businessConfig));

    // Generate actions for duplicate resources
    actions.push(...this.createDeduplicationActions(integration, auditResult));

    // Generate actions for offline connections
    actions.push(...this.createConnectionActions(integration, auditResult));

    // Generate actions for missing settings
    actions.push(...this.createSettingsActions(integration, auditResult, _businessConfig));

    // Generate actions for clearing update flags
    actions.push(...this.createMaintenanceActions(integration, auditResult));

    // Sort actions by priority and dependencies
    const sortedActions = this.sortActionsByPriority(actions);

    // Apply limits
    const limitedActions = this.applyActionLimits(sortedActions, options.maxOpsPerIntegration || 100);

    // Calculate risk level and safety measures
    const riskLevel = this.calculateRiskLevel(limitedActions);
    const rollbackPlan = this.generateRollbackPlan(limitedActions);

    return {
      integrationId: integration.id,
      email: integration.email,
      planId,
      createdAt: new Date().toISOString(),
      actions: limitedActions,
      summary: {
        totalActions: limitedActions.length,
        actionsByType: this.countActionsByType(limitedActions),
        estimatedDuration: this.estimateDuration(limitedActions),
        riskLevel
      },
      safety: {
        requiresConfirmation: riskLevel === 'high' || riskLevel === 'critical',
        maxRetries: 3,
        rollbackPlan
      }
    };
  }

  /**
   * Execute plan with idempotent semantics
   */
  async executePlan(
    plan: ExecutionPlan,
    executor: ExecutionEngine,
    options: ExecutionOptions
  ): Promise<ExecutionResult> {
    const startTime = new Date().toISOString();
    const result: ExecutionResult = {
      planId: plan.planId,
      integrationId: plan.integrationId,
      status: 'success',
      startTime,
      endTime: '',
      duration: 0,
      actions: {
        executed: [],
        failed: [],
        skipped: []
      }
    };

    try {
      // Pre-flight checks
      await this.performPreflightChecks(plan, options);

      // Execute actions in order
      for (const action of plan.actions) {
        try {
          // Check if we're in maintenance window
          if (options.safety.maintenanceWindow && !this.isInMaintenanceWindow(options.safety.maintenanceWindow)) {
            result.actions.skipped.push({
              action,
              reason: 'Outside maintenance window'
            });
            continue;
          }

          // Execute action with retries
          const executed = await this.executeActionWithRetries(action, executor, options);
          result.actions.executed.push(executed);

          // Rate limiting
          await this.applyRateLimit(options.rateLimit);

        } catch (error) {
          result.actions.failed.push({
            action,
            error: (error as Error).message
          });

          // Stop on critical failures
          if (action.metadata.priority >= 9) {
            result.status = 'failed';
            break;
          }
        }
      }

      // Determine final status
      if (result.actions.failed.length > 0) {
        result.status = result.actions.executed.length > 0 ? 'partial' : 'failed';
      }

      // Generate rollback if needed
      if (result.status === 'failed' && plan.safety.rollbackPlan) {
        result.rollback = {
          available: true,
          actions: plan.safety.rollbackPlan
        };
      }

    } catch (error) {
      result.status = 'failed';
      console.error(`Plan execution failed: ${(error as Error).message}`);
    }

    const endTime = new Date().toISOString();
    result.endTime = endTime;
    result.duration = new Date(endTime).getTime() - new Date(startTime).getTime();

    return result;
  }

  /**
   * Create actions for missing resources
   */
  private createResourceActions(
    integration: IntegrationSnapshot,
    auditResult: AuditResult,
    _businessConfig: any
  ): ExecutionAction[] {
    const actions: ExecutionAction[] = [];

    // Missing imports
    for (const missing of auditResult.issues.importsCheck.missing) {
      actions.push({
        id: this.generateActionId(),
        type: 'create',
        target: {
          integrationId: integration.id,
          resourceType: 'import',
          resourceId: missing
        },
        payload: {
          after: this.getResourceTemplate(missing, 'import', _businessConfig)
        },
        metadata: {
          reason: `Missing required import: ${missing}`,
          priority: 7,
          dependencies: [],
          retryable: true,
          rollbackable: true
        }
      });
    }

    // Missing exports
    for (const missing of auditResult.issues.exportsCheck.missing) {
      actions.push({
        id: this.generateActionId(),
        type: 'create',
        target: {
          integrationId: integration.id,
          resourceType: 'export',
          resourceId: missing
        },
        payload: {
          after: this.getResourceTemplate(missing, 'export', _businessConfig)
        },
        metadata: {
          reason: `Missing required export: ${missing}`,
          priority: 7,
          dependencies: [],
          retryable: true,
          rollbackable: true
        }
      });
    }

    // Missing flows
    for (const missing of auditResult.issues.flowsCheck.missing) {
      actions.push({
        id: this.generateActionId(),
        type: 'create',
        target: {
          integrationId: integration.id,
          resourceType: 'flow',
          resourceId: missing
        },
        payload: {
          after: this.getResourceTemplate(missing, 'flow', _businessConfig)
        },
        metadata: {
          reason: `Missing required flow: ${missing}`,
          priority: 8,
          dependencies: [],
          retryable: true,
          rollbackable: true
        }
      });
    }

    return actions;
  }

  /**
   * Create actions for duplicate resources
   */
  private createDeduplicationActions(
    integration: IntegrationSnapshot,
    auditResult: AuditResult
  ): ExecutionAction[] {
    const actions: ExecutionAction[] = [];

    // Duplicate imports
    for (const duplicate of auditResult.issues.importsCheck.duplicate) {
      actions.push({
        id: this.generateActionId(),
        type: 'delete',
        target: {
          integrationId: integration.id,
          resourceType: 'import',
          resourceId: (duplicate as any)._id || duplicate
        },
        payload: {
          before: duplicate
        },
        metadata: {
          reason: `Remove duplicate import: ${(duplicate as any).name || duplicate}`,
          priority: 5,
          dependencies: [],
          retryable: true,
          rollbackable: true
        }
      });
    }

    // Similar for exports and flows...

    return actions;
  }

  /**
   * Create actions for offline connections
   */
  private createConnectionActions(
    integration: IntegrationSnapshot,
    auditResult: AuditResult
  ): ExecutionAction[] {
    const actions: ExecutionAction[] = [];

    for (const connection of auditResult.issues.offlineConnections) {
      actions.push({
        id: this.generateActionId(),
        type: 'reconnect',
        target: {
          integrationId: integration.id,
          resourceType: 'connection',
          resourceId: (connection as any)._id || (connection as any).id || connection
        },
        payload: {
          before: { status: 'offline' },
          after: { status: 'active' }
        },
        metadata: {
          reason: `Reconnect offline connection: ${(connection as any)._id || (connection as any).id || connection}`,
          priority: 6,
          dependencies: [],
          retryable: true,
          rollbackable: false
        }
      });
    }

    return actions;
  }

  /**
   * Create actions for missing settings
   */
  private createSettingsActions(
    integration: IntegrationSnapshot,
    auditResult: AuditResult,
    _businessConfig: any
  ): ExecutionAction[] {
    const actions: ExecutionAction[] = [];

    for (const setting of auditResult.issues.missingSettings) {
      const settingPath = (setting as any).path || `${(setting as any).section}.${(setting as any).keys?.[0]}`;
      const defaultValue = (setting as any).defaultValue || true;
      
      actions.push({
        id: this.generateActionId(),
        type: 'patch',
        target: {
          integrationId: integration.id,
          resourceType: 'setting',
          path: settingPath
        },
        payload: {
          before: undefined,
          after: defaultValue,
          diff: { op: 'add', path: settingPath, value: defaultValue }
        },
        metadata: {
          reason: `Add missing setting: ${settingPath}`,
          priority: 4,
          dependencies: [],
          retryable: true,
          rollbackable: true
        }
      });
    }

    return actions;
  }

  /**
   * Create maintenance actions
   */
  private createMaintenanceActions(
    integration: IntegrationSnapshot,
    auditResult: AuditResult
  ): ExecutionAction[] {
    const actions: ExecutionAction[] = [];

    if (auditResult.issues.updateInProgress) {
      actions.push({
        id: this.generateActionId(),
        type: 'clearUpdateFlag',
        target: {
          integrationId: integration.id,
          resourceType: 'setting',
          path: 'system.updateInProgress'
        },
        payload: {
          before: true,
          after: false
        },
        metadata: {
          reason: 'Clear stuck update flag',
          priority: 3,
          dependencies: [],
          retryable: true,
          rollbackable: true
        }
      });
    }

    return actions;
  }

  /**
   * Sort actions by priority and dependencies
   */
  private sortActionsByPriority(actions: ExecutionAction[]): ExecutionAction[] {
    // Topological sort considering dependencies
    const sorted: ExecutionAction[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (action: ExecutionAction) => {
      if (visiting.has(action.id)) {
        throw new Error(`Circular dependency detected: ${action.id}`);
      }
      if (visited.has(action.id)) return;

      visiting.add(action.id);

      // Visit dependencies first
      for (const depId of action.metadata.dependencies) {
        const dep = actions.find(a => a.id === depId);
        if (dep) visit(dep);
      }

      visiting.delete(action.id);
      visited.add(action.id);
      sorted.push(action);
    };

    // Sort by priority first, then apply topological sort
    const prioritySorted = [...actions].sort((a, b) => b.metadata.priority - a.metadata.priority);
    
    for (const action of prioritySorted) {
      visit(action);
    }

    return sorted;
  }

  /**
   * Apply action limits
   */
  private applyActionLimits(actions: ExecutionAction[], maxActions: number): ExecutionAction[] {
    if (actions.length <= maxActions) return actions;

    // Keep highest priority actions
    return actions
      .sort((a, b) => b.metadata.priority - a.metadata.priority)
      .slice(0, maxActions);
  }

  /**
   * Calculate risk level
   */
  private calculateRiskLevel(actions: ExecutionAction[]): 'low' | 'medium' | 'high' | 'critical' {
    const destructiveActions = actions.filter(a => a.type === 'delete').length;
    const totalActions = actions.length;
    const highPriorityActions = actions.filter(a => a.metadata.priority >= 8).length;

    if (destructiveActions > 10 || highPriorityActions > 20) return 'critical';
    if (destructiveActions > 5 || totalActions > 50) return 'high';
    if (destructiveActions > 0 || totalActions > 20) return 'medium';
    return 'low';
  }

  /**
   * Generate rollback plan
   */
  private generateRollbackPlan(actions: ExecutionAction[]): ExecutionAction[] {
    return actions
      .filter(a => a.metadata.rollbackable)
      .reverse()
      .map(action => ({
        ...action,
        id: this.generateActionId(),
        type: this.getRollbackActionType(action.type),
        payload: {
          before: action.payload.after,
          after: action.payload.before
        },
        metadata: {
          ...action.metadata,
          reason: `Rollback: ${action.metadata.reason}`,
          priority: 1
        }
      }));
  }

  /**
   * Get rollback action type
   */
  private getRollbackActionType(actionType: string): ExecutionAction['type'] {
    const rollbackMap: Record<string, ExecutionAction['type']> = {
      'create': 'delete',
      'delete': 'create',
      'patch': 'patch',
      'reconnect': 'reconnect',
      'clearUpdateFlag': 'patch'
    };
    return rollbackMap[actionType] || 'patch';
  }

  /**
   * Execute action with retries
   */
  private async executeActionWithRetries(
    action: ExecutionAction,
    executor: ExecutionEngine,
    options: ExecutionOptions
  ): Promise<ExecutionAction> {
    let lastError: Error;

    for (let attempt = 1; attempt <= options.retries.maxAttempts; attempt++) {
      try {
        if (options.dryRun) {
          console.log(`🔍 [DRY RUN] Would execute: ${action.type} ${action.target.resourceType} ${action.target.resourceId || action.target.path}`);
          return action;
        }

        await executor.executeAction(action);
        return action;

      } catch (error) {
        lastError = error as Error;

        if (attempt < options.retries.maxAttempts && action.metadata.retryable) {
          const delay = Math.min(
            1000 * Math.pow(options.retries.backoffMultiplier, attempt - 1),
            options.retries.maxDelay
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError!;
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(rateLimit: ExecutionOptions['rateLimit']): Promise<void> {
    const delay = 1000 / rateLimit.actionsPerSecond;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if current time is in maintenance window
   */
  private isInMaintenanceWindow(window: NonNullable<ExecutionOptions['safety']['maintenanceWindow']>): boolean {
    // Simple implementation - in production, use proper timezone handling
    const now = new Date();
    const start = new Date(`${now.toDateString()} ${window.start}`);
    const end = new Date(`${now.toDateString()} ${window.end}`);
    
    return now >= start && now <= end;
  }

  /**
   * Perform pre-flight checks
   */
  private async performPreflightChecks(plan: ExecutionPlan, options: ExecutionOptions): Promise<void> {
    // Check maintenance window
    if (options.safety.maintenanceWindow && !this.isInMaintenanceWindow(options.safety.maintenanceWindow)) {
      throw new Error('Execution outside maintenance window');
    }

    // Check confirmation requirement
    if (plan.safety.requiresConfirmation && !options.safety.requireConfirmation) {
      throw new Error('Plan requires confirmation but none provided');
    }

    // Check destructive operations
    const destructiveActions = plan.actions.filter(a => a.type === 'delete');
    if (destructiveActions.length > 0 && !options.safety.allowDestructive) {
      throw new Error('Plan contains destructive operations but they are not allowed');
    }
  }

  /**
   * Helper methods
   */
  private generatePlanId(): string {
    return `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateActionId(): string {
    return `action_${++this.actionIdCounter}_${Date.now()}`;
  }

  private countActionsByType(actions: ExecutionAction[]): Record<string, number> {
    return actions.reduce((counts, action) => {
      counts[action.type] = (counts[action.type] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  private estimateDuration(actions: ExecutionAction[]): number {
    // Estimate based on action types and complexity
    const baseDurations = {
      create: 2000,
      delete: 1000,
      patch: 1500,
      reconnect: 3000,
      clearUpdateFlag: 500
    };

    return actions.reduce((total, action) => {
      return total + (baseDurations[action.type] || 1000);
    }, 0);
  }

  private getResourceTemplate(resourceId: string, type: string, businessConfig: any): any {
    // Generate basic template for resource creation
    return {
      id: resourceId,
      name: resourceId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: type,
      configuration: {}
    };
  }
}

/**
 * Execution engine interface
 */
export interface ExecutionEngine {
  executeAction(action: ExecutionAction): Promise<void>;
}
