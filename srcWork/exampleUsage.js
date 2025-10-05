'use strict'

/**
 * Example Usage of Unified Update Handler
 * This file demonstrates how to use the unified pattern for various update scenarios
 */

const { createUpdateHandler } = require('./unifiedUpdateHandler')

// Example 1: Simple Resource Update
const simpleResourceUpdate = createUpdateHandler({
  operationName: 'simpleResourceUpdate',
  operations: [
    {
      type: 'resourceUpdate',
      resourceType: 'imports',
      externalIds: ['shopify_item_import_adaptor'],
      modifications: [
        {
          action: 'set',
          path: 'timeout',
          value: 30000
        },
        {
          action: 'merge',
          value: {
            retryCount: 3,
            retryDelay: 1000
          }
        }
      ]
    }
  ]
})

// Example 2: Complex Settings Update
const complexSettingsUpdate = createUpdateHandler({
  operationName: 'complexSettingsUpdate',
  operations: [
    {
      type: 'settingsUpdate',
      scope: 'allStores',
      changes: [
        {
          sectionPath: [
            { type: 'find', condition: s => s.title === 'Item' }
          ],
          action: 'addField',
          field: {
            label: 'Enable Advanced Mapping',
            type: 'checkbox',
            name: 'enableAdvancedMapping_{index}',
            tooltip: 'Enable advanced field mapping for complex scenarios',
            value: false
          }
        },
        {
          sectionPath: [
            { type: 'find', condition: s => s.title === 'Order' },
            'sections',
            { type: 'find', condition: s => s.title === 'General' }
          ],
          action: 'updateField',
          condition: (field) => field.name === 'orderProcessing',
          updates: {
            tooltip: 'Updated tooltip with new information'
          }
        }
      ]
    }
  ]
})

// Example 3: Mixed Operations (API + Settings + Custom Logic)
const mixedOperationsUpdate = createUpdateHandler({
  operationName: 'mixedOperationsUpdate',
  operations: [
    // First: Get data via API
    {
      type: 'restApiCall',
      requestOptions: {
        resourcetype: 'exports'
      },
      responseHandler: function(err, response, exports, callback) {
        if (err) return callback(err)
        
        // Store exports data for later use
        this._exportsData = exports
        callback(null, exports)
      }
    },
    
    // Second: Custom logic using API data
    {
      type: 'customLogic',
      logic: function(callback) {
        const integration = this._integration
        const exports = this._exportsData || []
        
        // Find specific export and update integration settings
        const orderExport = exports.find(exp => exp.externalId === 'shopify_order_export_adaptor')
        if (orderExport) {
          // Update integration with export information
          if (!integration.settings.exportInfo) {
            integration.settings.exportInfo = {}
          }
          integration.settings.exportInfo.orderExportId = orderExport._id
        }
        
        callback(null, integration)
      }
    },
    
    // Third: Update resources based on previous operations
    {
      type: 'resourceUpdate',
      resourceType: 'flows',
      modifications: [
        {
          condition: (flow) => flow.name && flow.name.includes('Order'),
          action: 'custom',
          handler: (flow) => {
            // Add metadata based on previous operations
            if (!flow.metadata) flow.metadata = {}
            flow.metadata.lastUpdated = new Date().toISOString()
            flow.metadata.updateReason = 'mixedOperationsUpdate'
          }
        }
      ]
    }
  ]
})

// Example 4: Conditional Update Based on Integration State
const conditionalUpdate = createUpdateHandler({
  operationName: 'conditionalUpdate',
  requiredFields: [
    'settings.connectorEdition',
    'settings.sections'
  ],
  operations: [
    {
      type: 'customLogic',
      logic: function(callback) {
        const integration = this._integration
        const edition = integration.settings.connectorEdition
        
        // Only proceed if premium edition
        if (edition !== 'premium') {
          return callback() // Skip update for non-premium
        }
        
        // Add premium-specific settings
        integration.settings.sections.forEach(store => {
          if (store.shopInstallComplete) {
            const itemSection = store.sections?.find(s => s.title === 'Item')
            if (itemSection && itemSection.fields) {
              // Add premium field if not exists
              const premiumField = itemSection.fields.find(f => f.name === 'premiumFeatureEnabled')
              if (!premiumField) {
                itemSection.fields.push({
                  label: 'Enable Premium Features',
                  type: 'checkbox',
                  name: 'premiumFeatureEnabled',
                  value: true
                })
              }
            }
          }
        })
        
        callback(null, integration)
      }
    }
  ]
})

// Example 5: Cleanup and Maintenance Update
const cleanupUpdate = createUpdateHandler({
  operationName: 'cleanupUpdate',
  operations: [
    {
      type: 'integrationModification',
      modifications: [
        // Remove null entries from arrays
        {
          action: 'filter',
          path: 'settings.general',
          condition: (item) => item !== null && item !== undefined
        },
        {
          action: 'compact',
          path: 'settings.general'
        },
        
        // Clean up deprecated settings
        {
          action: 'custom',
          handler: (integration) => {
            integration.settings.sections.forEach(store => {
              if (store.sections) {
                store.sections.forEach(section => {
                  if (section.fields) {
                    // Remove deprecated fields
                    section.fields = section.fields.filter(field => 
                      !field.name || !field.name.includes('deprecated')
                    )
                  }
                })
              }
            })
          }
        }
      ]
    }
  ]
})

// Example 6: Error Handling and Validation
const robustUpdate = createUpdateHandler({
  operationName: 'robustUpdate',
  operations: [
    {
      type: 'customLogic',
      logic: function(callback) {
        try {
          const integration = this._integration
          const integrationId = this._integrationId
          
          // Validate integration state
          if (!integration.settings || !integration.settings.sections) {
            throw new Error(`Integration ${integrationId} missing required sections`)
          }
          
          // Perform safe updates with validation
          integration.settings.sections.forEach((store, index) => {
            if (!store) {
              throw new Error(`Invalid store at index ${index}`)
            }
            
            if (store.shopInstallComplete) {
              // Safe update with validation
              if (!store.metadata) store.metadata = {}
              store.metadata.lastValidated = new Date().toISOString()
              store.metadata.validationPassed = true
            }
          })
          
          callback(null, integration)
          
        } catch (error) {
          // Error will be automatically logged with operation context
          callback(error)
        }
      }
    }
  ]
})

// Usage Examples in installer.js:
/*
// Replace existing imports:
// const { updateDigitalItems } = require('../scripts/standAloneUpdateCode/updateDigitalItems')
// const { addGatewaysSetting } = require('../scripts/standAloneUpdateCode/addGatewaysSetting')

// With unified pattern:
const { 
  updateDigitalItems, 
  addGatewaysSetting 
} = require('../srcWork/updateConfigurations')

// Or use custom updates:
const { 
  simpleResourceUpdate,
  complexSettingsUpdate,
  mixedOperationsUpdate
} = require('../srcWork/exampleUsage')

// In your installer function:
updateDigitalItems.call(that, function(err) {
  if (err) return callback(err)
  
  simpleResourceUpdate.call(that, function(err) {
    if (err) return callback(err)
    
    callback()
  })
})
*/

module.exports = {
  simpleResourceUpdate,
  complexSettingsUpdate,
  mixedOperationsUpdate,
  conditionalUpdate,
  cleanupUpdate,
  robustUpdate
}
