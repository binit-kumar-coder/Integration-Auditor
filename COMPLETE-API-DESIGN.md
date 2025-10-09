# Complete API Design - Integration Auditor

## 🎯 **CLI Commands → API Endpoints Mapping**

Based on the analysis of CLI commands, here's the complete API structure needed:

### **1. Fix Command → Remediation APIs**
**CLI:** `integration-auditor fix [options]`

| CLI Option | API Endpoint | Method | Description |
|------------|--------------|--------|-------------|
| `fix --dry-run` | `/api/fix/dry-run` | POST | Preview fixes without applying |
| `fix --apply` | `/api/fix/apply` | POST | Execute remediation plan |
| `fix --edition <edition>` | `/api/fix/by-edition/{edition}` | POST | Fix specific edition |
| `fix --allowlist <ids>` | `/api/fix/allowlist` | POST | Fix specific integration IDs |

### **2. Audit Command → Audit APIs**
**CLI:** `integration-auditor audit [options]`

| CLI Option | API Endpoint | Method | Description |
|------------|--------------|--------|-------------|
| `audit` | `/api/audit/run` | POST | Run corruption audit |
| `audit --tier <tier>` | `/api/audit/tier/{tier}` | POST | Audit specific tier |

### **3. State Command → State Management APIs**
**CLI:** `integration-auditor state [options]`

| CLI Option | API Endpoint | Method | Description |
|------------|--------------|--------|-------------|
| `state --show` | `/api/state` | GET | Show processing state |
| `state --cleanup` | `/api/state/cleanup` | POST | Clean old records |
| `state --export` | `/api/state/export` | GET | Export state data |
| `state --import` | `/api/state/import` | POST | Import state data |
| `state --reset` | `/api/state/reset` | DELETE | Reset all state |

### **4. Status Command → System APIs**
**CLI:** `integration-auditor status`

| CLI Option | API Endpoint | Method | Description |
|------------|--------------|--------|-------------|
| `status` | `/api/system/status` | GET | System status & config |
| N/A | `/api/system/health` | GET | Health check |
| N/A | `/api/system/version` | GET | Version info |

### **5. Config Command → Configuration APIs**
**CLI:** `integration-auditor config [options]`

| CLI Option | API Endpoint | Method | Description |
|------------|--------------|--------|-------------|
| `config --show` | `/api/config` | GET | Show current config |
| `config --validate` | `/api/config/validate` | POST | Validate config files |

### **6. Products Command → Product Management APIs**
**CLI:** `integration-auditor products [options]`

| CLI Option | API Endpoint | Method | Description |
|------------|--------------|--------|-------------|
| `products --list` | `/api/products` | GET | List all products |
| `products --product <name>` | `/api/products/{product}` | GET | Show product versions |

### **7. Business Rules Command → Business Rules APIs**
**CLI:** `integration-auditor business-rules [options]`

| CLI Option | API Endpoint | Method | Description |
|------------|--------------|--------|-------------|
| `business-rules` | `/api/business-rules` | GET | Show all rules |
| `business-rules --edition <ed>` | `/api/business-rules/edition/{edition}` | GET | Rules for edition |
| `business-rules --product <prod>` | `/api/business-rules/product/{product}` | GET | Rules for product |

## 🚀 **Complete API Endpoint Structure**

```
Integration Auditor API v1.0
├── 🏥 Health & System
│   ├── GET  /health
│   ├── GET  /api/system/status
│   ├── GET  /api/system/version
│   └── GET  /api/help
│
├── 🔧 Remediation & Fix
│   ├── POST /api/fix/dry-run
│   ├── POST /api/fix/apply  
│   ├── POST /api/fix/by-edition/{edition}
│   ├── POST /api/fix/allowlist
│   ├── GET  /api/remediation/queue
│   ├── GET  /api/remediation/stats
│   ├── POST /api/remediation/plans
│   ├── GET  /api/remediation/jobs/{jobId}
│   ├── POST /api/remediation/jobs/{jobId}/execute
│   ├── DELETE /api/remediation/jobs/{jobId}
│   └── POST /api/remediation/process
│
├── 🔍 Audit & Detection  
│   ├── POST /api/audit/run
│   ├── POST /api/audit/tier/{tier}
│   ├── GET  /api/audit/results
│   └── GET  /api/audit/corruptions
│
├── 📊 State Management
│   ├── GET  /api/state
│   ├── POST /api/state/cleanup
│   ├── GET  /api/state/export
│   ├── POST /api/state/import
│   └── DELETE /api/state/reset
│
├── ⚙️ Configuration
│   ├── GET  /api/config
│   ├── POST /api/config/validate
│   ├── PUT  /api/config/update
│   └── GET  /api/config/schema
│
├── 📦 Products & Versions
│   ├── GET  /api/products
│   ├── GET  /api/products/{product}
│   ├── GET  /api/products/{product}/versions
│   └── GET  /api/products/{product}/versions/{version}
│
└── 📝 Business Rules
    ├── GET  /api/business-rules
    ├── GET  /api/business-rules/edition/{edition}
    ├── GET  /api/business-rules/product/{product}
    ├── PUT  /api/business-rules/edition/{edition}
    └── POST /api/business-rules/validate
```

