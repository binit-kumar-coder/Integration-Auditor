'use strict'

const { createUpdateHandler } = require('./unifiedUpdateHandler')
const updateConnectorUtil = require('@celigo/abstract-connector').updateConnectorUtil
const async = require('async')
const _ = require('lodash')
const installerUtils = require('@celigo/connector-utils').installerUtils
const CONSTANTS = require('../src/constants')

/**
 * Configuration for removeDuplicateSetting.js
 * Removes duplicate general settings based on store ID
 */
const removeDuplicateSettingConfig = {
  operationName: 'removeDuplicateSetting',
  requiredFields: [
    'settings.commonresources',
    'settings.sections', 
    'settings.storemap',
    'settings.connectorEdition',
    'settings.general'
  ],
  operations: [
    {
      type: 'customLogic',
      logic: function(callback) {
        const integration = this._integration
        const integrationId = this._integrationId
        
        try {
          const seenIds = []
          
          _.forEach(integration.settings.general, function (store, index) {
            const storeId = store?.id
            
            if (seenIds.includes(storeId) && storeId !== null) {
              const fields = store.fields
              
              // Check if current store has default/empty values
              if (JSON.stringify(fields[0].extracts) === '[null]' && 
                  JSON.stringify(fields[0].generates) === '[null]' && 
                  fields[1].value === false && 
                  fields[2].value === false && 
                  fields[3].value === false && 
                  fields[4].value === '') {
                integration.settings.general[index] = null
                seenIds.push(null)
              } else {
                // Find original store with same ID
                const originalIndex = _.findIndex(integration.settings.general, function (eachStore) {
                  return storeId === eachStore.id
                })
                
                if (originalIndex >= 0) {
                  const originalStore = integration.settings.general[originalIndex]
                  const originalFields = originalStore.fields
                  
                  // Check if original store has default/empty values
                  if (JSON.stringify(originalFields[0].extracts) === '[null]' && 
                      JSON.stringify(originalFields[0].generates) === '[null]' && 
                      originalFields[1].value === false && 
                      originalFields[2].value === false && 
                      originalFields[3].value === false && 
                      originalFields[4].value === '') {
                    integration.settings.general[originalIndex] = null
                    seenIds[originalIndex] = null
                    seenIds.push(storeId)
                  }
                }
              }
            } else {
              seenIds.push(storeId)
            }
          })
          
          // Compact the array to remove null entries
          integration.settings.general = _.compact(integration.settings.general)
          
          callback(null, integration)
        } catch (err) {
          callback(err)
        }
      }
    }
  ]
}

/**
 * Configuration for addGatewaysSetting.js
 * Adds payment gateway mapping setting to all stores
 */
const addGatewaysSettingConfig = {
  operationName: 'addGatewaysSetting',
  operations: [
    {
      type: 'settingsUpdate',
      scope: 'allStores',
      changes: [
        {
          sectionPath: [
            { type: 'find', condition: s => s.title === 'Order' },
            'sections',
            { type: 'find', condition: s => s.title === 'Payment' }
          ],
          action: 'custom',
          handler: function(paymentSection, storeIndex) {
            if (!paymentSection || !paymentSection.fields) return
            
            let importId
            // Find the import ID from existing payment method lookup field
            _.find(paymentSection.fields, (field) => {
              if (field && field.name && field.name.indexOf('paymentmethodLookup') >= 0) {
                importId = field.name.split('_')[1]
                return true
              }
            })
            
            // Check if gateway setting already exists
            const enableGatewaysSetting = _.find(paymentSection.fields, (field) => {
              if (field && field.name) return field.name.indexOf('isMapShopifyGatewayEnabled') >= 0
            })
            
            // Add the setting if it doesn't exist and we have an import ID
            if (!enableGatewaysSetting && importId) {
              paymentSection.fields.push({
                label: 'Map Shopify payment gateway to NetSuite payment method',
                type: 'checkbox',
                name: `imports_${importId}_isMapShopifyGatewayEnabled`,
                tooltip: 'Check this box to move the payment method mapping from the processing method to the payment gateway. Before enabling this box, add gateway values to the Shopify Payment Method field.',
                value: false
              })
            }
          }
        }
      ]
    }
  ]
}

