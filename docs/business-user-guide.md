# Business User Guide - Integration Auditor

## Overview for Business Users

The Integration Auditor allows **business users to control all validation and remediation logic** without requiring any code changes. All business rules are stored in JSON configuration files that can be modified by business stakeholders.

## What You Can Control

### 1. Edition Requirements (`config/business-rules.json`)

**What it controls**: How many imports, exports, and flows each integration edition should have per store.

**Example**: If business decides premium integrations should have 30 imports per store instead of 32:

```json
{
  "editionRequirements": {
    "premium": {
      "importsPerStore": 30,  ← Change this number
      "exportsPerStore": 32,
      "flowsPerStore": 27
    }
  }
}
```

**Impact**: All premium integrations will now be validated against 30 imports per store.

### 2. License Validation (`config/business-rules.json`)

**What it controls**: Which license editions are valid and size limits for processing.

```json
{
  "licenseValidation": {
    "validEditions": ["starter", "premium"],  ← Add/remove editions
    "maxSettingsSize": 1048576                ← Change size limit
  }
}
```

### 3. Required Properties (`config/business-rules.json`)

**What it controls**: Which configuration properties are mandatory for integrations.

```json
{
  "requiredProperties": {
    "commonresources": [
      "netsuiteConnectionId",           ← Add/remove properties
      "nsUtilImportAdaptorId"          ← Business controls this list
    ]
  }
}
```

### 4. Remediation Actions (`config/remediation-logic.json`)

**What it controls**: How the system fixes detected issues.

```json
{
  "actionTemplates": {
    "resourceCountAdjustment": {
      "rules": {
        "tooMany": {
          "action": "delete",           ← Change to "archive" or "disable"
          "strategy": "keep-most-recent" ← Change strategy
        }
      }
    }
  }
}
```

## Common Business Scenarios

### Scenario 1: New Edition Requirements
**Business Need**: Premium edition now requires 35 imports per store

**Action**: 
1. Edit `config/business-rules.json`
2. Change `premium.importsPerStore` from 32 to 35
3. Run audit - system will now detect integrations with < 35 imports as corrupted

### Scenario 2: Change Validation Strictness
**Business Need**: Allow small variance in resource counts

**Action**:
1. Edit `config/business-rules.json` 
2. Change `tolerances.resourceCountTolerance` from 0 to 2
3. System will now allow ±2 variance in resource counts

### Scenario 3: Add New Required Property
**Business Need**: All integrations must have a new configuration property

**Action**:
1. Edit `config/business-rules.json`
2. Add new property to `requiredProperties.settingsLevel`
3. System will detect integrations missing this property

### Scenario 4: Change Remediation Strategy
**Business Need**: Instead of deleting excess resources, archive them

**Action**:
1. Edit `config/remediation-logic.json`
2. Change `resourceCountAdjustment.rules.tooMany.action` from "delete" to "archive"
3. Generated scripts will now archive instead of delete

## Safety Features for Business Users

### Approval Requirements
Business users can control when approval is required:
```json
{
  "safety": {
    "requireConfirmationAbove": 50  ← Business sets threshold
  }
}
```

### Maintenance Windows
Business users can enforce maintenance windows:
```json
{
  "safety": {
    "maintenanceWindow": {
      "start": "02:00",     ← Business sets window
      "end": "06:00",       ← Business sets window
      "days": ["sunday"]    ← Business chooses days
    }
  }
}
```

## Validation and Testing

### Before Making Changes
1. **Backup current config**: Copy current JSON files
2. **Test on small dataset**: Use development environment
3. **Validate changes**: Run `integration-auditor config --validate`

### After Making Changes
1. **Run dry-run**: Test with `--dry-run` flag first
2. **Review reports**: Check generated reports before execution
3. **Monitor execution**: Watch for unexpected results

## Business Impact Assessment

### Understanding Corruption Types

| Corruption Type | Business Impact | Urgency |
|----------------|----------------|---------|
| Resource Count Issues | Data flow problems | Medium |
| License Mismatches | Compliance issues | Medium |
| Missing Properties | Integration failures | High |
| Offline Connections | Data flow blocked | Critical |
| Stuck Updates | Operations blocked | Critical |

### Reading Reports

**Executive Summary**: High-level business metrics
- Corruption rate percentage
- Total integrations affected
- Business impact classification

**Technical Report**: Implementation details
- Specific corrupted integrations
- Detailed remediation actions
- Execution time estimates

## Getting Help

### For Business Rule Changes
1. Review current configuration: `integration-auditor config --show`
2. Check edition requirements: `integration-auditor business-rules --edition premium`
3. Validate changes: `integration-auditor config --validate`

### For Understanding Results
1. Review executive summary in generated reports
2. Check business impact analysis section
3. Review recommended actions

### Escalation
- **Configuration Questions**: Technical team
- **Business Rule Questions**: Integration team  
- **Validation Issues**: Business analyst team

---

**Remember**: All changes to JSON configuration files take effect immediately on the next audit run. No code deployment required!
