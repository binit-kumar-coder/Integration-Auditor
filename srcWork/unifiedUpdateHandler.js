'use strict'

const updateConnectorUtil = require('@celigo/abstract-connector').updateConnectorUtil
const installerUtils = require('@celigo/connector-utils').installerUtils
const async = require('async')
const _ = require('lodash')
const logger = require('winston')

/**
 * Unified Standalone Update Code Handler
 * Supports all types of update operations through configuration
 * 
 * Usage:
 * const { createUpdateHandler } = require('./unifiedUpdateHandler')
 * const myUpdate = createUpdateHandler(config)
 * myUpdate.call(this, callback)
 */
class UnifiedUpdateHandler {
  constructor(config) {
    this.config = config
    this.operationName = config.operationName || 'UnifiedUpdate'
    this.requiredFields = config.requiredFields || [
      'settings.commonresources',
      'settings.sections', 
      'settings.storemap',
      'settings.connectorEdition'
    ]
  }

  /**
   * Main execution function
   * @param {Function} callback - Completion callback
   */
  execute(callback) {
    const that = this
    const integration = that._integration
    const integrationId = that._integrationId

    try {
      // Standard logging
      installerUtils.logInSplunk(
        `integrationId: ${integration._id} updatelogic ${this.operationName} ${integration?.settings?.connectorEdition}`, 
        'info'
      )

      // Standard validation
      const validationResult = this.validateIntegration(integration, integrationId)
      if (validationResult.error) {
        return callback(new Error(validationResult.error))
      }

      // Execute operations based on configuration
      this.executeOperations(that, callback)

    } catch (e) {
      installerUtils.logInSplunk(
        `Exception occurred while executing ${this.operationName} Error = ${e.message}`, 
        'info'
      )
      return callback(e)
    }
  }

  /**
   * Validate integration structure
   * @param {Object} integration - Integration object
   * @param {String} integrationId - Integration ID
   * @returns {Object} Validation result
   */
  validateIntegration(integration, integrationId) {
    // Check basic integration structure
    if (!integration || !integration._id || !integration.settings) {
      return {
        error: `Integration with integrationId=${integrationId} is corrupted, Missing basic integration structure. Please contact Celigo Support`
      }
    }

    // Check required fields
    for (const field of this.requiredFields) {
      if (!_.get(integration, field)) {
        return {
          error: `Integration with integrationId=${integrationId} is corrupted, Missing ${field}. Please contact Celigo Support`
        }
      }
    }

    return { valid: true }
  }

  /**
   * Execute operations based on configuration
   * @param {Object} that - Context object with _integration, _integrationId, _bearerToken
   * @param {Function} callback - Completion callback
   */
  executeOperations(that, callback) {
    const operations = this.config.operations || []
    
    async.series(operations.map(operation => {
      return (seriesCallback) => {
        this.executeOperation(that, operation, seriesCallback)
      }
    }), callback)
  }

  /**
   * Execute individual operation
   * @param {Object} that - Context object
   * @param {Object} operation - Operation configuration
   * @param {Function} callback - Operation callback
   */
  executeOperation(that, operation, callback) {
    switch (operation.type) {
      case 'resourceUpdate':
        this.handleResourceUpdate(that, operation, callback)
        break
      case 'settingsUpdate':
        this.handleSettingsUpdate(that, operation, callback)
        break
      case 'customLogic':
        this.handleCustomLogic(that, operation, callback)
        break
      case 'restApiCall':
        this.handleRestApiCall(that, operation, callback)
        break
      case 'integrationModification':
        this.handleIntegrationModification(that, operation, callback)
        break
      default:
        callback(new Error(`Unknown operation type: ${operation.type}`))
    }
  }

  /**
   * Handle resource updates (flows, imports, exports)
   */
  handleResourceUpdate(that, operation, callback) {
    const config = {
      resourceType: operation.resourceType,
      migrationThis: that,
      helperMethod: operation.helperMethod || this.createHelperMethod(operation)
    }

    // Add targeting options
    if (operation.externalIds) config.externalIds = operation.externalIds
    if (operation.adaptorName) config.adaptorName = operation.adaptorName
    if (operation.adaptorNames) config.adaptorNames = operation.adaptorNames

    updateConnectorUtil.modifyResource(config, callback)
  }

  /**
   * Handle settings updates
   */
  handleSettingsUpdate(that, operation, callback) {
    try {
      const integration = that._integration
      const sections = integration.settings.sections

      if (operation.scope === 'allStores') {
        this.updateAllStoreSettings(sections, operation, callback)
      } else if (operation.scope === 'specificStore') {
        this.updateSpecificStoreSettings(sections, operation, callback)
      } else if (operation.scope === 'global') {
        this.updateGlobalSettings(integration, operation, callback)
      } else {
        callback(new Error(`Unknown settings scope: ${operation.scope}`))
      }
    } catch (error) {
      callback(error)
    }
  }

  /**
   * Handle custom logic execution
   */
  handleCustomLogic(that, operation, callback) {
    if (typeof operation.logic === 'function') {
      try {
        operation.logic.call(that, callback)
      } catch (error) {
        callback(error)
      }
    } else {
      callback(new Error('Custom logic must be a function'))
    }
  }

  /**
   * Handle REST API calls
   */
  handleRestApiCall(that, operation, callback) {
    const requestOptions = {
      bearerToken: that._bearerToken,
      integrationId: that._integrationId,
      ...operation.requestOptions
    }

    installerUtils.integratorRestClient(requestOptions, (err, response, body) => {
      if (err) return callback(err)
      
      if (operation.responseHandler) {
        operation.responseHandler.call(that, err, response, body, callback)
      } else {
        callback(null, body)
      }
    })
  }

