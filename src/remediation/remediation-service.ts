/**
 * Enterprise Remediation Service
 * API-driven remediation system suitable for Docker deployment
 * Replaces session-based scripts with standardized service endpoints
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { ExecutionAction } from '../planner/execution-planner';

export interface RemediationJob {
  id: string;
  integrationId: string;
  email: string;
  actions: ExecutionAction[];
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  createdAt: string;
  updatedAt: string;
  operatorId: string;
  environment: string;
  metadata: {
    corruptionTypes: string[];
    totalActions: number;
    estimatedDuration: number;
  };
}

export interface RemediationQueue {
  pending: RemediationJob[];
  processing: RemediationJob[];
  completed: RemediationJob[];
  failed: RemediationJob[];
}

export interface RemediationAPI {
  // Queue Management
  submitJob(job: Omit<RemediationJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<string>;
  getJob(jobId: string): Promise<RemediationJob | null>;
  getQueue(): Promise<RemediationQueue>;
  cancelJob(jobId: string): Promise<boolean>;
  
  // Execution
  executeJob(jobId: string): Promise<{ success: boolean; results: any[] }>;
  executeAction(action: ExecutionAction): Promise<{ success: boolean; result: any }>;
  
  // Monitoring
  getJobStatus(jobId: string): Promise<string>;
  getExecutionStats(): Promise<any>;
  
  // Export and Persistence
  exportRemediationPlan(format?: 'json' | 'csv' | 'api-calls' | 'javascript' | 'json-scripts'): Promise<string>;
  saveRemediationPlan(jobs: RemediationJob[], outputDir?: string): Promise<string>;
}

export class EnterpriseRemediationService implements RemediationAPI {
  private jobQueue: Map<string, RemediationJob> = new Map();
  private executionQueue: string[] = [];
  private processing: Set<string> = new Set();
  private maxConcurrent: number = 10;
  private apiBaseUrl: string = process.env['INTEGRATION_API_URL'] || 'http://localhost:3000/api';
  
  constructor(maxConcurrent: number = 10) {
    this.maxConcurrent = maxConcurrent;
  }

  /**
   * Submit remediation job to queue
   */
  async submitJob(jobData: Omit<RemediationJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const jobId = this.generateJobId();
    const job: RemediationJob = {
      ...jobData,
      id: jobId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.jobQueue.set(jobId, job);
    this.executionQueue.push(jobId);

    console.log(`📋 Remediation job queued: ${jobId} (${job.actions.length} actions)`);
    return jobId;
  }

  /**
   * Get job details
   */
  async getJob(jobId: string): Promise<RemediationJob | null> {
    return this.jobQueue.get(jobId) || null;
  }

  /**
   * Get current queue status
   */
  async getQueue(): Promise<RemediationQueue> {
    const pending: RemediationJob[] = [];
    const processing: RemediationJob[] = [];
    const completed: RemediationJob[] = [];
    const failed: RemediationJob[] = [];

    for (const job of this.jobQueue.values()) {
      switch (job.status) {
        case 'queued': pending.push(job); break;
        case 'processing': processing.push(job); break;
        case 'completed': completed.push(job); break;
        case 'failed': failed.push(job); break;
      }
    }

    return { pending, processing, completed, failed };
  }

  /**
   * Execute remediation job
   */
  async executeJob(jobId: string): Promise<{ success: boolean; results: any[] }> {
    const job = this.jobQueue.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (this.processing.has(jobId)) {
      throw new Error(`Job already processing: ${jobId}`);
    }

    this.processing.add(jobId);
    job.status = 'processing';
    job.updatedAt = new Date().toISOString();

    const results: any[] = [];
    let successCount = 0;
    let failureCount = 0;

    try {
      console.log(`🚀 Executing remediation job: ${jobId} (${job.actions.length} actions)`);

      for (let i = 0; i < job.actions.length; i++) {
        const action = job.actions[i];
        try {
          const result = await this.executeAction(action);
          results.push({ actionId: action.id, success: result.success, result: result.result });
          
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }

          // Progress logging
          if ((i + 1) % 100 === 0) {
            console.log(`   Progress: ${i + 1}/${job.actions.length} (${successCount} success, ${failureCount} failed)`);
          }

        } catch (error) {
          results.push({ actionId: action.id, success: false, error: (error as Error).message });
          failureCount++;
        }
      }

      job.status = failureCount === 0 ? 'completed' : 'failed';
      job.updatedAt = new Date().toISOString();

      console.log(`✅ Job ${jobId} completed: ${successCount} success, ${failureCount} failed`);

      return { success: failureCount === 0, results };

    } catch (error) {
      job.status = 'failed';
      job.updatedAt = new Date().toISOString();
      throw error;
    } finally {
      this.processing.delete(jobId);
    }
  }

  /**
   * Execute single remediation action via API
   */
  async executeAction(action: ExecutionAction): Promise<{ success: boolean; result: any }> {
    const endpoint = this.getAPIEndpoint(action);
    const payload = this.buildAPIPayload(action);

    try {
      // In production, this would make actual API calls
      // For now, simulate API execution
      const result = await this.simulateAPICall(endpoint, action.type, payload);
      
      return { success: true, result };
    } catch (error) {
      console.error(`❌ API call failed for action ${action.id}:`, error);
      return { success: false, result: { error: (error as Error).message } };
    }
  }

  /**
   * Cancel remediation job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.jobQueue.get(jobId);
    if (!job) return false;

    if (job.status === 'processing') {
      // In production, would cancel ongoing operations
      console.log(`⚠️  Cannot cancel job in progress: ${jobId}`);
      return false;
    }

    job.status = 'cancelled';
    job.updatedAt = new Date().toISOString();
    
    // Remove from execution queue
    const queueIndex = this.executionQueue.indexOf(jobId);
    if (queueIndex > -1) {
      this.executionQueue.splice(queueIndex, 1);
    }

    console.log(`❌ Job cancelled: ${jobId}`);
    return true;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<string> {
    const job = this.jobQueue.get(jobId);
    return job?.status || 'not_found';
  }

  /**
   * Get execution statistics
   */
  async getExecutionStats(): Promise<any> {
    const queue = await this.getQueue();
    
    return {
      queueStats: {
        pending: queue.pending.length,
        processing: queue.processing.length,
        completed: queue.completed.length,
        failed: queue.failed.length
      },
      systemStats: {
        maxConcurrent: this.maxConcurrent,
        currentProcessing: this.processing.size,
        totalJobs: this.jobQueue.size
      },
      performance: {
        averageActionsPerJob: Array.from(this.jobQueue.values())
          .reduce((sum, job) => sum + job.actions.length, 0) / this.jobQueue.size || 0,
        recentCompletions: queue.completed
          .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
          .slice(0, 5)
      }
    };
  }

  /**
   * Process queue automatically
   */
  async processQueue(): Promise<void> {
    while (this.executionQueue.length > 0 && this.processing.size < this.maxConcurrent) {
      const jobId = this.executionQueue.shift();
      if (jobId) {
        // Execute job asynchronously
        this.executeJob(jobId).catch(error => {
          console.error(`❌ Job execution failed: ${jobId}`, error);
        });
      }
    }
  }

  /**
   * Export remediation plan for external systems
   */
  async exportRemediationPlan(format: 'json' | 'csv' | 'api-calls' | 'javascript' | 'json-scripts' = 'json'): Promise<string> {
    const queue = await this.getQueue();
    const allJobs = [...queue.pending, ...queue.processing, ...queue.completed];

    switch (format) {
      case 'json':
        return JSON.stringify({
          exportedAt: new Date().toISOString(),
          totalJobs: allJobs.length,
          totalActions: allJobs.reduce((sum, job) => sum + job.actions.length, 0),
          jobs: allJobs
        }, null, 2);

      case 'api-calls':
        return this.generateAPICallScript(allJobs);

      case 'javascript':
        return this.generateJavaScriptModule(allJobs);

      case 'json-scripts':
        return this.generateJSONScripts(allJobs);

      case 'csv':
        return this.generateCSVExport(allJobs);

      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Generate standardized API call script for Docker deployment
   */
  private generateAPICallScript(jobs: RemediationJob[]): string {
    const allActions = jobs.flatMap(job => 
      job.actions.map(action => ({ ...action, jobId: job.id, integrationId: job.integrationId }))
    );

    return `#!/bin/bash
# Enterprise Remediation API Execution Script
# Generated: ${new Date().toISOString()}
# Total Actions: ${allActions.length}
# Suitable for Docker deployment

set -e

API_BASE_URL=\${INTEGRATION_API_URL:-"http://localhost:3000/api"}
AUTH_TOKEN=\${API_AUTH_TOKEN:-""}

echo "🔧 Starting Enterprise Remediation Execution"
echo "============================================="
echo "API Base URL: $API_BASE_URL"
echo "Total Actions: ${allActions.length}"
echo ""

# Function to make API calls
execute_action() {
    local action_type="$1"
    local integration_id="$2"
    local resource_type="$3"
    local resource_id="$4"
    local payload="$5"
    
    curl -X POST "$API_BASE_URL/integrations/$integration_id/remediation" \\
        -H "Content-Type: application/json" \\
        -H "Authorization: Bearer $AUTH_TOKEN" \\
        -d "{
            \\"action\\": \\"$action_type\\",
            \\"resourceType\\": \\"$resource_type\\",
            \\"resourceId\\": \\"$resource_id\\",
            \\"payload\\": $payload
        }" \\
        --fail --silent --show-error
}

${allActions.map((action, index) => {
  const endpoint = this.getAPIEndpoint(action);
  const payload = JSON.stringify(this.buildAPIPayload(action));
  
  return `# Action ${index + 1}: ${action.type} ${action.target.resourceType}
echo "[$((index + 1))] ${action.type} ${action.target.resourceType} for ${action.integrationId}"
execute_action "${action.type}" "${action.integrationId}" "${action.target.resourceType}" "${action.target.resourceId}" '${payload}'
echo "✅ Completed action ${index + 1}"`;
}).join('\n\n')}

echo ""
echo "✅ ALL REMEDIATION ACTIONS COMPLETED"
echo "===================================="
`;
  }

  /**
   * Get API endpoint for action
   */
  private getAPIEndpoint(action: ExecutionAction): string {
    const baseUrl = this.apiBaseUrl;
    const integrationId = action.target.integrationId;
    
    switch (action.type) {
      case 'create':
        return `${baseUrl}/integrations/${integrationId}/${action.target.resourceType}`;
      case 'delete':
        return `${baseUrl}/integrations/${integrationId}/${action.target.resourceType}/${action.target.resourceId}`;
      case 'patch':
        return `${baseUrl}/integrations/${integrationId}/settings`;
      case 'reconnect':
        return `${baseUrl}/integrations/${integrationId}/connections/${action.target.resourceId}/reconnect`;
      case 'clearUpdateFlag':
        return `${baseUrl}/integrations/${integrationId}/update-flag`;
      default:
        return `${baseUrl}/integrations/${integrationId}/actions`;
    }
  }

  /**
   * Build API payload for action
   */
  private buildAPIPayload(action: ExecutionAction): any {
    return {
      type: action.type,
      target: action.target,
      payload: action.payload,
      metadata: action.metadata,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Simulate API call (replace with actual HTTP client in production)
   */
  private async simulateAPICall(endpoint: string, method: string, payload: any): Promise<any> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 100));
    
    // Simulate success/failure (95% success rate)
    if (Math.random() > 0.95) {
      throw new Error('Simulated API failure');
    }
    
    return {
      endpoint,
      method,
      status: 'success',
      timestamp: new Date().toISOString(),
      result: { applied: true }
    };
  }

  /**
   * Generate CSV export
   */
  private generateCSVExport(jobs: RemediationJob[]): string {
    const headers = [
      'JobID', 'IntegrationID', 'Email', 'ActionType', 'ResourceType', 
      'ResourceID', 'Status', 'Priority', 'OperatorID', 'CreatedAt'
    ];
    
    const rows = jobs.flatMap(job =>
      job.actions.map(action => [
        job.id,
        job.integrationId,
        job.email,
        action.type,
        action.target.resourceType,
        action.target.resourceId || '',
        job.status,
        job.priority,
        job.operatorId,
        job.createdAt
      ])
    );

    return [headers, ...rows].map(row => row.join(',')).join('\n');
  }

  /**
   * Generate JavaScript remediation module following srcWork patterns
   */
  private generateJavaScriptModule(jobs: RemediationJob[]): string {
    const allActions = jobs.flatMap(job => 
      job.actions.map(action => ({ ...action, jobId: job.id, integrationId: job.integrationId }))
    );

    const actionsByType = this.groupActionsByType(allActions);
    
    return `'use strict'

/**
 * Enterprise Remediation JavaScript Module
 * Generated: ${new Date().toISOString()}
 * Total Actions: ${allActions.length}
 * 
 * This module follows the unified update handler pattern from srcWork
 * and can be injected into running software with existing dependencies
 */

const { createUpdateHandler } = require('./unifiedUpdateHandler')
const updateConnectorUtil = require('@celigo/abstract-connector').updateConnectorUtil
const installerUtils = require('@celigo/connector-utils').installerUtils
const async = require('async')
const _ = require('lodash')

${Object.entries(actionsByType).map(([type, actions]) => this.generateJavaScriptHandlerForType(type, actions)).join('\n\n')}

/**
 * Master remediation handler that executes all fixes
 */
const masterRemediationHandler = createUpdateHandler({
  operationName: 'masterRemediation',
  requiredFields: [
    'settings.commonresources',
    'settings.sections', 
    'settings.storemap',
    'settings.connectorEdition'
  ],
  operations: [
${Object.keys(actionsByType).map(type => `    {
      type: 'customLogic',
      logic: ${this.getHandlerName(type)}Config.operations[0].logic
    }`).join(',\n')}
  ]
})

/**
 * Individual remediation handlers by corruption type
 */
module.exports = {
  masterRemediationHandler,
${Object.keys(actionsByType).map(type => `  ${this.getHandlerName(type)}: ${this.getHandlerName(type)}Handler`).join(',\n')},
  
  // Export configurations for testing/debugging
  configs: {
${Object.keys(actionsByType).map(type => `    ${this.getHandlerName(type)}Config`).join(',\n')}
  },
  
  // Metadata
  metadata: {
    generatedAt: '${new Date().toISOString()}',
    totalActions: ${allActions.length},
    actionTypes: ${JSON.stringify(Object.keys(actionsByType))},
    totalJobs: ${jobs.length}
  }
}`;
  }

  /**
   * Generate JSON-based scripts configuration
   */
  private generateJSONScripts(jobs: RemediationJob[]): string {
    const allActions = jobs.flatMap(job => 
      job.actions.map(action => ({ ...action, jobId: job.id, integrationId: job.integrationId }))
    );

    const actionsByType = this.groupActionsByType(allActions);
    const scripts: any = {};

    // Generate individual script configurations
    Object.entries(actionsByType).forEach(([type, actions]) => {
      scripts[type] = {
        name: this.getHumanReadableTypeName(type),
        description: `Remediation script for ${type} corruption`,
        actions: actions.map(action => this.convertActionToScriptConfig(action)),
        metadata: {
          actionCount: actions.length,
          estimatedDuration: `${actions.length * 30} seconds`,
          riskLevel: this.getRiskLevel(type),
          rollbackSupported: true
        }
      };
    });

    return JSON.stringify({
      generatedAt: new Date().toISOString(),
      totalScripts: Object.keys(scripts).length,
      totalActions: allActions.length,
      executionOrder: Object.keys(actionsByType),
      scripts: scripts,
      masterScript: {
        name: 'Master Remediation Script',
        description: 'Executes all remediation actions in proper sequence',
        executionOrder: Object.keys(actionsByType),
        totalActions: allActions.length,
        metadata: {
          estimatedDuration: `${allActions.length * 30} seconds`,
          riskLevel: 'high',
          requiresConfirmation: true
        }
      }
    }, null, 2);
  }

  /**
   * Generate JavaScript handler for specific corruption type
   */
  private generateJavaScriptHandlerForType(type: string, actions: any[]): string {
    const handlerName = this.getHandlerName(type);
    const operations = this.convertActionsToOperations(actions);
    
    return `/**
 * Configuration for ${type} remediation
 * Actions: ${actions.length}
 */
const ${handlerName}Config = {
  operationName: '${handlerName}',
  requiredFields: [
    'settings.commonresources',
    'settings.sections', 
    'settings.storemap',
    'settings.connectorEdition'
  ],
  operations: [
${operations.map(op => `    ${JSON.stringify(op, null, 4)}`).join(',\n')}
  ]
}

const ${handlerName}Handler = createUpdateHandler(${handlerName}Config)`;
  }

  /**
   * Convert remediation actions to unified handler operations
   */
  private convertActionsToOperations(actions: any[]): any[] {
    const operations: any[] = [];
    
    // Group actions by type for efficient processing
    const actionsByType = actions.reduce((acc: any, action) => {
      if (!acc[action.type]) acc[action.type] = [];
      acc[action.type].push(action);
      return acc;
    }, {});

    Object.entries(actionsByType).forEach(([actionType, actionList]: [string, any]) => {
      switch (actionType) {
        case 'create':
          operations.push({
            type: 'resourceUpdate',
            resourceType: this.getResourceTypeFromActions(actionList),
            modifications: actionList.map((action: any) => ({
              action: 'merge',
              value: action.payload.after,
              condition: (resource: any) => resource._id === action.target.resourceId
            }))
          });
          break;

        case 'delete':
          operations.push({
            type: 'resourceUpdate', 
            resourceType: this.getResourceTypeFromActions(actionList),
            modifications: actionList.map((action: any) => ({
              action: 'skipUpdate',
              condition: (resource: any) => resource._id === action.target.resourceId
            }))
          });
          break;

        case 'patch':
          operations.push({
            type: 'integrationModification',
            modifications: actionList.map((action: any) => ({
              action: 'set',
              path: action.target.path,
              value: action.payload.after
            }))
          });
          break;

        case 'reconnect':
          operations.push({
            type: 'customLogic',
            logic: function(callback: Function) {
              const integration = (this as any)._integration;
              const integrationId = (this as any)._integrationId;
              
              try {
                // Reconnection logic would go here
                // This is a placeholder for actual connection restoration
                console.log(`Reconnecting connections for integration ${integrationId}`);
                
                callback(null, integration);
              } catch (error) {
                callback(error);
              }
            }
          });
          break;

        case 'clearUpdateFlag':
          operations.push({
            type: 'integrationModification',
            modifications: [{
              action: 'set',
              path: 'updateInProgress',
              value: false
            }]
          });
          break;

        default:
          operations.push({
            type: 'customLogic',
            logic: function(callback: Function) {
              const integration = (this as any)._integration;
              
              console.log(`Executing custom action: ${actionType}`);
              
              // Custom action logic would be implemented here
              callback(null, integration);
            }
          });
      }
    });

    return operations;
  }

  /**
   * Group actions by corruption type
   */
  private groupActionsByType(actions: any[]): Record<string, any[]> {
    return actions.reduce((acc: Record<string, any[]>, action) => {
      const type = action.metadata?.corruptionType || 'unknown';
      if (!acc[type]) acc[type] = [];
      acc[type].push(action);
      return acc;
    }, {});
  }

  /**
   * Convert action to script configuration
   */
  private convertActionToScriptConfig(action: any): any {
    return {
      id: action.id,
      type: action.type,
      target: action.target,
      payload: action.payload,
      integrationId: action.integrationId,
      metadata: {
        description: this.getActionDescription(action),
        riskLevel: this.getActionRiskLevel(action),
        rollbackData: action.rollback || null,
        estimatedDuration: '30 seconds'
      }
    };
  }

  /**
   * Get handler name from corruption type
   */
  private getHandlerName(type: string): string {
    return type.replace(/-/g, '').replace(/([A-Z])/g, (match, p1) => p1.toLowerCase()) + 'Remediation';
  }

  /**
   * Get human readable type name
   */
  private getHumanReadableTypeName(type: string): string {
    return type.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ') + ' Remediation';
  }

  /**
   * Get resource type from actions
   */
  private getResourceTypeFromActions(actions: any[]): string {
    return actions[0]?.target?.resourceType || 'imports';
  }

  /**
   * Get risk level for corruption type
   */
  private getRiskLevel(type: string): 'low' | 'medium' | 'high' {
    const highRiskTypes = ['stuck-in-update-process', 'offline-connections'];
    const mediumRiskTypes = ['incorrect-import-count', 'incorrect-export-count'];
    
    if (highRiskTypes.includes(type)) return 'high';
    if (mediumRiskTypes.includes(type)) return 'medium';
    return 'low';
  }

  /**
   * Get action description
   */
  private getActionDescription(action: any): string {
    const { type, target } = action;
    switch (type) {
      case 'create': return `Create ${target.resourceType} resource`;
      case 'delete': return `Delete ${target.resourceType} resource`;
      case 'patch': return `Update ${target.path} setting`;
      case 'reconnect': return `Reconnect ${target.resourceId} connection`;
      case 'clearUpdateFlag': return 'Clear update in progress flag';
      default: return `Execute ${type} action`;
    }
  }

  /**
   * Get action risk level
   */
  private getActionRiskLevel(action: any): 'low' | 'medium' | 'high' {
    const { type } = action;
    switch (type) {
      case 'delete': return 'high';
      case 'patch': return 'medium';
      case 'reconnect': return 'medium';
      default: return 'low';
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save remediation plan to standard location
   */
  async saveRemediationPlan(
    jobs: RemediationJob[], 
    outputDir: string = './remediation-plans'
  ): Promise<string> {
    await fs.mkdir(outputDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const planFile = path.join(outputDir, `remediation-plan-${timestamp}.json`);
    
    const plan = {
      generatedAt: new Date().toISOString(),
      totalJobs: jobs.length,
      totalActions: jobs.reduce((sum, job) => sum + job.actions.length, 0),
      apiScript: await this.exportRemediationPlan('api-calls'),
      jobs: jobs
    };

    await fs.writeFile(planFile, JSON.stringify(plan, null, 2));
    
    // Also save the API script separately
    const scriptFile = path.join(outputDir, `execute-remediation-${timestamp}.sh`);
    await fs.writeFile(scriptFile, plan.apiScript);
    await fs.chmod(scriptFile, 0o755);
    
    console.log(`💾 Remediation plan saved: ${planFile}`);
    console.log(`🔧 API execution script: ${scriptFile}`);
    
    return planFile;
  }
}
