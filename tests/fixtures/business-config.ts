/**
 * Test fixtures for business configuration
 */

export const testBusinessConfig = {
  product: 'shopify-netsuite',
  version: '1.51.0',
  name: 'Test Business Rules',
  description: 'Test configuration for unit tests',
  
  editionRequirements: {
    description: 'Resource requirements by edition for testing',
    starter: {
      importsPerStore: 16,
      exportsPerStore: 19,
      flowsPerStore: 16,
      description: 'Starter edition baseline',
      requiredImports: ['customers', 'orders', 'products'],
      requiredExports: ['inventory', 'fulfillments'],
      requiredFlows: ['order-sync', 'inventory-sync']
    },
    standard: {
      importsPerStore: 21,
      exportsPerStore: 23,
      flowsPerStore: 20,
      description: 'Standard edition (Starter + additional resources)',
      inheritsFrom: 'starter',
      additionalImports: ['returns', 'discounts', 'taxes', 'shipping', 'payments'],
      additionalExports: ['refunds', 'cancellations', 'backorders', 'tracking'],
      additionalFlows: ['return-sync', 'discount-sync', 'tax-sync', 'shipping-sync']
    },
    premium: {
      importsPerStore: 32,
      exportsPerStore: 32,
      flowsPerStore: 27,
      description: 'Premium edition (Standard + advanced features)',
      inheritsFrom: 'standard',
      additionalImports: ['analytics', 'reports', 'forecasting', 'bundles', 'variants', 'locations', 'transfers', 'adjustments', 'assemblies', 'kits', 'promotions'],
      additionalExports: ['advanced-inventory', 'multi-location', 'drop-ship', 'back-orders', 'pre-orders', 'gift-cards', 'loyalty', 'subscriptions', 'bundles'],
      additionalFlows: ['analytics-sync', 'forecast-sync', 'bundle-sync', 'variant-sync', 'location-sync', 'transfer-sync', 'assembly-sync']
    },
    shopifymarkets: {
      importsPerStore: 34,
      exportsPerStore: 32,
      flowsPerStore: 27,
      description: 'Shopify Markets edition (Premium + markets features)',
      inheritsFrom: 'premium',
      additionalImports: ['market-data', 'currency-rates'],
      additionalExports: [],
      additionalFlows: []
    }
  },

  licenseValidation: {
    validEditions: ['starter', 'standard', 'premium', 'shopifymarkets'],
    maxSettingsSize: 1048576, // 1MB
    caseSensitive: false,
    productFamily: 'shopify-netsuite'
  },

  requiredProperties: {
    topLevel: [
      'settings',
      'version'
    ],
    settingsLevel: [
      'connectorEdition',
      'general',
      'storemap',
      'sections'
    ],
    commonresources: [
      'netsuiteConnectionId',
      'nsUtilImportAdaptorApiIdentifier',
      'nsUtilImportAdaptorId'
    ],
    sectionProperties: [
      'shopInstallComplete',
      'id',
      'mode'
    ]
  },

  offlineConnectionRules: {
    detectOfflineWithActiveResources: true,
    crossReferenceFields: {
      'connections.IACONNECTIONID': 'imports.IMPORTCONNECTIONID',
      'connections.IACONNECTIONID': 'exports.EXPORTCONNECTIONID'
    },
    connectionOfflineValues: [true, 'true', '1', 1],
    severity: 'high'
  },

  updateProcessRules: {
    updateInProgressField: 'updateInProgress',
    updateInProgressValues: [true, 'true', '1', 1],
    csvFieldName: 'UPDATEINPROGRESS',
    severity: 'high'
  },

  tolerances: {
    resourceCountTolerance: 0
  },

  metadata: {
    businessOwner: 'Test Team',
    technicalOwner: 'Test Development Team',
    lastReviewed: '2025-01-01',
    changeApprovalRequired: true,
    testConfiguration: true
  }
};

export const testRemediationConfig = {
  actionTemplates: {
    resourceCountAdjustment: {
      rules: {
        tooMany: {
          strategy: 'remove-oldest',
          reason: 'Remove excess {resourceType} for {edition} edition (excess: {excessCount})',
          priority: 5,
          rollbackable: true
        },
        tooFew: {
          strategy: 'create-from-template',
          reason: 'Add missing {resourceType} for {edition} edition (missing: {missingCount})',
          priority: 7,
          rollbackable: true
        }
      }
    },

    licenseEditionMismatch: {
      targetPath: 'settings.connectorEdition',
      reason: 'Fix license mismatch: {oldValue} → {newValue}',
      priority: 4,
      rollbackable: true
    },

    missingProperties: {
      defaultValues: {
        'settings.general': {},
        'settings.storemap': [],
        'settings.sections': [],
        'settings.commonresources.netsuiteConnectionId': 'default-connection',
        'settings.commonresources.nsUtilImportAdaptorApiIdentifier': 'default-api-id',
        'settings.commonresources.nsUtilImportAdaptorId': 'default-adaptor-id'
      },
      reason: 'Add missing required property: {propertyPath}',
      priority: 6,
      rollbackable: true
    },

    offlineConnections: {
      reason: 'Reconnect offline connection {connectionId} (affecting {activeResourcesCount} resources)',
      priority: 6,
      rollbackable: false
    },

    stuckUpdateProcess: {
      targetPath: 'updateInProgress',
      value: false,
      reason: 'Clear stuck update flag',
      priority: 3,
      rollbackable: true
    }
  },

  executionStrategy: {
    priorityExecution: {
      enabled: true,
      priorityOrder: 'descending'
    },
    batchProcessing: {
      enabled: true,
      defaultBatchSize: 10,
      maxBatchSize: 50
    },
    safetyControls: {
      maxDestructiveActions: 20,
      requireConfirmationAbove: 50,
      allowConcurrentExecution: false
    }
  },

  rollbackStrategy: {
    autoGenerateRollback: true,
    rollbackPriority: 1,
    rollbackTimeout: 300000 // 5 minutes
  },

  businessImpactMapping: {
    resourceCountIssues: {
      impact: 'medium',
      description: 'Resource count mismatches affect integration functionality and data flow',
      businessJustification: 'Ensures proper data synchronization capacity'
    },
    configurationIssues: {
      impact: 'high',
      description: 'Configuration problems can cause integration failures and data corruption',
      businessJustification: 'Maintains system reliability and data integrity'
    },
    operationalIssues: {
      impact: 'critical',
      description: 'Operational problems block integration operations and require immediate attention',
      businessJustification: 'Prevents service disruption and maintains business continuity'
    }
  }
};

export const minimalBusinessConfig = {
  editionRequirements: {
    starter: {
      importsPerStore: 1,
      exportsPerStore: 1,
      flowsPerStore: 1,
      description: 'Minimal starter'
    }
  },
  licenseValidation: {
    validEditions: ['starter'],
    maxSettingsSize: 1000,
    caseSensitive: false
  },
  requiredProperties: {
    topLevel: ['settings'],
    settingsLevel: ['connectorEdition'],
    commonresources: [],
    sectionProperties: []
  },
  tolerances: {
    resourceCountTolerance: 0
  }
};

export const invalidBusinessConfig = {
  // Missing required fields
  licenseValidation: {
    validEditions: ['starter']
  }
  // Missing editionRequirements, requiredProperties, tolerances
};
