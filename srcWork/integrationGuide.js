'use strict'

/**
 * Integration Guide for Unified Update Handler
 * 
 * This file shows how to integrate the unified update pattern into the existing
 * Shopify-NetSuite connector codebase with minimal changes.
 */

// ============================================================================
// STEP 1: Update installer.js imports
// ============================================================================

// BEFORE (in src/installer.js):
/*
const { updateFulfillmentApiMigration } = require('../scripts/updateCodeRepo/1.46.2')
const { updateDigitalItems } = require('../scripts/standAloneUpdateCode/updateDigitalItems')
const { updateAdaptorRequestType } = require('../scripts/standAloneUpdateCode/updateAdaptorRequestType')
const { removeDuplicateSetting } = require('../scripts/standAloneUpdateCode/removeDuplicateSetting')
const { addGatewaysSetting } = require('../scripts/standAloneUpdateCode/addGatewaysSetting')
const { addExternalId } = require('../scripts/standAloneUpdateCode/addExternalId')
*/

// AFTER (in src/installer.js):
const { updateFulfillmentApiMigration } = require('../scripts/updateCodeRepo/1.46.2')
const { 
  updateDigitalItems,
  updateAdaptorRequestType,
  removeDuplicateSetting,
  addGatewaysSetting,
  addExternalId
} = require('../srcWork/updateConfigurations')

// ============================================================================
// STEP 2: No changes needed to existing function calls
// ============================================================================

// The unified handlers maintain the same function signature as the original files
// So existing calls work without modification:

/*
// This remains exactly the same:
updateDigitalItems.call(that, function (err) {
  logger.info('updating digital items completed, IntegrationId=' + options._integrationId + ' error ' + JSON.stringify(err))
  if (err) return handleCallbackError(options, body, err, functionName, callback)
  handleCallbackError(options, body, null, functionName, callback)
})
*/

// ============================================================================
// STEP 3: Adding new update operations
// ============================================================================

// Example: Adding a new update operation for version 1.56.0
const { createUpdateHandler } = require('../srcWork/unifiedUpdateHandler')

const version1_56_0_Update = createUpdateHandler({
  operationName: 'version1.56.0Update',
  operations: [
    {
      type: 'resourceUpdate',
      resourceType: 'imports',
      externalIds: ['shopify_customer_import_adaptor'],
      modifications: [
        {
          action: 'set',
          path: 'timeout',
          value: 45000 // Increase timeout to 45 seconds
        },
        {
          condition: (adaptor) => !adaptor.retryConfig,
          action: 'merge',
          value: {
            retryConfig: {
              maxRetries: 3,
              retryDelay: 2000,
              exponentialBackoff: true
            }
          }
        }
      ]
    },
    {
      type: 'settingsUpdate',
      scope: 'allStores',
      changes: [
        {
          sectionPath: [
            { type: 'find', condition: s => s.title === 'Customer' }
          ],
          action: 'addField',
          field: {
            label: 'Enable Customer Sync Optimization',
            type: 'checkbox',
            name: 'enableCustomerSyncOptimization',
            tooltip: 'Enables optimized customer synchronization for better performance',
            value: true
          }
        }
      ]
    }
  ]
})

// ============================================================================
// STEP 4: Using in version-specific update code files
// ============================================================================

// Example: scripts/updateCodeRepo/1.56.0.js
/*
'use strict'

const AbstractVersionUpdate = require('@celigo/abstract-connector').AbstractVersionUpdate
const { version1_56_0_Update } = require('../../srcWork/integrationGuide')

class VersionUpdater extends AbstractVersionUpdate {
  constructor(options) {
    super(options)
    this.updateLogic = version1_56_0_Update
  }
}

module.exports = VersionUpdater
*/

// ============================================================================
// STEP 5: Complex update scenarios
// ============================================================================

