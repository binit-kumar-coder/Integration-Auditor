/**
 * CLI Routes
 * Direct CLI command execution via API
 * Provides complete CLI functionality through REST endpoints
 */

import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const cliRoutes = Router();

/**
 * @swagger
 * /api/cli/execute:
 *   post:
 *     tags: [CLI]
 *     summary: Execute CLI Command
 *     description: Execute any Integration Auditor CLI command via API
 */
cliRoutes.post('/execute', async (req: Request, res: Response) => {
  try {
    const { command, options = {}, operatorId = 'api-user' } = req.body;
    
    if (!command) {
      return res.status(400).json({
        error: 'Command is required',
        availableCommands: ['fix', 'audit', 'status', 'state', 'config', 'products', 'business-rules']
      });
    }

    // Build CLI command string
    let cliCommand = `integration-auditor ${command}`;
    
    // Add options
    for (const [key, value] of Object.entries(options)) {
      if (typeof value === 'boolean' && value) {
        cliCommand += ` --${key}`;
      } else if (value !== undefined && value !== null && value !== '') {
        cliCommand += ` --${key} "${value}"`;
      }
    }

    console.log(`🔧 Executing CLI command via API: ${cliCommand}`);
    console.log(`👤 Operator: ${operatorId}`);

    // Execute command with timeout
    const { stdout, stderr } = await execAsync(cliCommand, {
      timeout: 300000, // 5 minutes timeout
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });

    return res.json({
      status: 'success',
      command: cliCommand,
      output: {
        stdout: stdout.trim(),
        stderr: stderr.trim()
      },
      executedBy: operatorId,
      executedAt: new Date().toISOString()
    });

  } catch (error: any) {
    return res.status(500).json({
      error: 'CLI command execution failed',
      command: req.body.command,
      details: error.message,
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/cli/commands:
 *   get:
 *     tags: [CLI]
 *     summary: List Available Commands
 *     description: Get list of all available CLI commands with their options
 */
cliRoutes.get('/commands', (req: Request, res: Response) => {
  res.json({
    status: 'success',
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
          '--maintenance-window': 'Only run during maintenance window',
          '--tier': 'Tier to process (tier1, tier2, tier3)',
          '--input': 'Input directory containing CSV files',
          '--config': 'Business rules configuration directory',
          '--output': 'Output directory for results',
          '--force-reprocess': 'Force reprocessing of all integrations',
          '--max-age': 'Maximum age in hours before reprocessing'
        },
        examples: [
          'integration-auditor fix --edition premium --dry-run',
          'integration-auditor fix --edition standard --apply',
          'integration-auditor fix --edition premium --allowlist int1,int2 --apply'
        ]
      },
      audit: {
        description: 'Audit integrations using data-driven business rules',
        options: {
          '--tier': 'Tier to process (tier1, tier2, tier3)',
          '--input': 'Input directory containing CSV files',
          '--config': 'Business rules configuration directory',
          '--product': 'Product to validate (shopify-netsuite, shopify-hubspot)',
          '--version': 'Configuration version to use',
          '--output': 'Output directory for results'
        },
        examples: [
          'integration-auditor audit --tier tier1',
          'integration-auditor audit --tier tier1 --product shopify-netsuite'
        ]
      },
      status: {
        description: 'Show system status and configuration',
        options: {},
        examples: ['integration-auditor status']
      },
      state: {
        description: 'Manage persistent processing state',
        options: {
          '--show': 'Show current processing state statistics',
          '--cleanup': 'Clean up old state records (older than 30 days)',
          '--export': 'Export state to backup file',
          '--import': 'Import state from backup file',
          '--reset': 'Reset all processing state (DANGEROUS)',
          '--operator': 'Filter by operator ID'
        },
        examples: [
          'integration-auditor state --show',
          'integration-auditor state --cleanup',
          'integration-auditor state --export backup.json'
        ]
      },
      config: {
        description: 'Manage business configuration',
        options: {
          '--show': 'Show current business configuration',
          '--validate': 'Validate configuration files',
          '--config-path': 'Configuration directory path'
        },
        examples: [
          'integration-auditor config --show',
          'integration-auditor config --validate'
        ]
      },
      products: {
        description: 'Manage multi-product configurations',
        options: {
          '--list': 'List all available product configurations',
          '--product': 'Show versions for specific product',
          '--create': 'Create new product configuration',
          '--version': 'Version for create operation'
        },
        examples: [
          'integration-auditor products --list',
          'integration-auditor products --product shopify-netsuite'
        ]
      },
      'business-rules': {
        description: 'View and modify business rules',
        options: {
          '--edition': 'Show requirements for specific edition',
          '--product': 'Product to show rules for',
          '--version': 'Version to show rules for',
          '--config-path': 'Configuration directory path'
        },
        examples: [
          'integration-auditor business-rules',
          'integration-auditor business-rules --edition premium'
        ]
      }
    },
    timestamp: new Date().toISOString()
  });
});
