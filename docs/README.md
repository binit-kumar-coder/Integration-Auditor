# Integration Auditor - Enterprise Grade

## Overview

The Integration Auditor is an enterprise-grade, data-driven CSV integration corruption detection and remediation system built with `json-rules-engine`. It provides complete business user control over all validation logic through JSON configuration files.

## Key Features

- 🔧 **100% Data-Driven**: All business logic in JSON configuration files
- 📊 **CSV Processing**: High-performance processing of large CSV datasets  
- 🛡️ **Enterprise Safety**: Circuit breakers, maintenance windows, approval workflows
- 📋 **Business Control**: Non-technical users can modify all validation rules
- 🔄 **Complete Rollback**: Automatic restore bundle generation
- 📈 **Comprehensive Reporting**: Executive, technical, and compliance reports

## Architecture

### Data-Driven Design
```
CSV Data → Business Config (JSON) → Rule Engine → Remediation Actions
```

All business logic is externalized to JSON configuration files:
- **Edition requirements** (imports/exports/flows per store)
- **License validation rules**
- **Required property validation**  
- **Remediation action templates**
- **Safety and approval rules**

### Enterprise Components

1. **Data-Driven Corruption Detector** - Uses JSON business rules
2. **Data-Driven Remediation Engine** - Uses JSON remediation templates
3. **CSV Processor** - High-performance tier1/tier2 data processing
4. **Safety Controller** - Enterprise safety and approval controls
5. **Audit Logger** - Complete change tracking and rollback

## Quick Start

### Installation
```bash
npm install
npm run build
```

### Basic Usage
```bash
# Audit tier1 integrations
integration-auditor audit --tier tier1 --dry-run

# Show business configuration
integration-auditor config --show

# View edition requirements
integration-auditor business-rules --edition premium

# Check system status
integration-auditor status
```

## Business User Control

### Modify Edition Requirements
Edit `config/business-rules.json`:
```json
{
  "editionRequirements": {
    "premium": {
      "importsPerStore": 30,  // Business user can change this
      "exportsPerStore": 32,
      "flowsPerStore": 25
    }
  }
}
```

### Modify Validation Rules
Edit `config/business-rules.json`:
```json
{
  "licenseValidation": {
    "validEditions": ["starter", "premium"],  // Business control
    "maxSettingsSize": 2097152                // Business control
  }
}
```

### Modify Remediation Logic
Edit `config/remediation-logic.json`:
```json
{
  "actionTemplates": {
    "resourceCountAdjustment": {
      "rules": {
        "tooMany": {
          "action": "delete",           // Business control
          "strategy": "keep-most-recent" // Business control
        }
      }
    }
  }
}
```

## Configuration Files

| File | Purpose | Business Control |
|------|---------|------------------|
| `config/business-rules.json` | Core business validation logic | ✅ Full control |
| `config/remediation-logic.json` | Remediation action templates | ✅ Full control |
| `config/environments/production.json` | Production safety settings | ✅ Full control |
| `manifests/*/enhanced.json` | Edition-specific manifests | ✅ Full control |

## Enterprise Features

### Safety Controls
- Maintenance window enforcement
- Approval workflows for large operations
- Circuit breaker for failure protection
- Maximum action limits per integration

### Audit & Compliance
- Complete change tracking
- Restore bundle generation
- Operator identification
- Session-based rollback

### Reporting
- Executive summary reports
- Technical implementation reports
- Business impact analysis
- Compliance documentation

## Corruption Detection Functions

All implemented with business-configurable logic:

1. **identifyDuplicateResources()** - Edition-based resource count validation
2. **getOfflineConnections()** - Cross-references with active imports/exports  
3. **validateIAEditionAndLicense()** - License vs settings validation
4. **validateMissingProperties()** - Required configuration properties
5. **inUpdateProcess()** - Stuck update process detection

## Support

- Configuration modification guide: `docs/configuration-guide.md`
- Business user manual: `docs/business-user-guide.md`
- Technical documentation: `docs/technical-guide.md`
- Deployment guide: `docs/deployment-guide.md`

---

**Enterprise-grade integration auditing with complete business user control over all validation and remediation logic.**