/**
 * Configuration for updateAdaptorRequestType.js
 * Updates request types for specific import adaptors
 */
const updateAdaptorRequestTypeConfig = {
  operationName: 'updateAdaptorRequestType',
  operations: [
    {
      type: 'resourceUpdate',
      resourceType: 'imports',
      externalIds: [
        'shopify_matrix_item_import_adaptor',
        'shopify_item_import_adaptor',
        'shopify_customer_import_adaptor',
        'shopify_webhook_register_import_adaptor'
      ],
      modifications: [
        {
          condition: (importAdaptor) => {
            return importAdaptor && 
                   importAdaptor.http && 
                   importAdaptor.http.method && 
                   _.isArray(importAdaptor.http.method) && 
                   importAdaptor.http.method.length === 2 && 
                   (importAdaptor.http.method.includes('PUT') && importAdaptor.http.method.includes('POST'))
          },
          action: 'custom',
          handler: (importAdaptor) => {
            const requestType = ['UPDATE', 'CREATE']
            
            if (importAdaptor.http) {
              importAdaptor.http.requestType = requestType
            }
            
            if (importAdaptor.rest && 
                importAdaptor.rest.method && 
                _.isArray(importAdaptor.rest.method) && 
                importAdaptor.rest.method.length === 2 && 
                (importAdaptor.rest.method.includes('PUT') && importAdaptor.rest.method.includes('POST'))) {
              importAdaptor.rest.requestType = requestType
            }
          }
        }
      ]
    }
  ]
}

/**
 * Configuration for updateDigitalItems.js
 * Updates fulfillment adapters for digital items handling
 */
const updateDigitalItemsConfig = {
  operationName: 'updateDigitalItems',
  operations: [
    {
      type: 'resourceUpdate',
      resourceType: 'flows',
      externalIds: ['shopify_netsuite_fulfillment_export_flow'],
      modifications: [
        {
          condition: (adaptor) => {
            return adaptor && 
                   adaptor._integrationId && 
                   adaptor.externalId === 'shopify_netsuite_fulfillment_export_flow' &&
                   adaptor.pageProcessors && 
                   adaptor.pageProcessors.length > 0 && 
                   adaptor.pageProcessors[0] && 
                   adaptor.pageProcessors[1]
          },
          action: 'custom',
          handler: (adaptor) => {
            // Add PostResponseMapHook to page processors
            adaptor.pageProcessors[0].hooks = {
              postResponseMap: {
                _scriptId: CONSTANTS.POST_RESPONSE_MAP_SCRIPT_ID,
                function: 'syncItemFulfillments'
              }
            }
            adaptor.pageProcessors[1].hooks = {
              postResponseMap: {
                _scriptId: CONSTANTS.POST_RESPONSE_MAP_SCRIPT_ID,
                function: 'updateFulfillmentOrderLocation'
              }
            }
          }
        }
      ]
    },
    {
      type: 'resourceUpdate',
      resourceType: 'imports',
      externalIds: [
        'shopify_fulfillment_order_import_adaptor', 
        'shopify_fulfillment_order_import_location_adaptor', 
        'shopify_fulfillment_import_adaptor'
      ],
      modifications: [
        {
          condition: (adaptor) => {
            return (adaptor.externalId === 'shopify_fulfillment_order_import_adaptor' || 
                    adaptor.externalId === 'shopify_fulfillment_import_adaptor') && 
                   (adaptor.pathToMany !== '0.finalFulfillmentData' || adaptor.oneToMany !== true)
          },
          action: 'custom',
          handler: (adaptor) => {
            adaptor.oneToMany = true
            adaptor.pathToMany = '0.finalFulfillmentData'
          }
        },
        {
          condition: (adaptor) => {
            return adaptor.externalId === 'shopify_fulfillment_order_import_location_adaptor' && 
                   adaptor.filter
          },
          action: 'delete',
          path: 'filter'
        }
      ]
    }
  ]
}

