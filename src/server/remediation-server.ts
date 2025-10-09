/**
 * Persistent Remediation Server
 * Always-running service that accepts remediation plans via API
 * No redeployment needed - just submit new plans to running service
 */

import express from 'express';
import { EnterpriseRemediationService, RemediationJob } from '../remediation/remediation-service';
import { StateManager } from '../state/state-manager';
import { createAPIRouter } from '../api/routes';
import { openApiSpec } from '../api/openapi-spec';
import swaggerUi from 'swagger-ui-express';
import * as fs from 'fs/promises';

export class RemediationServer {
  private app: express.Application;
  private remediationService: EnterpriseRemediationService;
  private stateManager: StateManager;
  private port: number;

  constructor(port: number = 3000) {
    this.app = express();
    this.remediationService = new EnterpriseRemediationService();
    this.stateManager = new StateManager('./state/remediation-queue.db');
    this.port = port;
    
    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS for development
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
      next();
    });
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Note: Health check is now handled by API router

    // API equivalent of --help
    this.app.get('/api/help', (req, res) => {
      res.json({
        tool: 'integration-auditor',
        version: '1.0.0',
        description: 'Enterprise-grade data-driven CSV integration auditor',
        commands: {
          fix: {
            description: 'Fix integration corruptions using data-driven business rules',
            options: {
              '--edition': 'Target edition (starter, standard, premium, shopifymarkets)',
              '--version': 'Configuration version to use (default: 1.51.0)',
              '--dry-run': 'Preview changes without applying',
              '--apply': 'Execute the remediation plan',
              '--allowlist': 'Specific integration IDs to process (comma-separated)',
              '--allowlist-accounts': 'Account emails to process (comma-separated)',
              '--max-ops-per-integration': 'Operations limit per integration (default: 100)',
              '--max-concurrent': 'Concurrent integration limit (default: 50)',
              '--rate-limit': 'API requests per second (default: 10)',
              '--batch-size': 'Batch size for processing (default: 20)',
              '--operator-id': 'Operator identifier for audit logs',
              '--force-confirmation': 'Skip confirmation prompts',
              '--create-restore-bundle': 'Create backup before execution',
              '--maintenance-window': 'Only run during maintenance window'
            },
            examples: [
              'integration-auditor fix --edition premium --dry-run',
              'integration-auditor fix --edition standard --apply',
              'integration-auditor fix --edition premium --allowlist int1,int2 --apply'
            ]
          },
          status: {
            description: 'Show system status and configuration',
            examples: ['integration-auditor status']
          },
          state: {
            description: 'Manage persistent processing state',
            options: {
              '--show': 'Show current processing state statistics',
              '--cleanup': 'Clean up old state records',
              '--export': 'Export state to backup file',
              '--import': 'Import state from backup file',
              '--reset': 'Reset all processing state'
            },
            examples: [
              'integration-auditor state --show',
              'integration-auditor state --cleanup'
            ]
          }
        },
        apiEndpoints: {
          '/api/help': 'GET - This help information',
          '/api/commands': 'GET - Available CLI commands',
          '/api/run': 'POST - Execute CLI commands via API',
          '/api/remediation/plans': 'POST - Submit remediation plan',
          '/api/remediation/queue': 'GET - View remediation queue',
          '/api/remediation/stats': 'GET - Execution statistics',
          '/health': 'GET - Health check'
        }
      });
    });

    // API equivalent of CLI commands
    this.app.get('/api/commands', (req, res) => {
      res.json({
        availableCommands: [
          'fix', 'audit', 'status', 'state', 'config', 
          'products', 'business-rules'
        ],
        usage: 'POST /api/run with {"command": "fix", "options": {...}}',
        examples: [
          {
            command: 'fix',
            options: { edition: 'premium', dryRun: true },
            description: 'Preview premium edition fixes'
          },
          {
            command: 'status',
            options: {},
            description: 'Get system status'
          },
          {
            command: 'state',
            options: { show: true },
            description: 'Show processing state'
          }
        ]
      });
    });

    // Execute CLI commands via API
    this.app.post('/api/run', async (req, res) => {
      try {
        const { command, options = {} } = req.body;
        
        if (!command) {
          return res.status(400).json({ error: 'Command is required' });
        }

        const result = await this.executeCLICommand(command, options);
        return res.json(result);
      } catch (error) {
        console.error('❌ CLI command execution failed:', error);
        return res.status(500).json({ 
          error: 'Command execution failed',
          details: (error as Error).message 
        });
      }
    });

    // Submit new remediation plan (KEY ENDPOINT)
    this.app.post('/api/remediation/plans', async (req, res) => {
      try {
        const { sessionId, actions, jobs, metadata } = req.body;
        const planId = `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const jobIds: string[] = [];
        
        // Handle both formats: direct actions or jobs array
        const jobsToProcess = jobs || [{ 
          integrationId: sessionId || 'unknown',
          email: 'api-user@example.com',
          actions: actions || [],
          priority: 5,
          operatorId: 'api-user',
          environment: 'production',
          metadata: metadata || {}
        }];
        
        // Submit all jobs from the plan
        for (const job of jobsToProcess) {
          const jobId = await this.remediationService.submitJob({
            integrationId: job.integrationId,
            email: job.email,
            actions: job.actions,
            status: 'queued',
            priority: job.priority || 5,
            operatorId: job.operatorId,
            environment: job.environment || 'production',
            metadata: job.metadata
          });
          jobIds.push(jobId);
        }

        console.log(`📋 New remediation plan submitted: ${planId} (${jobIds.length} jobs)`);
        
        res.json({
          planId,
          jobIds,
          totalJobs: jobIds.length,
          totalActions: jobsToProcess.reduce((sum: number, job: any) => sum + (job.actions?.length || 0), 0),
          status: 'queued',
          submittedAt: new Date().toISOString()
        });
      } catch (error) {
        console.error('❌ Error submitting remediation plan:', error);
        res.status(500).json({ error: 'Failed to submit remediation plan' });
      }
    });

    // Get queue status
    this.app.get('/api/remediation/queue', async (req, res) => {
      try {
        const queue = await this.remediationService.getQueue();
        res.json(queue);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get queue status' });
      }
    });

    // Get execution statistics
    this.app.get('/api/remediation/stats', async (req, res) => {
      try {
        const stats = await this.remediationService.getExecutionStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get statistics' });
      }
    });

    // Get specific job
    this.app.get('/api/remediation/jobs/:jobId', async (req, res) => {
      try {
        const job = await this.remediationService.getJob(req.params.jobId);
        if (job) {
          res.json(job);
        } else {
          res.status(404).json({ error: 'Job not found' });
        }
      } catch (error) {
        res.status(500).json({ error: 'Failed to get job' });
      }
    });

    // Execute specific job
    this.app.post('/api/remediation/jobs/:jobId/execute', async (req, res) => {
      try {
        const result = await this.remediationService.executeJob(req.params.jobId);
        res.json(result);
      } catch (error) {
        console.error(`❌ Job execution failed: ${req.params.jobId}`, error);
        res.status(500).json({ error: 'Job execution failed' });
      }
    });

    // Cancel job
    this.app.delete('/api/remediation/jobs/:jobId', async (req, res) => {
      try {
        const cancelled = await this.remediationService.cancelJob(req.params.jobId);
        res.json({ cancelled, jobId: req.params.jobId });
      } catch (error) {
        res.status(500).json({ error: 'Failed to cancel job' });
      }
    });

    // Process queue (trigger execution)
    this.app.post('/api/remediation/process', async (req, res) => {
      try {
        await this.remediationService.processQueue();
        res.json({ message: 'Queue processing started' });
      } catch (error) {
        res.status(500).json({ error: 'Failed to process queue' });
      }
    });

    // Swagger API Documentation
    this.app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
      explorer: true,
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Integration Auditor API Documentation'
    }));

    // API specification endpoint
    this.app.get('/api/openapi.json', (req, res) => {
      res.json(openApiSpec);
    });

    // Mount API routes using enterprise pattern
    const apiRouter = createAPIRouter(this.stateManager);
    this.app.use('/', apiRouter);

    // Get processing state (fallback if not handled by API router)
    this.app.get('/api/state/processing', async (req, res) => {
      try {
        const stats = await this.stateManager.getProcessingStats();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get state' });
      }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    await this.stateManager.initialize();
    
    this.app.listen(this.port, () => {
      console.log(`🚀 Remediation Server running on port ${this.port}`);
      console.log(`📋 API Documentation: http://localhost:${this.port}/api/docs`);
      console.log(`🔍 Health Check: http://localhost:${this.port}/health`);
      console.log('');
      console.log('📡 KEY ENDPOINTS:');
      console.log(`   POST /api/remediation/plans     # Submit new remediation plan`);
      console.log(`   GET  /api/remediation/queue     # View queue status`);
      console.log(`   GET  /api/remediation/stats     # Execution statistics`);
      console.log(`   POST /api/remediation/process   # Trigger queue processing`);
    });
  }

  /**
   * Execute CLI command via API
   */
  private async executeCLICommand(command: string, options: any): Promise<any> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      // Build CLI arguments
      const args = [command];
      
      // Convert options to CLI flags
      for (const [key, value] of Object.entries(options)) {
        if (typeof value === 'boolean' && value) {
          args.push(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
        } else if (value !== undefined && value !== null && value !== false) {
          args.push(`--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
          args.push(String(value));
        }
      }

      console.log(`🔧 Executing CLI command: integration-auditor ${args.join(' ')}`);

      const child = spawn('node', ['dist/cli-data-driven.js', ...args], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: any) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: any) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        if (code === 0) {
          resolve({
            success: true,
            command: `integration-auditor ${args.join(' ')}`,
            output: stdout,
            executedAt: new Date().toISOString()
          });
        } else {
          reject(new Error(`Command failed with exit code ${code}: ${stderr}`));
        }
      });

      child.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    await this.stateManager.close();
    console.log('🛑 Remediation Server stopped');
  }
}

// Server entry point
if (require.main === module) {
  const server = new RemediationServer(parseInt(process.env['PORT'] || '3000'));
  
  server.start().catch(error => {
    console.error('❌ Failed to start remediation server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('📡 Received SIGTERM, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('📡 Received SIGINT, shutting down gracefully...');
    await server.stop();
    process.exit(0);
  });
}