## 📋 **Detailed API Specifications**

### **Fix & Remediation APIs**

#### **POST /api/fix/dry-run**
```json
{
  "edition": "premium",
  "tier": "tier1", 
  "allowlist": ["integration1", "integration2"],
  "maxOpsPerIntegration": 100,
  "operatorId": "api-user"
}
```

#### **POST /api/fix/apply**
```json
{
  "edition": "premium",
  "tier": "tier1",
  "allowlist": ["integration1", "integration2"],
  "maxOpsPerIntegration": 100,
  "operatorId": "api-user",
  "forceConfirmation": true,
  "createRestoreBundle": true
}
```

### **Audit APIs**

#### **POST /api/audit/run**
```json
{
  "tier": "tier1",
  "edition": "premium",
  "inputPath": "./input",
  "configPath": "./config",
  "operatorId": "api-user"
}
```

### **State Management APIs**

#### **GET /api/state**
Response:
```json
{
  "totalProcessed": 1500,
  "byStatus": {
    "remediated": 800,
    "detected": 400,
    "failed": 50,
    "skipped": 250
  },
  "byOperator": {
    "user1": 600,
    "user2": 900
  },
  "dateRange": {
    "oldest": "2025-01-01T00:00:00Z",
    "newest": "2025-10-09T09:00:00Z"
  },
  "recentActivity": [...]
}
```

#### **POST /api/state/cleanup**
```json
{
  "olderThanDays": 30,
  "operatorId": "api-user"
}
```

### **Configuration APIs**

#### **GET /api/config**
Response:
```json
{
  "businessRules": {...},
  "remediationLogic": {...},
  "products": [...],
  "environments": [...]
}
```

#### **POST /api/config/validate**
```json
{
  "configType": "business-rules",
  "config": {...}
}
```

### **Products APIs**

#### **GET /api/products**
Response:
```json
{
  "products": [
    {
      "name": "shopify-netsuite",
      "versions": ["1.51.0", "1.50.0"],
      "description": "Shopify-NetSuite Integration"
    },
    {
      "name": "shopify-hubspot", 
      "versions": ["2.0.0"],
      "description": "Shopify-HubSpot Integration"
    }
  ]
}
```

### **Business Rules APIs**

#### **GET /api/business-rules/edition/{edition}**
Response:
```json
{
  "edition": "premium",
  "requirements": {
    "importsPerStore": 32,
    "exportsPerStore": 32,
    "flowsPerStore": 27
  },
  "validLicenses": ["starter", "standard", "premium"],
  "requiredProperties": [...]
}
```

## 🎯 **Implementation Priority**

### **Phase 1: Core APIs (Immediate)**
1. ✅ `/api/remediation/*` (Already implemented)
2. 🔄 `/api/fix/*` (High priority)
3. 🔄 `/api/audit/*` (High priority)
4. 🔄 `/api/state/*` (Medium priority)

### **Phase 2: Management APIs**
5. `/api/config/*`
6. `/api/business-rules/*`
7. `/api/products/*`

### **Phase 3: Advanced APIs**
8. `/api/system/*` (Enhanced)
9. Webhooks & Events
10. Batch operations

## 🔧 **Implementation Notes**

1. **Authentication**: Add API key/JWT authentication
2. **Rate Limiting**: Implement rate limiting per endpoint
3. **Validation**: JSON schema validation for all inputs
4. **Error Handling**: Consistent error response format
5. **Logging**: Comprehensive API request/response logging
6. **Documentation**: OpenAPI/Swagger documentation
7. **Versioning**: API versioning strategy (/api/v1/...)

## 🧪 **Testing Strategy**

1. **Unit Tests**: Each endpoint with various scenarios
2. **Integration Tests**: End-to-end workflows
3. **Load Tests**: Performance under load
4. **Postman Collection**: Complete API testing suite
5. **Mock Data**: Test data for all scenarios

This comprehensive API structure will make the Integration Auditor fully API-driven and eliminate the need for CLI access in production environments.
