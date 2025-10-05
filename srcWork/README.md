# Unified Standalone Update Code Pattern

This directory contains a unified pattern for handling all standalone update code operations in the Shopify-NetSuite connector. Instead of maintaining separate files for each update operation, this system provides a single, configurable handler that can accommodate all use cases.

## 📁 Files Overview

- **`unifiedUpdateHandler.js`** - Core unified handler class
- **`updateConfigurations.js`** - Pre-configured handlers for existing update operations
- **`README.md`** - This documentation file

## 🎯 Benefits

1. **Single File Management** - All update logic centralized in one configurable system
2. **Consistent Error Handling** - Standardized validation and error reporting
3. **Reusable Components** - Common operations easily configured
4. **Type Safety** - Clear operation types prevent configuration errors
5. **Extensible** - Easy to add new operation types
6. **Maintainable** - Centralized logic reduces code duplication
7. **Testable** - Configuration-driven approach enables better testing

## 🚀 Quick Start

### Using Pre-configured Handlers

```javascript
// Replace existing standalone update code imports
const { removeDuplicateSetting, addGatewaysSetting, updateDigitalItems } = require('./srcWork/updateConfigurations')

// Use exactly like the original functions
removeDuplicateSetting.call(this, callback)
addGatewaysSetting.call(this, callback)
updateDigitalItems.call(this, callback)
```

### Creating Custom Update Handlers

```javascript
const { createUpdateHandler } = require('./srcWork/unifiedUpdateHandler')

const myCustomUpdate = createUpdateHandler({
  operationName: 'myCustomUpdate',
  operations: [
    {
      type: 'resourceUpdate',
      resourceType: 'imports',
      externalIds: ['my_import_adaptor'],
      modifications: [
        {
          action: 'set',
          path: 'someProperty',
          value: 'newValue'
        }
      ]
    }
  ]
})

// Use in your installer
myCustomUpdate.call(this, callback)
```

## 📋 Operation Types

### 1. Resource Update (`resourceUpdate`)

Updates flows, imports, or exports using the `updateConnectorUtil.modifyResource()` pattern.

```javascript
{
  type: 'resourceUpdate',
  resourceType: 'flows', // 'flows', 'imports', 'exports'
  externalIds: ['shopify_order_export_adaptor'], // Target specific resources
  modifications: [
    {
      condition: (resource) => resource.someProperty === 'value', // Optional condition
      action: 'set', // 'set', 'delete', 'merge', 'custom'
      path: 'property.path',
      value: 'newValue'
    }
  ]
}
```

### 2. Settings Update (`settingsUpdate`)

Modifies integration settings at various scopes.

```javascript
{
  type: 'settingsUpdate',
  scope: 'allStores', // 'allStores', 'specificStore', 'global'
  changes: [
    {
      sectionPath: [
        { type: 'find', condition: s => s.title === 'Order' },
        'sections',
        { type: 'find', condition: s => s.title === 'Payment' }
      ],
      action: 'addField', // 'addField', 'removeField', 'updateField', 'custom'
      field: {
        label: 'My New Setting',
        type: 'checkbox',
        name: 'my_new_setting',
        value: false
      }
    }
  ]
}
```

### 3. Custom Logic (`customLogic`)

Executes custom JavaScript functions with full access to the integration context.

```javascript
{
  type: 'customLogic',
  logic: function(callback) {
    const integration = this._integration
    const integrationId = this._integrationId
    
    // Your custom logic here
    // Modify integration object directly
    
    callback(null, integration)
  }
}
```

### 4. REST API Call (`restApiCall`)

Makes calls to the integrator REST API.

```javascript
{
  type: 'restApiCall',
  requestOptions: {
    resourcetype: 'imports',
    method: 'GET'
  },
  responseHandler: function(err, response, body, callback) {
    if (err) return callback(err)
    
    // Process the response
    // this._integration, this._integrationId, this._bearerToken available
    
    callback(null, body)
  }
}
```

### 5. Integration Modification (`integrationModification`)

Direct modifications to the integration object.

