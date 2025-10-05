# Business Configuration Examples

## Common Business Scenarios

### 1. Adding a New Integration Edition

**Scenario**: Business introduces a new "enterprise" edition

**Solution**: Add to `config/business-rules.json`:
```json
{
  "editionRequirements": {
    "enterprise": {
      "importsPerStore": 50,
      "exportsPerStore": 45,
      "flowsPerStore": 35,
      "description": "Enterprise edition with advanced features"
    }
  }
}
```

### 2. Changing Resource Requirements

**Scenario**: Premium edition now requires more imports

**Solution**: Modify `config/business-rules.json`:
```json
{
  "editionRequirements": {
    "premium": {
      "importsPerStore": 35,  // Changed from 32
      "exportsPerStore": 32,
      "flowsPerStore": 27
    }
  }
}
```

### 3. Adding New Required Properties

**Scenario**: All integrations must have a new webhook configuration

**Solution**: Update `config/business-rules.json`:
```json
{
  "requiredProperties": {
    "settingsLevel": [
      "connectorEdition",
      "commonresources", 
      "webhookConfig"  // New requirement
    ]
  }
}
```

### 4. Changing Remediation Strategy

**Scenario**: Instead of deleting excess resources, archive them

**Solution**: Modify `config/remediation-logic.json`:
```json
{
  "actionTemplates": {
    "resourceCountAdjustment": {
      "rules": {
        "tooMany": {
          "action": "archive",  // Changed from "delete"
          "strategy": "keep-most-recent",
          "reason": "Archive excess {resourceType} to match {edition} requirements"
        }
      }
    }
  }
}
```

### 5. Adjusting Safety Thresholds

**Scenario**: Require approval for operations affecting more than 25 integrations

**Solution**: Update `config/environments/production.json`:
```json
{
  "safety": {
    "requireConfirmationAbove": 25,  // Changed from 100
    "maxActionsPerIntegration": 150,
    "enableCircuitBreaker": true
  }
}
```

### 6. Modifying Tolerance Levels

**Scenario**: Allow ±3 variance in resource counts

**Solution**: Change `config/business-rules.json`:
```json
{
  "tolerances": {
    "resourceCountTolerance": 3  // Changed from 0 (exact match)
  }
}
```

## Environment-Specific Configurations

### Development Environment
```json
{
  "environment": "development",
  "safety": {
    "requireConfirmationAbove": 5,
    "enableCircuitBreaker": false
  },
  "validation": {
    "strictModeEnabled": false
  }
}
```

### Production Environment  
```json
{
  "environment": "production",
  "safety": {
    "requireConfirmationAbove": 100,
    "enableCircuitBreaker": true,
    "maintenanceWindowRequired": true
  },
  "validation": {
    "strictModeEnabled": true
  }
}
```

## Testing Configuration Changes

### 1. Backup Current Configuration
```bash
cp config/business-rules.json config/business-rules.json.backup
```

### 2. Make Changes
Edit the JSON files with your preferred editor

### 3. Validate Changes
```bash
integration-auditor config --validate
```

### 4. Test with Dry Run
```bash
integration-auditor audit --tier tier1 --dry-run
```

### 5. Review Impact
Check the generated reports to understand the impact of your changes

## Configuration File Relationships

```
config/business-rules.json
├── Controls corruption detection logic
├── Defines edition requirements  
├── Sets validation thresholds
└── Used by: DataDrivenCorruptionDetector

config/remediation-logic.json  
├── Controls remediation action generation
├── Defines action templates
├── Sets execution strategy
└── Used by: DataDrivenRemediationEngine

config/environments/production.json
├── Controls production safety settings
├── Sets operational parameters
├── Defines maintenance windows
└── Used by: CLI and deployment scripts

manifests/*/enhanced.json
├── Edition-specific validation rules
├── Business validation logic
├── Compliance requirements  
└── Used by: Business validation processes
```

## Best Practices

### 1. Version Control
- Always commit configuration changes to Git
- Use descriptive commit messages for business rule changes
- Tag configuration versions for easy rollback

### 2. Testing
- Test configuration changes in development environment first
- Use dry-run mode to preview impact
- Validate with small datasets before full deployment

### 3. Documentation
- Document business reasoning for configuration changes
- Include change approval information
- Update business user guides when adding new configuration options

### 4. Rollback Plan
- Keep backup copies of working configurations
- Document rollback procedures
- Test rollback scenarios regularly

---

**Remember**: All configuration changes take effect immediately on the next audit run. No code deployment or restart required!
