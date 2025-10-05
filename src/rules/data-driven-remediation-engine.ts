/**
 * Data-Driven Remediation Engine
 * ALL remediation logic loaded from JSON configuration files
 */

import * as fs from 'fs/promises';
import { CorruptionEvent } from './data-driven-corruption-detector';
import { ExecutionAction } from '../planner/execution-planner';

export interface RemediationConfig {
  actionTemplates: Record<string, any>;
  executionStrategy: any;
  rollbackStrategy: any;
  businessImpactMapping: Record<string, any>;
}

export interface RemediationContext {
  integrationId: string;
  email: string;
  storeCount: number;
  edition: string;
  operatorId?: string;
  dryRun: boolean;
  maxOpsPerIntegration: number;
}

export class DataDrivenRemediationEngine {
  private remediationConfig: RemediationConfig | null = null;
  private businessConfig: any = null;
  private actionIdCounter = 0;

  constructor() {}

  /**
   * Initialize with remediation configuration
   */
  async initialize(
    remediationConfigPath: string = './config/remediation-logic.json',
    businessConfigPath: string = './config/business-rules.json'
  ): Promise<void> {
    // Load remediation configuration
    const remediationContent = await fs.readFile(remediationConfigPath, 'utf-8');
    this.remediationConfig = JSON.parse(remediationContent);
    
    // Load business configuration
    const businessContent = await fs.readFile(businessConfigPath, 'utf-8');
    this.businessConfig = JSON.parse(businessContent);
    
    console.log(`✅ Loaded data-driven remediation configuration`);
  }

  /**
   * Generate remediation actions using configuration-driven logic
   */
  async generateActions(
    corruptionEvents: CorruptionEvent[],
    context: RemediationContext
  ): Promise<{
    integrationId: string;
    actions: ExecutionAction[];
    summary: any;
    businessAnalysis: any;
  }> {
    if (!this.remediationConfig || !this.businessConfig) {
      throw new Error('Remediation config not loaded. Call initialize() first.');
    }

    const actions: ExecutionAction[] = [];
    const actionAnalysis: any[] = [];

    // Process each corruption event using configuration
    for (const corruptionEvent of corruptionEvents) {
      const eventActions = this.generateActionsForEvent(corruptionEvent, context);
      actions.push(...eventActions.actions);
      actionAnalysis.push(eventActions.analysis);
    }

    // Apply business rules for optimization and prioritization
    const optimizedActions = this.optimizeActions(actions, context);

    return {
      integrationId: context.integrationId,
      actions: optimizedActions,
      summary: this.generateActionSummary(optimizedActions),
      businessAnalysis: {
        corruptionAnalysis: actionAnalysis,
        remediationStrategy: this.generateRemediationStrategy(corruptionEvents, context),
        businessImpact: this.assessActionImpact(optimizedActions),
        executionPlan: this.generateExecutionPlan(optimizedActions, context)
      }
    };
  }

  /**
   * Generate actions for a single corruption event using config templates
   */
  private generateActionsForEvent(
    event: CorruptionEvent,
    context: RemediationContext
  ): { actions: ExecutionAction[]; analysis: any } {
    const corruptionType = event.params.corruptionType;
    const template = this.getActionTemplate(corruptionType);
    
    if (!template) {
      return {
        actions: [],
        analysis: { error: `No template found for ${corruptionType}` }
      };
    }

    const actions: ExecutionAction[] = [];
    
    switch (corruptionType) {
      case 'incorrect-import-count':
      case 'incorrect-export-count':
      case 'incorrect-flow-count':
        actions.push(...this.generateResourceCountActions(event, template, context));
        break;
        
      case 'license-edition-mismatch':
        actions.push(this.generateLicensePatchAction(event, template, context));
        break;
        
      case 'missing-properties':
        actions.push(...this.generatePropertyActions(event, template, context));
        break;
        
      case 'offline-connections':
        actions.push(...this.generateConnectionActions(event, template, context));
        break;
        
      case 'stuck-in-update-process':
        actions.push(this.generateUpdateFlagAction(event, template, context));
        break;
    }

    return {
      actions,
      analysis: {
        corruptionType,
        template: template,
        actionsGenerated: actions.length,
        businessReasoning: this.getBusinessReasoning(corruptionType)
      }
    };
  }

