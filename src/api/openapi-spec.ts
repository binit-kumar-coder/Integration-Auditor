/**
 * OpenAPI 3.0 Specification for Integration Auditor
 * Enterprise-grade API documentation following OpenAPI standards
 */

export const openApiSpec = {
  openapi: '3.0.0',
  info: {
    title: 'Integration Auditor API',
    description: 'Enterprise-grade API for Integration Auditor - Complete CLI command equivalents',
    version: '1.0.0',
    contact: {
      name: 'Integration Auditor Team',
      email: 'support@integrationauditor.com'
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT'
    }
  },
  servers: [
    {
      url: 'http://localhost:3001',
      description: 'Development server'
    },
    {
      url: 'https://api.integrationauditor.com',
      description: 'Production server'
    }
  ],
  tags: [
    {
      name: 'Health & System',
      description: 'System health and status endpoints'
    },
    {
      name: 'Remediation',
      description: 'Remediation plan management and execution'
    },
    {
      name: 'Jobs',
      description: 'Individual job management and execution'
    },
    {
      name: 'State',
      description: 'Processing state management (CLI: state command)'
    },
    {
      name: 'Configuration',
      description: 'Configuration management (CLI: config command)'
    },
    {
      name: 'Business Rules',
      description: 'Business rules management (CLI: business-rules command)'
    },
    {
      name: 'Products',
      description: 'Product management (CLI: products command)'
    },
    {
      name: 'Fix',
      description: 'Fix operations (CLI: fix command)'
    },
    {
      name: 'Audit',
      description: 'Audit operations (CLI: audit command)'
    },
    {
      name: 'Files',
      description: 'File upload and management for CSV data (supports GB-sized files)'
    },
    {
      name: 'CLI',
      description: 'Direct CLI command execution via API'
    }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health & System'],
        summary: 'Health Check',
        description: 'Check if the Integration Auditor service is running and healthy',
        operationId: 'healthCheck',
        responses: {
          '200': {
            description: 'Service is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    timestamp: { type: 'string', format: 'date-time' },
                    service: { type: 'string', example: 'integration-auditor-remediation' },
                    version: { type: 'string', example: '1.0.0' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/system/status': {
      get: {
        tags: ['Health & System'],
        summary: 'System Status',
        description: 'CLI equivalent: integration-auditor status',
        operationId: 'getSystemStatus',
        responses: {
          '200': {
            description: 'System status information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'healthy' },
                    version: { type: 'string', example: '1.0.0' },
                    architecture: { type: 'string', example: 'Data-Driven (JSON Configuration)' },
                    nodeVersion: { type: 'string' },
                    uptime: { type: 'number' },
                    components: {
                      type: 'object',
                      properties: {
                        corruptionDetector: { type: 'string', example: 'operational' },
                        remediationEngine: { type: 'string', example: 'operational' },
                        stateManager: { type: 'string', example: 'operational' },
                        csvProcessor: { type: 'string', example: 'operational' }
                      }
                    },
                    processingStats: { type: 'object' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/system/version': {
      get: {
        tags: ['Health & System'],
        summary: 'Version Information',
        description: 'Get version and build information',
        operationId: 'getVersion',
        responses: {
          '200': {
            description: 'Version information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    version: { type: 'string', example: '1.0.0' },
                    name: { type: 'string', example: 'Integration Auditor' },
                    architecture: { type: 'string', example: 'Data-Driven' },
                    nodeVersion: { type: 'string' },
                    buildDate: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/remediation/plans': {
      post: {
        tags: ['Remediation'],
        summary: 'Submit Remediation Plan',
        description: 'Submit a new remediation plan with jobs to be executed',
        operationId: 'submitRemediationPlan',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['jobs'],
                properties: {
                  jobs: {
                    type: 'array',
                    items: {
                      $ref: '#/components/schemas/RemediationJob'
                    }
                  },
                  metadata: {
                    type: 'object',
                    properties: {
                      planName: { type: 'string' },
                      description: { type: 'string' },
                      operatorId: { type: 'string' }
                    }
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Plan submitted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    planId: { type: 'string' },
                    jobIds: { type: 'array', items: { type: 'string' } },
                    totalJobs: { type: 'integer' },
                    totalActions: { type: 'integer' },
                    status: { type: 'string', example: 'queued' },
                    submittedAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/remediation/queue': {
      get: {
        tags: ['Remediation'],
        summary: 'Get Queue Status',
        description: 'Get current remediation queue status',
        operationId: 'getQueueStatus',
        responses: {
          '200': {
            description: 'Queue status',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    pending: { type: 'array', items: { $ref: '#/components/schemas/RemediationJob' } },
                    processing: { type: 'array', items: { $ref: '#/components/schemas/RemediationJob' } },
                    completed: { type: 'array', items: { $ref: '#/components/schemas/RemediationJob' } },
                    failed: { type: 'array', items: { $ref: '#/components/schemas/RemediationJob' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/config': {
      get: {
        tags: ['Configuration'],
        summary: 'Get Configuration',
        description: 'CLI equivalent: integration-auditor config --show',
        operationId: 'getConfiguration',
        responses: {
          '200': {
            description: 'Current configuration',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    config: {
                      type: 'object',
                      properties: {
                        businessRules: { type: 'object' },
                        remediationLogic: { type: 'object' },
                        loadedAt: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/business-rules': {
      get: {
        tags: ['Business Rules'],
        summary: 'Get Business Rules',
        description: 'CLI equivalent: integration-auditor business-rules',
        operationId: 'getBusinessRules',
        responses: {
          '200': {
            description: 'Business rules configuration',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    businessRules: { $ref: '#/components/schemas/BusinessRules' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/remediation/jobs/{jobId}': {
      get: {
        tags: ['Jobs'],
        summary: 'Get Job Details',
        description: 'Get details of a specific remediation job by ID',
        operationId: 'getJobDetails',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Job identifier',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Job details',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RemediationJob' }
              }
            }
          },
          '404': {
            description: 'Job not found',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Error' }
              }
            }
          }
        }
      },
      delete: {
        tags: ['Jobs'],
        summary: 'Cancel Job',
        description: 'Cancel a specific remediation job by ID',
        operationId: 'cancelJob',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Job identifier',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Job cancelled successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    cancelled: { type: 'boolean' },
                    jobId: { type: 'string' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/remediation/jobs/{jobId}/execute': {
      post: {
        tags: ['Jobs'],
        summary: 'Execute Job',
        description: 'Execute a specific remediation job by ID',
        operationId: 'executeJob',
        parameters: [
          {
            name: 'jobId',
            in: 'path',
            required: true,
            description: 'Job identifier',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Job executed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    results: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          actionId: { type: 'string' },
                          success: { type: 'boolean' },
                          result: { type: 'object' },
                          error: { type: 'string' }
                        }
                      }
                    },
                    executedAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/remediation/stats': {
      get: {
        tags: ['Remediation'],
        summary: 'Get Statistics',
        description: 'Get detailed service statistics including queue stats and performance metrics',
        operationId: 'getRemediationStats',
        responses: {
          '200': {
            description: 'Service statistics',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    queueStats: {
                      type: 'object',
                      properties: {
                        pending: { type: 'integer' },
                        processing: { type: 'integer' },
                        completed: { type: 'integer' },
                        failed: { type: 'integer' }
                      }
                    },
                    systemStats: {
                      type: 'object',
                      properties: {
                        maxConcurrent: { type: 'integer' },
                        currentProcessing: { type: 'integer' },
                        totalJobs: { type: 'integer' }
                      }
                    },
                    performance: {
                      type: 'object',
                      properties: {
                        averageActionsPerJob: { type: 'number' },
                        recentCompletions: { type: 'array', items: { type: 'object' } }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/remediation/process': {
      post: {
        tags: ['Remediation'],
        summary: 'Process Queue',
        description: 'Trigger processing of queued remediation jobs',
        operationId: 'processQueue',
        responses: {
          '200': {
            description: 'Queue processing started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string', example: 'Queue processing started' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/fix/dry-run': {
      post: {
        tags: ['Fix'],
        summary: 'Fix Dry Run',
        description: 'CLI equivalent: integration-auditor fix --edition premium --dry-run',
        operationId: 'fixDryRun',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  edition: { type: 'string', enum: ['starter', 'standard', 'premium', 'shopifymarkets'], default: 'standard' },
                  version: { type: 'string', default: '1.51.0' },
                  tier: { type: 'string', enum: ['tier1', 'tier2', 'tier3'], default: 'tier1' },
                  allowlist: { type: 'array', items: { type: 'string' }, description: 'Integration IDs to process' },
                  allowlistAccounts: { type: 'array', items: { type: 'string' }, description: 'Account emails to process' },
                  maxOpsPerIntegration: { type: 'integer', default: 100 },
                  maxConcurrent: { type: 'integer', default: 50 },
                  rateLimit: { type: 'integer', default: 10 },
                  batchSize: { type: 'integer', default: 20 },
                  operatorId: { type: 'string' },
                  createRestoreBundle: { type: 'boolean', default: true },
                  maintenanceWindow: { type: 'boolean', default: false }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Dry run completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    mode: { type: 'string', example: 'dry-run' },
                    results: {
                      type: 'object',
                      properties: {
                        integrationsProcessed: { type: 'integer' },
                        corruptionsFound: { type: 'integer' },
                        actionsGenerated: { type: 'integer' },
                        sessionDir: { type: 'string' },
                        summary: { type: 'object' }
                      }
                    },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/fix/apply': {
      post: {
        tags: ['Fix'],
        summary: 'Fix Apply',
        description: 'CLI equivalent: integration-auditor fix --edition premium --apply',
        operationId: 'fixApply',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  edition: { type: 'string', enum: ['starter', 'standard', 'premium', 'shopifymarkets'], default: 'standard' },
                  version: { type: 'string', default: '1.51.0' },
                  tier: { type: 'string', enum: ['tier1', 'tier2', 'tier3'], default: 'tier1' },
                  allowlist: { type: 'array', items: { type: 'string' } },
                  allowlistAccounts: { type: 'array', items: { type: 'string' } },
                  maxOpsPerIntegration: { type: 'integer', default: 100 },
                  maxConcurrent: { type: 'integer', default: 50 },
                  rateLimit: { type: 'integer', default: 10 },
                  batchSize: { type: 'integer', default: 20 },
                  operatorId: { type: 'string' },
                  forceConfirmation: { type: 'boolean', default: false },
                  createRestoreBundle: { type: 'boolean', default: true },
                  maintenanceWindow: { type: 'boolean', default: false },
                  forceReprocess: { type: 'boolean', default: false },
                  maxAge: { type: 'integer', default: 24, description: 'Max age in hours before reprocessing' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Remediation applied successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    mode: { type: 'string', example: 'apply' },
                    results: {
                      type: 'object',
                      properties: {
                        integrationsProcessed: { type: 'integer' },
                        actionsExecuted: { type: 'integer' },
                        successCount: { type: 'integer' },
                        failureCount: { type: 'integer' },
                        sessionDir: { type: 'string' },
                        restoreBundle: { type: 'string' }
                      }
                    },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/audit/run': {
      post: {
        tags: ['Audit'],
        summary: 'Run Audit',
        description: 'CLI equivalent: integration-auditor audit --tier tier1',
        operationId: 'runAudit',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  tier: { type: 'string', enum: ['tier1', 'tier2', 'tier3'], default: 'tier1' },
                  edition: { type: 'string', enum: ['starter', 'standard', 'premium', 'shopifymarkets'] },
                  input: { type: 'string', default: './input' },
                  config: { type: 'string', default: './config' },
                  output: { type: 'string', default: './output' },
                  operatorId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Audit completed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    audit: {
                      type: 'object',
                      properties: {
                        integrationsAudited: { type: 'integer' },
                        corruptionsDetected: { type: 'integer' },
                        severityBreakdown: {
                          type: 'object',
                          properties: {
                            critical: { type: 'integer' },
                            high: { type: 'integer' },
                            medium: { type: 'integer' },
                            low: { type: 'integer' }
                          }
                        }
                      }
                    },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/products': {
      get: {
        tags: ['Products'],
        summary: 'List Products',
        description: 'CLI equivalent: integration-auditor products --list',
        operationId: 'listProducts',
        responses: {
          '200': {
            description: 'List of available products',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    products: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                          versions: { type: 'array', items: { type: 'string' } },
                          description: { type: 'string' }
                        }
                      }
                    },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/products/{product}': {
      get: {
        tags: ['Products'],
        summary: 'Get Product Details',
        description: 'CLI equivalent: integration-auditor products --product shopify-netsuite',
        operationId: 'getProduct',
        parameters: [
          {
            name: 'product',
            in: 'path',
            required: true,
            description: 'Product name',
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': {
            description: 'Product details',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    product: { type: 'string' },
                    versions: { type: 'array', items: { type: 'string' } },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/state/cleanup': {
      post: {
        tags: ['State'],
        summary: 'Cleanup State',
        description: 'CLI equivalent: integration-auditor state --cleanup',
        operationId: 'cleanupState',
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  olderThanDays: { type: 'integer', default: 30, description: 'Clean records older than N days' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Cleanup completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    cleaned: { type: 'integer' },
                    message: { type: 'string' },
                    cleanedAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/state/export': {
      get: {
        tags: ['State'],
        summary: 'Export State',
        description: 'CLI equivalent: integration-auditor state --export file.json',
        operationId: 'exportState',
        responses: {
          '200': {
            description: 'State exported successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    data: { type: 'object', description: 'Complete state data' },
                    exportedAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/state/import': {
      post: {
        tags: ['State'],
        summary: 'Import State',
        description: 'CLI equivalent: integration-auditor state --import file.json',
        operationId: 'importState',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['stateData'],
                properties: {
                  stateData: { type: 'object', description: 'State data to import' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'State imported successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string' },
                    importedAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/state/reset': {
      delete: {
        tags: ['State'],
        summary: 'Reset State',
        description: 'CLI equivalent: integration-auditor state --reset (DANGEROUS)',
        operationId: 'resetState',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['confirm'],
                properties: {
                  confirm: { type: 'string', enum: ['RESET_ALL_STATE'], description: 'Confirmation string' },
                  operatorId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'State reset successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string' },
                    warning: { type: 'string' },
                    resetBy: { type: 'string' },
                    resetAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/cli/execute': {
      post: {
        tags: ['CLI'],
        summary: 'Execute CLI Command',
        description: 'Execute any Integration Auditor CLI command via API',
        operationId: 'executeCLI',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['command'],
                properties: {
                  command: { 
                    type: 'string', 
                    enum: ['fix', 'audit', 'status', 'state', 'config', 'products', 'business-rules'],
                    description: 'CLI command to execute'
                  },
                  options: { 
                    type: 'object', 
                    additionalProperties: true,
                    description: 'Command options and flags'
                  },
                  operatorId: { type: 'string' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Command executed successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    command: { type: 'string' },
                    output: {
                      type: 'object',
                      properties: {
                        stdout: { type: 'string' },
                        stderr: { type: 'string' }
                      }
                    },
                    executedBy: { type: 'string' },
                    executedAt: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/cli/commands': {
      get: {
        tags: ['CLI'],
        summary: 'List Available Commands',
        description: 'Get list of all available CLI commands with their options',
        operationId: 'listCLICommands',
        responses: {
          '200': {
            description: 'List of available CLI commands',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    commands: { type: 'object', additionalProperties: true },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/business-rules/edition/{edition}': {
      get: {
        tags: ['Business Rules'],
        summary: 'Get Rules by Edition',
        description: 'CLI equivalent: integration-auditor business-rules --edition premium',
        operationId: 'getBusinessRulesByEdition',
        parameters: [
          {
            name: 'edition',
            in: 'path',
            required: true,
            description: 'Edition name (starter, standard, premium, shopifymarkets)',
            schema: {
              type: 'string',
              enum: ['starter', 'standard', 'premium', 'shopifymarkets', 'markets']
            }
          }
        ],
        responses: {
          '200': {
            description: 'Edition-specific rules',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    edition: { type: 'string' },
                    rules: { $ref: '#/components/schemas/EditionRequirements' },
                    licenseValidation: { $ref: '#/components/schemas/LicenseValidation' },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          },
          '404': {
            description: 'Edition not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    error: { type: 'string' },
                    availableEditions: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/files/upload/tier/{tier}': {
      post: {
        tags: ['Files'],
        summary: 'Upload CSV File',
        description: 'Upload CSV file to specific tier (supports gigabyte-sized files)',
        operationId: 'uploadCSVFile',
        parameters: [
          {
            name: 'tier',
            in: 'path',
            required: true,
            description: 'Tier name (tier1, tier2, tier3)',
            schema: { type: 'string', enum: ['tier1', 'tier2', 'tier3'] }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['csvFile', 'csvType'],
                properties: {
                  csvFile: {
                    type: 'string',
                    format: 'binary',
                    description: 'CSV file to upload (up to 10GB)'
                  },
                  csvType: {
                    type: 'string',
                    enum: ['integrations', 'imports', 'exports', 'flows', 'connections'],
                    description: 'Type of CSV file'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'File uploaded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    message: { type: 'string' },
                    file: {
                      type: 'object',
                      properties: {
                        tier: { type: 'string' },
                        csvType: { type: 'string' },
                        originalName: { type: 'string' },
                        size: { type: 'integer' },
                        sizeFormatted: { type: 'string' },
                        path: { type: 'string' },
                        uploadedAt: { type: 'string', format: 'date-time' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/files/upload/tier/{tier}/batch': {
      post: {
        tags: ['Files'],
        summary: 'Upload Multiple CSV Files',
        description: 'Upload multiple CSV files for a tier in one request',
        operationId: 'batchUploadCSV',
        parameters: [
          {
            name: 'tier',
            in: 'path',
            required: true,
            description: 'Tier name',
            schema: { type: 'string', enum: ['tier1', 'tier2', 'tier3'] }
          }
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  csvFiles: {
                    type: 'array',
                    items: {
                      type: 'string',
                      format: 'binary'
                    },
                    description: 'Multiple CSV files (integrations.csv, imports.csv, etc.)'
                  }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Batch upload completed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    tier: { type: 'string' },
                    summary: {
                      type: 'object',
                      properties: {
                        totalFiles: { type: 'integer' },
                        successful: { type: 'integer' },
                        failed: { type: 'integer' }
                      }
                    },
                    results: { type: 'array', items: { type: 'object' } }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/files/chunked-upload/start': {
      post: {
        tags: ['Files'],
        summary: 'Start Chunked Upload',
        description: 'Start chunked upload for very large files (>1GB)',
        operationId: 'startChunkedUpload',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['filename', 'fileSize', 'csvType', 'tier'],
                properties: {
                  filename: { type: 'string', description: 'Original filename' },
                  fileSize: { type: 'integer', description: 'Total file size in bytes' },
                  csvType: { type: 'string', enum: ['integrations', 'imports', 'exports', 'flows', 'connections'] },
                  tier: { type: 'string', enum: ['tier1', 'tier2', 'tier3'] },
                  chunkSize: { type: 'integer', default: 10485760, description: 'Chunk size in bytes (default: 10MB)' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Chunked upload started',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    uploadId: { type: 'string' },
                    metadata: {
                      type: 'object',
                      properties: {
                        totalChunks: { type: 'integer' },
                        chunkSize: { type: 'integer' },
                        uploadUrl: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/files/list': {
      get: {
        tags: ['Files'],
        summary: 'List Uploaded Files',
        description: 'List all uploaded CSV files by tier and type',
        operationId: 'listFiles',
        parameters: [
          {
            name: 'tier',
            in: 'query',
            description: 'Filter by specific tier',
            schema: { type: 'string', enum: ['tier1', 'tier2', 'tier3'] }
          }
        ],
        responses: {
          '200': {
            description: 'File listing',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'success' },
                    files: {
                      type: 'object',
                      additionalProperties: {
                        type: 'object',
                        additionalProperties: {
                          type: 'object',
                          properties: {
                            filename: { type: 'string' },
                            size: { type: 'integer' },
                            sizeFormatted: { type: 'string' },
                            lastModified: { type: 'string', format: 'date-time' },
                            path: { type: 'string' }
                          }
                        }
                      }
                    },
                    timestamp: { type: 'string', format: 'date-time' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      RemediationJob: {
        type: 'object',
        required: ['integrationId', 'email', 'actions', 'status', 'priority', 'operatorId', 'environment'],
        properties: {
          id: { type: 'string', description: 'Auto-generated job ID' },
          integrationId: { type: 'string', description: 'Integration identifier' },
          email: { type: 'string', format: 'email', description: 'User email' },
          actions: {
            type: 'array',
            items: { $ref: '#/components/schemas/ExecutionAction' }
          },
          status: {
            type: 'string',
            enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
            description: 'Job status'
          },
          priority: { type: 'integer', minimum: 1, maximum: 10 },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
          operatorId: { type: 'string', description: 'Operator who submitted the job' },
          environment: { type: 'string', enum: ['development', 'staging', 'production', 'test'] },
          metadata: {
            type: 'object',
            properties: {
              corruptionTypes: { type: 'array', items: { type: 'string' } },
              totalActions: { type: 'integer' },
              estimatedDuration: { type: 'integer', description: 'Estimated duration in seconds' }
            }
          }
        }
      },
      ExecutionAction: {
        type: 'object',
        required: ['id', 'type', 'target', 'metadata'],
        properties: {
          id: { type: 'string', description: 'Unique action identifier' },
          type: {
            type: 'string',
            enum: ['create', 'update', 'delete', 'patch', 'reconnect', 'adjust'],
            description: 'Action type'
          },
          target: {
            type: 'object',
            required: ['type', 'resourceType'],
            properties: {
              type: {
                type: 'string',
                enum: ['import', 'export', 'flow', 'connection', 'setting'],
                description: 'Target resource type'
              },
              resourceType: { type: 'string', description: 'Specific resource type' },
              resourceId: { type: 'string', description: 'Resource identifier' }
            }
          },
          payload: {
            type: 'object',
            description: 'Action-specific data',
            additionalProperties: true
          },
          metadata: {
            type: 'object',
            required: ['reason', 'priority', 'rollbackable'],
            properties: {
              reason: { type: 'string', description: 'Human-readable reason for action' },
              priority: { type: 'integer', minimum: 1, maximum: 10 },
              rollbackable: { type: 'boolean', description: 'Whether action can be rolled back' }
            }
          }
        }
      },
      BusinessRules: {
        type: 'object',
        properties: {
          editionRequirements: {
            type: 'object',
            additionalProperties: { $ref: '#/components/schemas/EditionRequirements' }
          },
          licenseValidation: { $ref: '#/components/schemas/LicenseValidation' },
          requiredProperties: {
            type: 'object',
            properties: {
              topLevel: { type: 'array', items: { type: 'string' } },
              settingsLevel: { type: 'array', items: { type: 'string' } },
              commonresources: { type: 'array', items: { type: 'string' } },
              sectionProperties: { type: 'array', items: { type: 'string' } }
            }
          },
          tolerances: {
            type: 'object',
            properties: {
              resourceCountTolerance: { type: 'integer', minimum: 0 }
            }
          }
        }
      },
      EditionRequirements: {
        type: 'object',
        required: ['importsPerStore', 'exportsPerStore', 'flowsPerStore'],
        properties: {
          importsPerStore: { type: 'integer', minimum: 1 },
          exportsPerStore: { type: 'integer', minimum: 1 },
          flowsPerStore: { type: 'integer', minimum: 1 },
          description: { type: 'string' },
          requiredImports: { type: 'array', items: { type: 'string' } },
          requiredExports: { type: 'array', items: { type: 'string' } },
          requiredFlows: { type: 'array', items: { type: 'string' } }
        }
      },
      LicenseValidation: {
        type: 'object',
        required: ['validEditions', 'maxSettingsSize'],
        properties: {
          validEditions: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['starter', 'standard', 'premium', 'shopifymarkets', 'markets']
            }
          },
          maxSettingsSize: { type: 'integer', minimum: 1024 },
          caseSensitive: { type: 'boolean' },
          allowTrimming: { type: 'boolean' }
        }
      },
      Error: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string', description: 'Error message' },
          details: { type: 'string', description: 'Detailed error information' },
          timestamp: { type: 'string', format: 'date-time' }
        }
      }
    }
  }
};