// Example: Multi-step update with state management
const complexMultiStepUpdate = createUpdateHandler({
  operationName: 'complexMultiStepUpdate',
  operations: [
    // Step 1: Backup current settings
    {
      type: 'customLogic',
      logic: function(callback) {
        const integration = this._integration
        
        // Create backup of current settings
        if (!integration.settings.backup) {
          integration.settings.backup = {}
        }
        integration.settings.backup.timestamp = new Date().toISOString()
        integration.settings.backup.version = integration.version
        integration.settings.backup.sections = JSON.parse(JSON.stringify(integration.settings.sections))
        
        callback(null, integration)
      }
    },
    
    // Step 2: Get additional data from API
    {
      type: 'restApiCall',
      requestOptions: {
        resourcetype: 'connections'
      },
      responseHandler: function(err, response, connections, callback) {
        if (err) return callback(err)
        
        // Store connections for later steps
        this._connectionsData = connections
        callback(null, connections)
      }
    },
    
    // Step 3: Update resources based on connections
    {
      type: 'resourceUpdate',
      resourceType: 'flows',
      modifications: [
        {
          condition: (flow) => {
            // Use connections data from previous step
            const connections = this._connectionsData || []
            const shopifyConn = connections.find(c => c.type === 'shopify')
            return flow.name && flow.name.includes('Shopify') && shopifyConn
          },
          action: 'custom',
          handler: (flow) => {
            // Update flow with connection information
            if (!flow.metadata) flow.metadata = {}
            flow.metadata.connectionValidated = true
            flow.metadata.lastConnectionCheck = new Date().toISOString()
          }
        }
      ]
    },
    
    // Step 4: Cleanup and validation
    {
      type: 'integrationModification',
      modifications: [
        {
          action: 'custom',
          handler: (integration) => {
            // Validate the update was successful
            let validationPassed = true
            
            integration.settings.sections.forEach(store => {
              if (store.shopInstallComplete) {
                // Check if required fields exist
                const requiredSections = ['Order', 'Item', 'Customer']
                const existingSections = store.sections?.map(s => s.title) || []
                
                for (const required of requiredSections) {
                  if (!existingSections.includes(required)) {
                    validationPassed = false
                    break
                  }
                }
              }
            })
            
            // Add validation result to integration
            integration.settings.updateValidation = {
              passed: validationPassed,
              timestamp: new Date().toISOString(),
              operation: 'complexMultiStepUpdate'
            }
          }
        }
      ]
    }
  ]
})

// ============================================================================
// STEP 6: Testing and validation
// ============================================================================

// Example test configuration
const testUpdateHandler = createUpdateHandler({
  operationName: 'testUpdate',
  requiredFields: ['settings.sections'], // Minimal requirements for testing
  operations: [
    {
      type: 'customLogic',
      logic: function(callback) {
        const integration = this._integration
        
        // Add test marker
        if (!integration.settings.test) {
          integration.settings.test = {}
        }
        integration.settings.test.lastRun = new Date().toISOString()
        integration.settings.test.operationName = 'testUpdate'
        
        callback(null, integration)
      }
    }
  ]
})

// ============================================================================
// STEP 7: Migration utilities
// ============================================================================

/**
 * Utility to migrate existing standalone update code to unified pattern
 */
function migrateStandaloneUpdate(existingFunction, operationName) {
  return createUpdateHandler({
    operationName: operationName,
    operations: [
      {
        type: 'customLogic',
        logic: existingFunction
      }
    ]
  })
}

// Example migration:
/*
// Original function from removeDuplicateSetting.js
const originalRemoveDuplicate = function(callback) {
  // ... original logic
}

// Migrated version
const migratedRemoveDuplicate = migrateStandaloneUpdate(originalRemoveDuplicate, 'removeDuplicateSetting')
*/

// ============================================================================
// STEP 8: Rollback capabilities
// ============================================================================

const rollbackCapableUpdate = createUpdateHandler({
  operationName: 'rollbackCapableUpdate',
  operations: [
    // Create rollback point
    {
      type: 'customLogic',
      logic: function(callback) {
        const integration = this._integration
        
        // Store rollback information
        if (!integration.settings.rollback) {
          integration.settings.rollback = {}
        }
        
        integration.settings.rollback.preUpdateState = {
          timestamp: new Date().toISOString(),
          version: integration.version,
          sections: JSON.parse(JSON.stringify(integration.settings.sections))
        }
        
        callback(null, integration)
      }
    },
    
    // Perform actual update
    {
      type: 'settingsUpdate',
      scope: 'allStores',
      changes: [
        {
          sectionPath: [],
          action: 'custom',
          handler: function(store) {
            // Mark store as updated
            if (!store.metadata) store.metadata = {}
            store.metadata.lastUpdate = new Date().toISOString()
            store.metadata.canRollback = true
          }
        }
      ]
    }
  ]
})

// Export all examples and utilities
module.exports = {
  version1_56_0_Update,
  complexMultiStepUpdate,
  testUpdateHandler,
  rollbackCapableUpdate,
  migrateStandaloneUpdate,
  
  // Integration examples for installer.js
  installerIntegration: {
    updateDigitalItems,
    updateAdaptorRequestType,
    removeDuplicateSetting,
    addGatewaysSetting,
    addExternalId
  }
}