  /**
   * Generate resource count adjustment actions using business rules
   * Enhanced to properly handle Missing vs Duplicate resources as per identifyDuplicateResources()
   */
  private generateResourceCountActions(
    event: CorruptionEvent,
    template: any,
    context: RemediationContext
  ): ExecutionAction[] {
    const resourceType = event.params.resourceType;
    const details = event.params.details;
    
    if (!details || details.difference === 0) return [];
    
    const actions: ExecutionAction[] = [];
    const difference = details.difference;
    const isDuplicate = difference > 0;
    const isMissing = difference < 0;
    
    if (isDuplicate) {
      // DUPLICATE RESOURCES: Actual count > expected count
      // Generate multiple delete actions for excess resources
      const excessCount = Math.abs(difference);
      const deleteRule = template.rules.tooMany;
      
      for (let i = 0; i < excessCount; i++) {
        actions.push({
          id: this.generateActionId(),
          type: 'delete',
          target: {
            integrationId: context.integrationId,
            resourceType: resourceType as any,
            resourceId: `excess-${resourceType}-${Date.now()}-${i}`
          },
          payload: {
            before: { count: details.actualCount },
            after: { count: details.expectedTotal },
            diff: {
              resourceIndex: i,
              removalStrategy: deleteRule.strategy || 'remove-oldest',
              issueType: 'DUPLICATE_RESOURCES'
            }
          },
          metadata: {
            reason: `[DUPLICATE] ${deleteRule.reason || 'Remove excess {resourceType}'}`
              .replace('{resourceType}', resourceType)
              .replace('{edition}', details.edition)
              .replace('{excessCount}', excessCount.toString()),
            priority: event.params.priority,
            dependencies: [],
            retryable: true,
            rollbackable: true,
            detectionFunction: 'identifyDuplicateResources()',
            issueType: 'DUPLICATE_RESOURCES'
          } as any
        });
      }
    } else if (isMissing) {
      // MISSING RESOURCES: Actual count < expected count  
      // Generate multiple create actions for missing resources
      const missingCount = Math.abs(difference);
      const createRule = template.rules.tooFew;
      
      for (let i = 0; i < missingCount; i++) {
        actions.push({
          id: this.generateActionId(),
          type: 'create',
          target: {
            integrationId: context.integrationId,
            resourceType: resourceType as any,
            resourceId: `missing-${resourceType}-${Date.now()}-${i}`
          },
          payload: {
            before: { count: details.actualCount },
            after: { count: details.expectedTotal },
            diff: {
              resourceIndex: i,
              creationTemplate: this.getResourceCreationTemplate(resourceType, details.edition),
              issueType: 'MISSING_RESOURCES'
            }
          },
          metadata: {
            reason: `[MISSING] ${createRule.reason || 'Add missing {resourceType}'}`
              .replace('{resourceType}', resourceType)
              .replace('{edition}', details.edition)
              .replace('{missingCount}', missingCount.toString()),
            priority: event.params.priority,
            dependencies: [],
            retryable: true,
            rollbackable: true,
            detectionFunction: 'identifyDuplicateResources()',
            issueType: 'MISSING_RESOURCES'
          } as any
        });
      }
    }
    
    return actions;
  }

  /**
   * Get resource creation template based on edition requirements
   */
  private getResourceCreationTemplate(resourceType: string, edition: string): any {
    const templates: Record<string, any> = {
      'import': {
        externalId: `generated_${resourceType}_${edition}_${Date.now()}`,
        name: `Generated ${resourceType} for ${edition} edition`,
        type: 'import',
        enabled: true
      },
      'export': {
        externalId: `generated_${resourceType}_${edition}_${Date.now()}`,
        name: `Generated ${resourceType} for ${edition} edition`, 
        type: 'export',
        enabled: true
      },
      'flow': {
        name: `generated_${resourceType}_${edition}_${Date.now()}`,
        type: 'flow',
        enabled: true
      }
    };
    
    return templates[resourceType] || {};
  }

