# Integration Auditor - Enterprise Edition

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)

**Enterprise-grade data-driven CSV integration auditor with complete business user control over all validation and remediation logic.**

## 🎯 Key Features

- **🔧 100% Data-Driven**: All business logic in JSON configuration files
- **📊 High-Performance CSV Processing**: Handles 630+ integrations in ~5 seconds
- **🛡️ Enterprise Safety Controls**: Circuit breakers, maintenance windows, approval workflows
- **📋 Complete Business Control**: Non-technical users modify all validation rules
- **🔄 Automatic Rollback**: Complete restore bundle generation for every change
- **📈 Comprehensive Reporting**: Executive, technical, and compliance reports

## 🚀 Quick Start

### Installation
```bash
npm install
npm run build
```

### Basic Usage
```bash
# Check system status
integration-auditor status

# View business configuration
integration-auditor config --show

# Audit integrations (dry run)
integration-auditor audit --tier tier1 --dry-run

# View edition requirements
integration-auditor business-rules --edition premium
```

### Enterprise Deployment
```bash
# Deploy to production
npm run deploy production

# Deploy to development
npm run deploy development
```

## 🏗️ Architecture

### Data-Driven Design
```
CSV Data → Business Config (JSON) → Rules Engine → Remediation Actions
```

**Complete separation of business logic from implementation:**
- **Business Logic**: 100% in JSON configuration files
- **Implementation**: TypeScript execution framework only
- **Modification**: Business users edit JSON, no code changes required

## 📁 Project Structure

```
integration-auditor/
├── config/                          # Business Configuration (Business Control)
│   ├── business-rules.json          # Core business validation logic
│   ├── remediation-logic.json       # Remediation action templates  
│   ├── environments/
│   │   ├── production.json          # Production safety settings
│   │   └── development.json         # Development settings
│   └── schemas/                     # JSON Schema validation
├── src/                             # Implementation (Technical)
│   ├── cli-data-driven.ts          # Main CLI interface
│   ├── rules/                      # Data-driven rule engines
│   ├── csv/                        # CSV processing
│   ├── audit/                      # Audit logging
│   └── safety/                     # Safety controls
├── manifests/                       # Enhanced Manifests (Business Control)
│   └── */enhanced.json             # Edition-specific validation rules
├── docs/                           # Enterprise Documentation
│   ├── README.md                   # Technical overview
│   └── business-user-guide.md      # Business user manual
├── examples/                       # Configuration Examples
└── scripts/                        # Deployment Scripts
    └── deployment.sh               # Enterprise deployment
```

## 🔧 Corruption Detection Functions

All functions implemented with **business-configurable logic**:

| Function | Purpose | Business Control |
|----------|---------|------------------|
| `identifyDuplicateResources()` | Edition-based resource count validation | ✅ Edition requirements configurable |
| `getOfflineConnections()` | Offline connections with active imports/exports | ✅ Detection rules configurable |
| `validateIAEditionAndLicense()` | License vs settings validation | ✅ Valid editions configurable |
| `validateMissingProperties()` | Required configuration properties | ✅ Property lists configurable |
| `inUpdateProcess()` | Stuck update process detection | ✅ Detection criteria configurable |

## 📊 Business User Control

### Edition Requirements Control
```json
// config/business-rules.json
{
  "editionRequirements": {
    "premium": {
      "importsPerStore": 32,  ← Business user controls
      "exportsPerStore": 32,  ← Business user controls
      "flowsPerStore": 27     ← Business user controls
    }
  }
}
```

### Validation Rules Control
```json
// config/business-rules.json
{
  "licenseValidation": {
    "validEditions": ["starter", "premium"],  ← Business user controls
    "maxSettingsSize": 1048576                ← Business user controls
  }
}
```

### Remediation Logic Control
```json
// config/remediation-logic.json
{
  "actionTemplates": {
    "resourceCountAdjustment": {
      "rules": {
        "tooMany": {
          "action": "delete",           ← Business user controls
          "strategy": "keep-most-recent" ← Business user controls
        }
      }
    }
  }
}
```

## 🛡️ Enterprise Safety

### Production Safety Controls
- **Maintenance Windows**: Configurable time-based execution control
- **Approval Workflows**: Automatic approval requirements for large operations
- **Circuit Breaker**: Automatic failure protection
- **Batch Processing**: Configurable concurrent operation limits

### Audit & Compliance
- **Complete Change Tracking**: Every action logged with operator ID
- **Restore Bundles**: Automatic rollback data generation
- **Session Management**: Grouped operations for easy rollback
- **Compliance Reporting**: Automated compliance documentation

## 📈 Reporting

### Executive Reports
- **Corruption rate analysis**
- **Business impact assessment** 
- **Risk level classification**
- **Recommended actions**

### Technical Reports
- **Detailed corruption breakdown**
- **Remediation action plans**
- **Execution time estimates**
- **Rollback procedures**

### Compliance Reports
- **Change audit trails**
- **Operator identification**
- **Approval workflow documentation**
- **Regulatory compliance data**

## 🚀 Enterprise Features

### Scalability
- **High-Performance Processing**: 630+ integrations in ~5 seconds
- **Batch Processing**: Configurable concurrent execution
- **Memory Efficient**: Streaming CSV processing
- **Large Dataset Support**: Handles enterprise-scale data

### Reliability
- **Circuit Breaker**: Automatic failure protection
- **Retry Logic**: Configurable retry strategies
- **Error Isolation**: Graceful degradation
- **Health Monitoring**: System status reporting

### Security
- **Operator Identification**: All actions tracked to users
- **Approval Controls**: Large operations require confirmation
- **Audit Logging**: Complete change history
- **Configuration Validation**: Schema-based config validation

## 📚 Documentation

- **[Business User Guide](docs/business-user-guide.md)** - For business stakeholders
- **[Configuration Examples](examples/business-config-examples.md)** - Common scenarios
- **[Technical Documentation](docs/)** - For developers and operations

## 🎯 Business Value

### For Business Teams
- **Direct Control**: Modify all business logic via JSON files
- **No Development Dependency**: Change rules without developer involvement
- **Immediate Effect**: Configuration changes take effect on next run
- **Version Controlled**: All business rule changes tracked in Git

### For Technical Teams  
- **Clean Architecture**: Business logic completely separated from implementation
- **Maintainable Code**: TypeScript handles only execution, not business rules
- **Extensible Design**: Easy to add new corruption types and remediation strategies
- **Enterprise Ready**: Production-grade safety, logging, and monitoring

### For Operations Teams
- **Predictable Behavior**: All behavior defined in readable JSON configuration
- **Safety Controls**: Multiple layers of protection against operational errors
- **Complete Rollback**: Automatic restore capability for emergency recovery
- **Comprehensive Monitoring**: Full audit trails and health reporting

## 📞 Support

### Business Configuration Support
- Review: `integration-auditor config --show`
- Validate: `integration-auditor config --validate`
- Examples: See `examples/business-config-examples.md`

### Technical Support
- Status: `integration-auditor status`
- Logs: Check `./audit-logs/` directory
- Health: Monitor system status reports

---

**Enterprise-grade integration auditing with complete business user control over all validation and remediation logic.**

## License

MIT © Integration Team