  /**
   * Handle direct integration modifications
   */
  handleIntegrationModification(that, operation, callback) {
    try {
      const integration = that._integration
      
      if (operation.modifications) {
        operation.modifications.forEach(mod => {
          switch (mod.action) {
            case 'set':
              _.set(integration, mod.path, mod.value)
              break
            case 'delete':
              _.unset(integration, mod.path)
              break
            case 'merge':
              _.merge(integration, mod.value)
              break
            case 'custom':
              if (typeof mod.handler === 'function') {
                mod.handler(integration)
              }
              break
            case 'filter':
              if (mod.path && mod.condition) {
                const array = _.get(integration, mod.path)
                if (Array.isArray(array)) {
                  _.set(integration, mod.path, array.filter(mod.condition))
                }
              }
              break
            case 'compact':
              if (mod.path) {
                const array = _.get(integration, mod.path)
                if (Array.isArray(array)) {
                  _.set(integration, mod.path, _.compact(array))
                }
              }
              break
          }
        })
      }
      
      callback(null, integration)
    } catch (error) {
      callback(error)
    }
  }

  /**
   * Create helper method for resource updates
   */
  createHelperMethod(operation) {
    return (resource) => {
      if (operation.modifications) {
        operation.modifications.forEach(mod => {
          if (mod.condition && !mod.condition(resource)) return

          switch (mod.action) {
            case 'set':
              _.set(resource, mod.path, mod.value)
              break
            case 'delete':
              _.unset(resource, mod.path)
              break
            case 'merge':
              _.merge(resource, mod.value)
              break
            case 'custom':
              if (typeof mod.handler === 'function') {
                mod.handler(resource)
              }
              break
            case 'skipUpdate':
              return { skipUpdate: true }
          }
        })
      }
      return resource
    }
  }

  /**
   * Update settings for all stores
   */
  updateAllStoreSettings(sections, operation, callback) {
    const errors = []

    sections.forEach((store, storeIndex) => {
      if (store && store.shopInstallComplete) {
        try {
          this.applySettingsChanges(store, operation.changes, storeIndex)
        } catch (error) {
          errors.push(`Store ${store.id}: ${error.message}`)
        }
      }
    })

    if (errors.length > 0) {
      return callback(new Error(errors.join('; ')))
    }
    callback()
  }

  /**
   * Update settings for specific store
   */
  updateSpecificStoreSettings(sections, operation, callback) {
    const store = sections.find(operation.storeCondition)
    if (!store) {
      return callback(new Error('Specified store not found'))
    }

    try {
      this.applySettingsChanges(store, operation.changes)
      callback()
    } catch (error) {
      callback(error)
    }
  }

  /**
   * Update global settings
   */
  updateGlobalSettings(integration, operation, callback) {
    try {
      this.applySettingsChanges(integration.settings, operation.changes)
      callback()
    } catch (error) {
      callback(error)
    }
  }

  /**
   * Apply settings changes to a store/section
   */
  applySettingsChanges(target, changes, index) {
    changes.forEach(change => {
      const section = this.findSection(target, change.sectionPath)
      if (!section && !change.optional) {
        throw new Error(`Section not found: ${JSON.stringify(change.sectionPath)}`)
      }
      if (!section) return

      switch (change.action) {
        case 'addField':
          if (!section.fields) section.fields = []
          // Replace placeholders in field configuration
          const field = this.replacePlaceholders(change.field, { index, section, target })
          section.fields.push(field)
          break
        case 'removeField':
          if (section.fields) {
            section.fields = section.fields.filter(field => 
              !change.condition(field)
            )
          }
          break
        case 'updateField':
          if (section.fields) {
            const field = section.fields.find(change.condition)
            if (field) {
              Object.assign(field, change.updates)
            }
          }
          break
        case 'custom':
          if (typeof change.handler === 'function') {
            change.handler(section, index)
          }
          break
      }
    })
  }

  /**
   * Replace placeholders in configuration
   */
  replacePlaceholders(obj, context) {
    if (typeof obj === 'string') {
      return obj.replace(/\{(\w+)\}/g, (match, key) => {
        return context[key] || match
      })
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.replacePlaceholders(item, context))
    }
    if (obj && typeof obj === 'object') {
      const result = {}
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replacePlaceholders(value, context)
      }
      return result
    }
    return obj
  }

  /**
   * Find section by path
   */
  findSection(root, path) {
    if (!path || path.length === 0) return root
    
    return path.reduce((current, segment) => {
      if (!current) return null
      
      if (typeof segment === 'string') {
        return current[segment]
      } else if (segment.type === 'find') {
        if (Array.isArray(current)) {
          return current.find(segment.condition)
        } else if (current.sections && Array.isArray(current.sections)) {
          return current.sections.find(segment.condition)
        }
      } else if (segment.type === 'filter') {
        if (Array.isArray(current)) {
          return current.filter(segment.condition)
        }
      }
      return null
    }, root)
  }
}

/**
 * Factory function to create update handlers
 * @param {Object} config - Configuration object
 * @returns {Function} Update handler function
 */
function createUpdateHandler(config) {
  return function(callback) {
    const handler = new UnifiedUpdateHandler(config)
    // Bind the context properly - copy properties from 'this' to handler
    handler._integration = this._integration
    handler._integrationId = this._integrationId
    handler._bearerToken = this._bearerToken
    
    handler.execute(callback)
  }
}

module.exports = { UnifiedUpdateHandler, createUpdateHandler }