  /**
   * Generate license patch action using business rules
   */
  private generateLicensePatchAction(
    event: CorruptionEvent,
    template: any,
    context: RemediationContext
  ): ExecutionAction {
    return {
      id: this.generateActionId(),
      type: 'patch',
      target: {
        integrationId: context.integrationId,
        resourceType: 'setting',
        path: template.targetPath
      },
      payload: {
        before: event.params.details?.connectorEdition,
        after: event.params.details?.licenseEdition,
        diff: {
          op: 'replace',
          path: template.targetPath,
          value: event.params.details?.licenseEdition
        }
      },
      metadata: {
        reason: template.reason
          .replace('{oldValue}', event.params.details?.connectorEdition)
          .replace('{newValue}', event.params.details?.licenseEdition),
        priority: event.params.priority,
        dependencies: [],
        retryable: true,
        rollbackable: true
      } as any
    };
  }

  /**
   * Generate property addition actions using business rules
   */
  private generatePropertyActions(
    event: CorruptionEvent,
    template: any,
    context: RemediationContext
  ): ExecutionAction[] {
    const missingProps = event.params.details?.missingProperties || [];
    const actions: ExecutionAction[] = [];
    
    for (const prop of missingProps) {
      const defaultValue = template.defaultValues[prop] || null;
      
      actions.push({
        id: this.generateActionId(),
        type: 'patch',
        target: {
          integrationId: context.integrationId,
          resourceType: 'setting',
          path: prop
        },
        payload: {
          before: undefined,
          after: defaultValue,
          diff: {
            op: 'add',
            path: prop,
            value: defaultValue
          }
        },
        metadata: {
          reason: template.reason.replace('{propertyPath}', prop),
          priority: event.params.priority,
          dependencies: [],
          retryable: true,
          rollbackable: true
        } as any
      });
    }
    
    return actions;
  }

  /**
   * Generate connection actions using business rules
   */
  private generateConnectionActions(
    event: CorruptionEvent,
    template: any,
    context: RemediationContext
  ): ExecutionAction[] {
    const offlineConnections = event.params.details?.offlineConnections || [];
    const actions: ExecutionAction[] = [];
    
    for (const connection of offlineConnections) {
      actions.push({
        id: this.generateActionId(),
        type: 'reconnect',
        target: {
          integrationId: context.integrationId,
          resourceType: 'connection',
          resourceId: connection.id
        },
        payload: {
          before: { status: 'offline' },
          after: { status: 'online' }
        },
        metadata: {
          reason: template.reason
            .replace('{connectionId}', connection.id)
            .replace('{activeResourcesCount}', event.params.details?.totalAffectedResources),
          priority: event.params.priority,
          dependencies: [],
          retryable: true,
          rollbackable: false
        } as any
      });
    }
    
    return actions;
  }

  /**
   * Generate update flag clearing action
   */
  private generateUpdateFlagAction(
    event: CorruptionEvent,
    template: any,
    context: RemediationContext
  ): ExecutionAction {
    return {
      id: this.generateActionId(),
      type: 'clearUpdateFlag',
      target: {
        integrationId: context.integrationId,
        resourceType: 'setting',
        path: template.targetPath
      },
      payload: {
        before: true,
        after: template.value
      },
      metadata: {
        reason: template.reason,
        priority: event.params.priority,
        dependencies: [],
        retryable: true,
        rollbackable: true
      } as any
    };
  }

