# Integration Auditor - API Reference for CLI Functionality

**Service Version:** 1.0.0  
**Generated:** 2025-09-27T19:45:00Z  
**Base URL:** `http://localhost:3000` (or your deployed service URL)

## 🎯 **API Equivalent of `integration-auditor --help`**

### **GET /api/help**
Returns complete help information equivalent to CLI `--help` command.

```bash
curl http://localhost:3000/api/help
```

**Response:**
```json
{
  "tool": "integration-auditor",
  "version": "1.0.0",
  "description": "Enterprise-grade data-driven CSV integration auditor",
  "commands": {
    "fix": {
      "description": "Fix integration corruptions using data-driven business rules",
      "options": {
        "--edition": "Target edition (starter, standard, premium, shopifymarkets)",
        "--dry-run": "Preview changes without applying",
        "--apply": "Execute the remediation plan",
        "--allowlist": "Specific integration IDs to process",
        ...
      },
      "examples": [
        "integration-auditor fix --edition premium --dry-run",
        "integration-auditor fix --edition standard --apply"
      ]
    }
  },
  "apiEndpoints": {
    "/api/help": "GET - This help information",
    "/api/commands": "GET - Available CLI commands", 
    "/api/run": "POST - Execute CLI commands via API"
  }
}
```

## 🔧 **API Equivalent of CLI Commands**

### **GET /api/commands**
Lists all available CLI commands and their API usage.

```bash
curl http://localhost:3000/api/commands
```

**Response:**
```json
{
  "availableCommands": ["fix", "audit", "status", "state", "config"],
  "usage": "POST /api/run with {\"command\": \"fix\", \"options\": {...}}",
  "examples": [
    {
      "command": "fix",
      "options": { "edition": "premium", "dryRun": true },
      "description": "Preview premium edition fixes"
    }
  ]
}
```

### **POST /api/run**
Execute any CLI command via API.

#### **API Equivalent of `integration-auditor --help`**
```bash
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{"command": "help"}'
```

#### **API Equivalent of `integration-auditor status`**
```bash
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{"command": "status"}'
```

#### **API Equivalent of `integration-auditor fix --edition premium --dry-run`**
```bash
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "fix",
    "options": {
      "edition": "premium",
      "dryRun": true
    }
  }'
```

#### **API Equivalent of `integration-auditor state --show`**
```bash
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "state", 
    "options": {
      "show": true
    }
  }'
```

## 📊 **Complete CLI to API Mapping**

| CLI Command | API Equivalent |
|-------------|----------------|
| `integration-auditor --help` | `GET /api/help` |
| `integration-auditor status` | `POST /api/run {"command": "status"}` |
| `integration-auditor fix --edition premium --dry-run` | `POST /api/run {"command": "fix", "options": {"edition": "premium", "dryRun": true}}` |
| `integration-auditor fix --edition standard --apply` | `POST /api/run {"command": "fix", "options": {"edition": "standard", "apply": true}}` |
| `integration-auditor state --show` | `POST /api/run {"command": "state", "options": {"show": true}}` |
| `integration-auditor state --cleanup` | `POST /api/run {"command": "state", "options": {"cleanup": true}}` |
| `integration-auditor config --show` | `POST /api/run {"command": "config", "options": {"show": true}}` |

## 🎯 **Advanced API Examples**

### **Complex Fix Command with Multiple Options**
```bash
# CLI equivalent:
# integration-auditor fix --edition premium --allowlist int1,int2 --max-concurrent 10 --apply

curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "fix",
    "options": {
      "edition": "premium",
      "allowlist": "65133f1cfea0a61c9fe668da,6070bc7bcfeede27cb6315e9",
      "maxConcurrent": 10,
      "apply": true,
      "operatorId": "api-user"
    }
  }'
```

### **State Management via API**
```bash
# Export state
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "state",
    "options": {
      "export": "state-backup.json"
    }
  }'

# Reset state
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "state",
    "options": {
      "reset": true
    }
  }'
```

### **Business Rules Management via API**
```bash
# View edition requirements
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "business-rules",
    "options": {
      "edition": "premium"
    }
  }'

# Show configuration
curl -X POST http://localhost:3000/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "config",
    "options": {
      "show": true
    }
  }'
```

## 🔄 **Response Format**

All `/api/run` endpoints return:
```json
{
  "success": true,
  "command": "integration-auditor fix --edition premium --dry-run",
  "output": "🔧 Integration Corruption Fixer\n===============================\n...",
  "executedAt": "2025-09-27T19:45:00.000Z"
}
```

**Error Response:**
```json
{
  "error": "Command execution failed",
  "details": "Invalid edition specified"
}
```

## 🚀 **Production Usage Examples**

### **Automated Monitoring via API**
```bash
#!/bin/bash
# Health check
curl -f http://remediation-service:3000/health

# Get help information
curl http://remediation-service:3000/api/help

# Check system status
curl -X POST http://remediation-service:3000/api/run \
  -d '{"command": "status"}'

# View processing state
curl -X POST http://remediation-service:3000/api/run \
  -d '{"command": "state", "options": {"show": true}}'
```

### **CI/CD Integration**
```bash
# In your CI/CD pipeline
API_BASE="https://remediation.company.com"

# Check service health
curl -f $API_BASE/health

# Run corruption detection
curl -X POST $API_BASE/api/run \
  -H "Authorization: Bearer $CI_TOKEN" \
  -d '{
    "command": "fix",
    "options": {
      "edition": "premium",
      "dryRun": true,
      "operatorId": "ci-system"
    }
  }'

# Submit generated plan (if corruption found)
curl -X POST $API_BASE/api/remediation/plans \
  -H "Authorization: Bearer $CI_TOKEN" \
  -d @remediation-plan.json
```

### **Web Dashboard Integration**
```javascript
// JavaScript example for web dashboard
const apiBase = 'http://localhost:3000';

// Get help information
const helpInfo = await fetch(`${apiBase}/api/help`).then(r => r.json());

// Execute status command
const statusResult = await fetch(`${apiBase}/api/run`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'status'
  })
}).then(r => r.json());

// Execute fix command with options
const fixResult = await fetch(`${apiBase}/api/run`, {
  method: 'POST', 
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    command: 'fix',
    options: {
      edition: 'premium',
      dryRun: true,
      operatorId: 'web-dashboard'
    }
  })
}).then(r => r.json());
```

## 🎯 **Key API Endpoints Summary**

| Endpoint | Method | Purpose | CLI Equivalent |
|----------|--------|---------|----------------|
| `/api/help` | GET | Get help information | `--help` |
| `/api/commands` | GET | List available commands | `--help` (commands section) |
| `/api/run` | POST | Execute any CLI command | Any CLI command |
| `/health` | GET | Service health check | N/A |
| `/api/remediation/plans` | POST | Submit remediation plan | N/A (enterprise feature) |
| `/api/remediation/queue` | GET | View job queue | N/A (enterprise feature) |
| `/api/remediation/stats` | GET | Execution statistics | N/A (enterprise feature) |

## 🏆 **Benefits of API Approach**

✅ **Remote Execution**: Run CLI commands from anywhere  
✅ **Web Integration**: Easy integration with web dashboards  
✅ **Automation**: Perfect for CI/CD pipelines  
✅ **Monitoring**: Programmatic access to all functionality  
✅ **Enterprise Ready**: RESTful API with JSON responses  

You can now use **API endpoints instead of CLI commands** for complete remote control! 🚀