/**
 * Configuration for addExternalId.js
 * Adds external IDs to import adaptors and updates flow names
 */
const addExternalIdConfig = {
  operationName: 'addExternalId',
  requiredFields: [
    'settings.commonresources',
    'settings.sections', 
    'settings.storemap',
    'settings.connectorEdition',
    'settings.general'
  ],
  operations: [
    {
      type: 'restApiCall',
      requestOptions: {
        resourcetype: 'imports'
      },
      responseHandler: function(err, response, imports, callback) {
        if (err) return callback(err)
        if (!imports || imports.length < 1) return callback(new Error('Unable to fetch the imports'))
        
        const that = this
        
        async.eachSeries(imports, function (importAdaptor, eachCallback) {
          if (!importAdaptor.externalId) {
            // Add external ID to cancellation import adaptor
            if (importAdaptor?.http?.relativeURI?.[0]?.includes('orders/{{{shopify_order_id}}}/cancel.json')) {
              importAdaptor.externalId = 'shopify_cancellation_import_adaptor'
              importAdaptor.name = 'Update order status in Shopify'
              
              installerUtils.integratorRestClient({
                bearerToken: that._bearerToken,
                resourcetype: 'imports',
                id: importAdaptor._id,
                data: importAdaptor
              }, function (err, response, body) {
                if (err) {
                  installerUtils.logInSplunk('Error while updating the import adaptor with externalId', 'info')
                  return eachCallback(err)
                }
                return eachCallback()
              })
            } else {
              return eachCallback()
            }
          } else {
            return eachCallback()
          }
        }, function(err) {
          if (err) return callback(err)
          
          // Update flow adaptors
          const integration = that._integration
          async.eachSeries(integration.settings.sections, function (storeSection, eachInternalCallback) {
            if (storeSection.shopInstallComplete && storeSection.title) {
              // Update Kit Flow Adapter
              updateConnectorUtil.modifyAdaptor({
                resourceType: 'flows',
                adaptorName: 'NetSuite Kit Inventory to Shopify Inventory Add/Update [' + storeSection.title + ']',
                migrationThis: that,
                helperMethod: function(flow) {
                  if (flow) {
                    flow.externalId = 'shopify_netsuite_kit_inventory_export_flow'
                    flow.name = flow.name?.replace('NetSuite Kit Inventory to Shopify Inventory Add/Update', 'NetSuite kit and item group inventory to Shopify inventory (add or update)')
                  }
                  return flow
                }
              }, function (err) {
                if (err) return eachInternalCallback(err)
                
                // Update Delete Variant Flow Adapter
                updateConnectorUtil.modifyAdaptor({
                  resourceType: 'flows',
                  adaptorName: 'Updates Deleted Products | Shopify Products to NetSuite Item [' + storeSection.title + ']',
                  migrationThis: that,
                  helperMethod: function(flow) {
                    if (flow) {
                      flow.externalId = 'shopify_deleted_variants_import_flow'
                      flow.name = flow.name?.replace('Updates Deleted Products | Shopify Products to NetSuite Item', 'Shopify inactive products to NetSuite catalog list and custom record (delete)')
                    }
                    return flow
                  }
                }, eachInternalCallback)
              })
            } else {
              return eachInternalCallback()
            }
          }, callback)
        })
      }
    }
  ]
}

// Export all configurations
module.exports = {
  removeDuplicateSetting: createUpdateHandler(removeDuplicateSettingConfig),
  addGatewaysSetting: createUpdateHandler(addGatewaysSettingConfig),
  updateAdaptorRequestType: createUpdateHandler(updateAdaptorRequestTypeConfig),
  updateDigitalItems: createUpdateHandler(updateDigitalItemsConfig),
  addExternalId: createUpdateHandler(addExternalIdConfig),
  
  // Export configurations for testing/debugging
  configs: {
    removeDuplicateSettingConfig,
    addGatewaysSettingConfig,
    updateAdaptorRequestTypeConfig,
    updateDigitalItemsConfig,
    addExternalIdConfig
  }
}