  /**
   * Get action template from configuration
   */
  private getActionTemplate(corruptionType: string): any {
    const templates = this.remediationConfig?.actionTemplates;
    
    if (corruptionType.includes('count')) {
      return templates?.['resourceCountAdjustment'];
    } else if (corruptionType.includes('license')) {
      return templates?.['licenseEditionMismatch'];
    } else if (corruptionType.includes('properties')) {
      return templates?.['missingProperties'];
    } else if (corruptionType.includes('offline')) {
      return templates?.['offlineConnections'];
    } else if (corruptionType.includes('update')) {
      return templates?.['stuckUpdateProcess'];
    }
    
    return null;
  }

  /**
   * Optimize actions using business rules
   */
  private optimizeActions(actions: ExecutionAction[], context: RemediationContext): ExecutionAction[] {
    const strategy = this.remediationConfig?.executionStrategy;
    
    // Apply max actions limit
    let optimized = actions.slice(0, context.maxOpsPerIntegration);
    
    // Apply priority-based sorting if enabled
    if (strategy?.priorityExecution?.enabled) {
      optimized = optimized.sort((a, b) => b.metadata.priority - a.metadata.priority);
    }
    
    // Apply safety controls
    const safetyControls = strategy?.safetyControls;
    if (safetyControls?.maxDestructiveActions) {
      const destructiveActions = optimized.filter(a => a.type === 'delete').length;
      if (destructiveActions > safetyControls.maxDestructiveActions) {
        console.warn(`⚠️  Too many destructive actions (${destructiveActions}), limiting to ${safetyControls.maxDestructiveActions}`);
        // Keep only non-destructive actions and limited destructive ones
        const nonDestructive = optimized.filter(a => a.type !== 'delete');
        const destructive = optimized.filter(a => a.type === 'delete').slice(0, safetyControls.maxDestructiveActions);
        optimized = [...nonDestructive, ...destructive];
      }
    }
    
    return optimized;
  }

