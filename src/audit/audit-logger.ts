/**
 * Auditability & Rollback System
 * Logs every change with before/after JSON, timestamps, and operator ID
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExecutionAction, ExecutionResult } from '../planner/execution-planner';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  operatorId: string;
  sessionId: string;
  integrationId: string;
  action: {
    type: string;
    target: {
      resourceType: string;
      resourceId?: string;
      path?: string;
    };
    before?: any;
    after?: any;
    diff?: any;
  };
  execution: {
    planId: string;
    actionId: string;
    status: 'success' | 'failed' | 'skipped';
    duration: number;
    error?: string;
    retryAttempt: number;
  };
  context: {
    dryRun: boolean;
    batchId?: string;
    environment: string;
    version: string;
    userAgent: string;
  };
  rollback: {
    available: boolean;
    actionId?: string;
  };
}

export interface RestoreBundle {
  id: string;
  createdAt: string;
  operatorId: string;
  sessionId: string;
  description: string;
  integrations: {
    integrationId: string;
    email: string;
    snapshot: {
      before: any;
      after: any;
    };
    actions: ExecutionAction[];
  }[];
  metadata: {
    totalIntegrations: number;
    totalActions: number;
    environment: string;
    version: string;
  };
}

export interface AuditQuery {
  integrationId?: string;
  operatorId?: string;
  sessionId?: string;
  planId?: string;
  actionType?: string;
  status?: string;
  startTime?: string;
  endTime?: string;
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private auditDir: string;
  private restoreDir: string;
  private sessionId: string;
  private operatorId: string;

  constructor(
    auditDir: string = './audit-logs',
    operatorId: string = 'system',
    sessionId?: string
  ) {
    this.auditDir = auditDir;
    this.restoreDir = path.join(auditDir, 'restore-bundles');
    this.operatorId = operatorId;
    this.sessionId = sessionId || this.generateSessionId();
  }

  /**
   * Initialize audit logging
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.auditDir, { recursive: true });
    await fs.mkdir(this.restoreDir, { recursive: true });
    
    console.log(`📋 Audit logging initialized: ${this.auditDir}`);
    console.log(`👤 Operator: ${this.operatorId}`);
    console.log(`🔗 Session: ${this.sessionId}`);
  }



  /**
   * Log a simple action (used by ExecutionEngine)
   */
  async logAction(actionLog: {
    actionId: string;
    integrationId: string;
    actionType: string;
    resourceType: string;
    resourceId?: string;
    payload: any;
    metadata: any;
    timestamp: string;
    status: string;
    error?: string;
  }): Promise<void> {
    const entry: AuditLogEntry = {
      id: this.generateEntryId(),
      timestamp: actionLog.timestamp,
      operatorId: this.operatorId,
      sessionId: this.sessionId,
      integrationId: actionLog.integrationId,
      action: {
        type: actionLog.actionType,
        target: {
          resourceType: actionLog.resourceType,
          resourceId: actionLog.resourceId
        },
        before: actionLog.payload.before,
        after: actionLog.payload.after,
        diff: actionLog.payload.diff
      },
      execution: {
        planId: 'unknown',
        actionId: actionLog.actionId,
        status: actionLog.status as 'success' | 'failed' | 'skipped',
        duration: 0,
        error: actionLog.error,
        retryAttempt: 0
      },
      context: {
        dryRun: actionLog.status === 'dry_run_success',
        environment: process.env['NODE_ENV'] || 'production',
        version: '1.0.0',
        userAgent: 'integration-auditor'
      },
      rollback: {
        available: actionLog.status === 'success' && actionLog.payload.before !== undefined
      }
    };

    const logLine = JSON.stringify(entry) + '\n';
    const logFile = path.join(this.auditDir, `${new Date().toISOString().split('T')[0]}.log`);
    
    await this.appendToFile(logFile, logLine);
  }

  /**
   * Log execution result summary
   */
  async logExecutionResult(result: ExecutionResult, context: any): Promise<void> {
    const summaryEntry = {
      id: this.generateEntryId(),
      timestamp: new Date().toISOString(),
      operatorId: this.operatorId,
      sessionId: this.sessionId,
      type: 'execution_summary',
      planId: result.planId,
      integrationId: result.integrationId,
      result: {
        status: result.status,
        duration: result.duration,
        actions: {
          executed: result.actions.executed.length,
          failed: result.actions.failed.length,
          skipped: result.actions.skipped.length
        }
      },
      context
    };

    const summaryFile = path.join(this.auditDir, 'execution-summaries.jsonl');
    await this.appendToFile(summaryFile, JSON.stringify(summaryEntry) + '\n');
  }

  /**
   * Create restore bundle
   */
  async createRestoreBundle(
    integrations: Array<{
      integrationId: string;
      email: string;
      beforeSnapshot: any;
      afterSnapshot: any;
      actions: ExecutionAction[];
    }>,
    description: string
  ): Promise<string> {
    const bundleId = this.generateBundleId();
    
    const bundle: RestoreBundle = {
      id: bundleId,
      createdAt: new Date().toISOString(),
      operatorId: this.operatorId,
      sessionId: this.sessionId,
      description,
      integrations: integrations.map(integration => ({
        integrationId: integration.integrationId,
        email: integration.email,
        snapshot: {
          before: integration.beforeSnapshot,
          after: integration.afterSnapshot
        },
        actions: integration.actions
      })),
      metadata: {
        totalIntegrations: integrations.length,
        totalActions: integrations.reduce((sum, i) => sum + i.actions.length, 0),
        environment: process.env['NODE_ENV'] || 'development',
        version: '1.0.0'
      }
    };

    const bundleFile = path.join(this.restoreDir, `${bundleId}.json`);
    await fs.writeFile(bundleFile, JSON.stringify(bundle, null, 2));

    console.log(`💾 Restore bundle created: ${bundleId}`);
    console.log(`📁 Location: ${bundleFile}`);
    
    return bundleId;
  }

  /**
   * Query audit logs
   */
  async queryLogs(query: AuditQuery): Promise<AuditLogEntry[]> {
    const results: AuditLogEntry[] = [];
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Determine which log files to search
    const logFiles = await this.getLogFilesToSearch(query);

    let found = 0;
    let skipped = 0;

    for (const logFile of logFiles) {
      try {
        const content = await fs.readFile(logFile, 'utf-8');
        const lines = content.trim().split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line) as AuditLogEntry;
            
            if (this.matchesQuery(entry, query)) {
              if (skipped < offset) {
                skipped++;
                continue;
              }
              
              results.push(entry);
              found++;
              
              if (found >= limit) {
                return results;
              }
            }
          } catch (error) {
            // Skip invalid JSON lines
            continue;
          }
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }

    return results;
  }

  /**
   * Get restore bundle
   */
  async getRestoreBundle(bundleId: string): Promise<RestoreBundle | null> {
    try {
      const bundleFile = path.join(this.restoreDir, `${bundleId}.json`);
      const content = await fs.readFile(bundleFile, 'utf-8');
      return JSON.parse(content) as RestoreBundle;
    } catch (error) {
      return null;
    }
  }

  /**
   * List available restore bundles
   */
  async listRestoreBundles(operatorId?: string): Promise<RestoreBundle[]> {
    try {
      const files = await fs.readdir(this.restoreDir);
      const bundles: RestoreBundle[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const content = await fs.readFile(path.join(this.restoreDir, file), 'utf-8');
            const bundle = JSON.parse(content) as RestoreBundle;
            
            if (!operatorId || bundle.operatorId === operatorId) {
              bundles.push(bundle);
            }
          } catch (error) {
            // Skip invalid bundle files
            continue;
          }
        }
      }

      return bundles.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate rollback actions from audit log
   */
  async generateRollbackActions(
    integrationId: string,
    startTime: string,
    endTime?: string
  ): Promise<ExecutionAction[]> {
    const query: AuditQuery = {
      integrationId,
      startTime,
      endTime: endTime || new Date().toISOString(),
      status: 'success'
    };

    const entries = await this.queryLogs(query);
    const rollbackActions: ExecutionAction[] = [];

    // Reverse chronological order for rollback
    entries.reverse();

    for (const entry of entries) {
      if (entry.rollback.available && entry.action.before !== undefined) {
        rollbackActions.push({
          id: entry.rollback.actionId || this.generateRollbackActionId(entry.id),
          type: this.getRollbackActionType(entry.action.type),
          target: { ...entry.action.target, integrationId: entry.integrationId, resourceType: entry.action.target.resourceType as any },
          payload: {
            before: entry.action.after,
            after: entry.action.before,
            diff: this.invertDiff(entry.action.diff)
          },
          metadata: {
            reason: `Rollback: ${entry.action.type} ${entry.action.target.resourceType}`,
            priority: 1,
            dependencies: [],
            retryable: true,
            rollbackable: false
          }
        });
      }
    }

    return rollbackActions;
  }

  /**
   * Get audit statistics
   */
  async getAuditStatistics(timeRange?: { start: string; end: string }): Promise<{
    totalActions: number;
    actionsByType: Record<string, number>;
    actionsByStatus: Record<string, number>;
    integrationsCovered: number;
    operatorsActive: number;
    averageDuration: number;
    errorRate: number;
  }> {
    const query: AuditQuery = {
      startTime: timeRange?.start,
      endTime: timeRange?.end,
      limit: 10000 // Large limit for statistics
    };

    const entries = await this.queryLogs(query);
    
    const stats = {
      totalActions: entries.length,
      actionsByType: {} as Record<string, number>,
      actionsByStatus: {} as Record<string, number>,
      integrationsCovered: new Set<string>(),
      operatorsActive: new Set<string>(),
      totalDuration: 0,
      errors: 0
    };

    for (const entry of entries) {
      // Count by type
      stats.actionsByType[entry.action.type] = (stats.actionsByType[entry.action.type] || 0) + 1;
      
      // Count by status
      stats.actionsByStatus[entry.execution.status] = (stats.actionsByStatus[entry.execution.status] || 0) + 1;
      
      // Track unique integrations and operators
      stats.integrationsCovered.add(entry.integrationId);
      stats.operatorsActive.add(entry.operatorId);
      
      // Accumulate duration and errors
      stats.totalDuration += entry.execution.duration;
      if (entry.execution.status === 'failed') {
        stats.errors++;
      }
    }

    return {
      totalActions: stats.totalActions,
      actionsByType: stats.actionsByType,
      actionsByStatus: stats.actionsByStatus,
      integrationsCovered: stats.integrationsCovered.size,
      operatorsActive: stats.operatorsActive.size,
      averageDuration: stats.totalActions > 0 ? stats.totalDuration / stats.totalActions : 0,
      errorRate: stats.totalActions > 0 ? stats.errors / stats.totalActions : 0
    };
  }

  /**
   * Helper methods
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEntryId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateBundleId(): string {
    return `restore_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateRollbackActionId(originalEntryId: string): string {
    return `rollback_${originalEntryId}`;
  }

  private getDailyLogFile(): string {
    const today = new Date().toISOString().split('T')[0];
    return path.join(this.auditDir, 'daily', `${today}.jsonl`);
  }

  private async appendToFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.appendFile(filePath, content);
  }

  private async getLogFilesToSearch(query: AuditQuery): Promise<string[]> {
    const files: string[] = [];

    if (query.integrationId) {
      // Search integration-specific log
      const integrationLog = path.join(this.auditDir, 'by-integration', `${query.integrationId}.jsonl`);
      try {
        await fs.access(integrationLog);
        files.push(integrationLog);
      } catch {
        // File doesn't exist, continue
      }
    } else {
      // Search daily logs
      try {
        const dailyDir = path.join(this.auditDir, 'daily');
        const dailyFiles = await fs.readdir(dailyDir);
        files.push(...dailyFiles.map(f => path.join(dailyDir, f)));
      } catch {
        // Directory doesn't exist, continue
      }
    }

    return files;
  }

  private matchesQuery(entry: AuditLogEntry, query: AuditQuery): boolean {
    if (query.integrationId && entry.integrationId !== query.integrationId) return false;
    if (query.operatorId && entry.operatorId !== query.operatorId) return false;
    if (query.sessionId && entry.sessionId !== query.sessionId) return false;
    if (query.planId && entry.execution.planId !== query.planId) return false;
    if (query.actionType && entry.action.type !== query.actionType) return false;
    if (query.status && entry.execution.status !== query.status) return false;
    
    if (query.startTime && entry.timestamp < query.startTime) return false;
    if (query.endTime && entry.timestamp > query.endTime) return false;

    return true;
  }

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

  private invertDiff(diff: any): any {
    if (!diff) return undefined;
    
    // Simple diff inversion - in production, use a proper JSON patch library
    if (diff.op === 'add') {
      return { op: 'remove', path: diff.path };
    } else if (diff.op === 'remove') {
      return { op: 'add', path: diff.path, value: diff.value };
    } else if (diff.op === 'replace') {
      return { op: 'replace', path: diff.path, value: diff.oldValue };
    }
    
    return diff;
  }
}