```javascript
{
  type: 'integrationModification',
  modifications: [
    {
      action: 'filter', // 'set', 'delete', 'merge', 'filter', 'compact', 'custom'
      path: 'settings.general',
      condition: (item) => item !== null
    },
    {
      action: 'compact',
      path: 'settings.general'
    }
  ]
}
```

## 🔧 Advanced Configuration

### Conditional Operations

```javascript
{
  type: 'resourceUpdate',
  resourceType: 'imports',
  modifications: [
    {
      condition: (resource) => {
        return resource.externalId === 'specific_adaptor' && 
               resource.someProperty === 'expectedValue'
      },
      action: 'custom',
      handler: (resource) => {
        // Complex modification logic
        resource.newProperty = calculateValue(resource)
      }
    }
  ]
}
```

### Placeholder Replacement

```javascript
{
  type: 'settingsUpdate',
  scope: 'allStores',
  changes: [
    {
      sectionPath: ['sections'],
      action: 'addField',
      field: {
        name: 'imports_{importId}_newSetting', // {importId} will be replaced
        label: 'Setting for store {index}' // {index} will be replaced
      }
    }
  ]
}
```

### Error Handling

```javascript
{
  type: 'customLogic',
  logic: function(callback) {
    try {
      // Your logic here
      callback(null, result)
    } catch (error) {
      // Errors are automatically logged with operation context
      callback(error)
    }
  }
}
```

## 🔄 Migration Guide

### From Existing Standalone Files

1. **Identify the operation type** in your existing file
2. **Extract the core logic** into the appropriate operation configuration
3. **Replace the function call** with the new unified handler
4. **Test thoroughly** to ensure identical behavior

### Example Migration

**Before (removeDuplicateSetting.js):**
```javascript
const removeDuplicateSetting = function (callback) {
  // ... validation logic
  // ... duplicate removal logic
  callback(null, integration)
}
```

**After (using unified pattern):**
```javascript
const removeDuplicateSetting = createUpdateHandler({
  operationName: 'removeDuplicateSetting',
  operations: [
    {
      type: 'customLogic',
      logic: function(callback) {
        // Same duplicate removal logic
        callback(null, this._integration)
      }
    }
  ]
})
```

## 🧪 Testing

### Unit Testing Configuration

```javascript
const { UnifiedUpdateHandler } = require('./unifiedUpdateHandler')

describe('Unified Update Handler', () => {
  it('should handle resource updates', (done) => {
    const config = {
      operationName: 'testUpdate',
      operations: [
        {
          type: 'resourceUpdate',
          resourceType: 'imports',
          modifications: [
            { action: 'set', path: 'testProperty', value: 'testValue' }
          ]
        }
      ]
    }
    
    const handler = new UnifiedUpdateHandler(config)
    const mockContext = {
      _integration: { /* mock integration */ },
      _integrationId: 'test-id',
      _bearerToken: 'test-token'
    }
    
    handler.execute.call(mockContext, (err, result) => {
      expect(err).toBeNull()
      // Assert expected changes
      done()
    })
  })
})
```

## 📝 Best Practices

1. **Use descriptive operation names** for better logging and debugging
2. **Validate inputs** in custom logic functions
3. **Handle errors gracefully** with proper error messages
4. **Test configurations** thoroughly before deployment
5. **Document complex logic** within custom handlers
6. **Use conditions** to prevent unnecessary modifications
7. **Keep operations atomic** - each operation should be independent

## 🔍 Debugging

### Enable Detailed Logging

The unified handler automatically logs:
- Operation start/completion
- Validation errors
- Exception details with operation context

### Common Issues

1. **Missing required fields** - Check `requiredFields` configuration
2. **Section not found** - Verify `sectionPath` configuration
3. **Condition not met** - Check condition functions return boolean values
4. **API errors** - Verify bearer token and request options

## 🚀 Future Enhancements

- **State management** for complex multi-step operations
- **Rollback capabilities** for failed operations
- **Parallel operation execution** for independent operations
- **Configuration validation** at runtime
- **Performance metrics** and monitoring

## 📞 Support

For questions or issues with the unified update pattern:
1. Check this documentation
2. Review existing configurations in `updateConfigurations.js`
3. Test with simplified configurations
4. Contact the development team for complex scenarios