  /**
   * Generate action summary
   */
  private generateActionSummary(actions: ExecutionAction[]): any {
    const actionsByType = actions.reduce((acc, action) => {
      acc[action.type] = (acc[action.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalActions: actions.length,
      actionsByType,
      estimatedDuration: actions.length * 2000, // 2s per action
      riskLevel: this.calculateRiskLevel(actions),
      businessImpact: this.assessActionImpact(actions)
    };
  }

  /**
   * Generate remediation strategy
   */
  private generateRemediationStrategy(events: CorruptionEvent[], context: RemediationContext): any {
    return {
      approach: 'data-driven-remediation',
      configurationSource: 'config/remediation-logic.json',
      businessRulesSource: 'config/business-rules.json',
      customizable: 'Business users can modify all remediation logic',
      
      eventAnalysis: {
        totalEvents: events.length,
        eventTypes: events.reduce((acc: any, event) => {
          acc[event.params.corruptionType] = (acc[event.params.corruptionType] || 0) + 1;
          return acc;
        }, {}),
        severityDistribution: events.reduce((acc: any, event) => {
          acc[event.params.severity] = (acc[event.params.severity] || 0) + 1;
          return acc;
        }, {})
      },
      
      executionRecommendations: this.generateExecutionRecommendations(events, context)
    };
  }

  /**
   * Generate execution recommendations based on business rules
   */
  private generateExecutionRecommendations(events: CorruptionEvent[], context: RemediationContext): string[] {
    const recommendations: string[] = [];
    const strategy = this.remediationConfig?.executionStrategy;
    
    // Resource count issues
    const resourceIssues = events.filter(e => e.params.corruptionType.includes('count')).length;
    if (resourceIssues > 0) {
      recommendations.push(`Execute ${resourceIssues} resource count adjustments using batch processing (${strategy?.batchProcessing?.defaultBatchSize} per batch)`);
    }
    
    // Configuration issues
    const configIssues = events.filter(e => e.params.corruptionType.includes('properties') || e.params.corruptionType.includes('license')).length;
    if (configIssues > 0) {
      recommendations.push(`Apply ${configIssues} configuration fixes - low risk operations`);
    }
    
    // Operational issues
    const operationalIssues = events.filter(e => e.params.corruptionType.includes('offline') || e.params.corruptionType.includes('update')).length;
    if (operationalIssues > 0) {
      recommendations.push(`PRIORITY: Address ${operationalIssues} operational issues first - blocking system operations`);
    }
    
    // Safety recommendations
    if (strategy?.safetyControls?.requireConfirmationAbove && events.length > strategy.safetyControls.requireConfirmationAbove) {
      recommendations.push(`Large operation detected (${events.length} events) - requires confirmation per business rules`);
    }
    
    return recommendations;
  }

  /**
   * Calculate risk level using business rules
   */
  private calculateRiskLevel(actions: ExecutionAction[]): 'low' | 'medium' | 'high' | 'critical' {
    const destructiveActions = actions.filter(a => a.type === 'delete').length;
    const totalActions = actions.length;
    
    const safetyRules = this.remediationConfig?.executionStrategy?.safetyControls;
    
    if (destructiveActions > (safetyRules?.maxDestructiveActions || 20)) return 'critical';
    if (totalActions > (safetyRules?.requireConfirmationAbove || 50)) return 'high';
    if (destructiveActions > 5) return 'medium';
    return 'low';
  }

  /**
   * Assess business impact of actions
   */
  private assessActionImpact(actions: ExecutionAction[]): any {
    return {
      dataFlowImpact: actions.filter(a => a.type === 'create' || a.type === 'delete').length,
      configurationImpact: actions.filter(a => a.type === 'patch').length,
      operationalImpact: actions.filter(a => a.type === 'reconnect' || a.type === 'clearUpdateFlag').length,
      rollbackComplexity: actions.filter(a => !a.metadata.rollbackable).length
    };
  }

  /**
   * Generate execution plan using business rules
   */
  private generateExecutionPlan(actions: ExecutionAction[], context: RemediationContext): any {
    const strategy = this.remediationConfig?.executionStrategy;
    
    return {
      batchProcessing: strategy?.batchProcessing?.enabled,
      batchSize: strategy?.batchProcessing?.defaultBatchSize,
      priorityExecution: strategy?.priorityExecution?.enabled,
      estimatedTime: `${Math.round(actions.length * 2 / 60)} minutes`,
      confirmationRequired: actions.length > (strategy?.safetyControls?.requireConfirmationAbove || 50),
      rollbackAvailable: actions.every(a => a.metadata.rollbackable)
    };
  }

  /**
   * Get business reasoning for corruption type
   */
  private getBusinessReasoning(corruptionType: string): string {
    const businessMapping = this.remediationConfig?.businessImpactMapping;
    
    if (corruptionType.includes('count')) {
      return businessMapping?.['resourceCountIssues']?.description || 'Resource counts affect integration functionality';
    } else if (corruptionType.includes('license') || corruptionType.includes('properties')) {
      return businessMapping?.['configurationIssues']?.description || 'Configuration issues affect integration behavior';
    } else if (corruptionType.includes('offline') || corruptionType.includes('update')) {
      return businessMapping?.['operationalIssues']?.description || 'Operational issues block integration operations';
    }
    
    return 'Business impact assessment needed';
  }

  /**
   * Generate unique action ID
   */
  private generateActionId(): string {
    return `action_${++this.actionIdCounter}_${Date.now()}`;
  }

  /**
   * Get remediation configuration (for external access)
   */
  getRemediationConfig(): RemediationConfig | null {
    return this.remediationConfig;
  }

  /**
   * Get business configuration (for external access)
   */
  getBusinessConfig(): any {
    return this.businessConfig;
  }

  /**
   * Reload configuration (for runtime updates)
   */
  async reloadConfig(remediationConfigPath?: string, businessConfigPath?: string): Promise<void> {
    if (remediationConfigPath) {
      const content = await fs.readFile(remediationConfigPath, 'utf-8');
      this.remediationConfig = JSON.parse(content);
    }
    
    if (businessConfigPath) {
      const content = await fs.readFile(businessConfigPath, 'utf-8');
      this.businessConfig = JSON.parse(content);
    }
    
    console.log('✅ Configuration reloaded - business logic updated');
  }
}
