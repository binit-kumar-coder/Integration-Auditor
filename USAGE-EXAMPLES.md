# Integration Auditor - Comprehensive Usage Examples

**Tool Version:** 1.0.0  
**Generated:** 2025-09-27T19:41:00Z  
**Enterprise-Ready:** Docker & Kubernetes deployment support  

## 🚀 **DEPLOYMENT STRATEGY - NO REDEPLOYMENT NEEDED**

### **✅ Persistent Service Architecture**
- **Deploy ONCE**: Remediation service runs persistently
- **Submit Plans**: Via API to running service (no container rebuild)
- **Enterprise Scale**: Service handles multiple remediation cycles
- **Cost Effective**: No infrastructure churn for each tool run

### **🔄 Workflow Overview**
```bash
# ONE-TIME: Deploy service
docker-compose up -d

# DAILY: Submit plans to running service
integration-auditor fix --edition premium --dry-run
curl -X POST http://localhost:3000/api/remediation/plans -d @plan.json
```

### **❌ vs ✅ Deployment Comparison**

| Approach | Redeployment Required? | Enterprise Ready? | Cost |
|----------|------------------------|-------------------|------|
| **❌ Session-based Scripts** | YES - every run | NO | HIGH |
| **✅ Persistent Service** | NO - deploy once | YES | LOW |

**Bottom Line**: Deploy the service **ONCE**, then submit plans via API forever!

## 🎯 **Quick Start**

### **Basic Commands**
```bash
# Show help
integration-auditor --help

# Check system status
integration-auditor status

# Dry run (preview changes)
integration-auditor fix --edition standard --dry-run

# Apply changes
integration-auditor fix --edition standard --apply
```

## 🔧 **Core Functionality Examples**

### **1. Edition-Based Processing**
```bash
# Process starter edition integrations
integration-auditor fix --edition starter --dry-run

# Process standard edition integrations  
integration-auditor fix --edition standard --apply

# Process premium edition integrations
integration-auditor fix --edition premium --apply

# Process shopify markets edition
integration-auditor fix --edition shopifymarkets --apply
```

### **2. Targeted Processing**
```bash
# Process specific integrations by ID
integration-auditor fix --edition premium \
  --allowlist 65133f1cfea0a61c9fe668da,6070bc7bcfeede27cb6315e9 \
  --apply

# Process specific account emails
integration-auditor fix --edition premium \
  --allowlist-accounts user@example.com,admin@company.com \
  --dry-run

# Combine filters
integration-auditor fix --edition premium \
  --allowlist integration-123 \
  --allowlist-accounts critical-user@company.com \
  --apply
```

### **3. Performance & Safety Controls**
```bash
# Limit operations per integration
integration-auditor fix --edition premium \
  --max-ops-per-integration 50 \
  --apply

# Control concurrency
integration-auditor fix --edition premium \
  --max-concurrent 5 \
  --apply

# Rate limiting for API protection
integration-auditor fix --edition premium \
  --rate-limit 2 \
  --apply

# Batch processing
integration-auditor fix --edition premium \
  --batch-size 10 \
  --apply
```

## 🏭 **Production Deployment Workflows**

### **Development/Testing Workflow**
```bash
# Step 1: Dry run to see what would change
integration-auditor fix --edition standard --dry-run

# Step 2: Test on a single integration
integration-auditor fix --edition standard \
  --allowlist test-integration-id \
  --apply

# Step 3: Apply to small batch
integration-auditor fix --edition standard \
  --max-concurrent 5 \
  --apply
```

### **Production Deployment Workflow**
```bash
# Step 1: Create restore bundle and dry run
integration-auditor fix --edition premium \
  --create-restore-bundle \
  --dry-run

# Step 2: Canary deployment (limited integrations)
integration-auditor fix --edition premium \
  --max-concurrent 10 \
  --apply

# Step 3: Full deployment with safety controls
integration-auditor fix --edition premium \
  --rate-limit 5 \
  --maintenance-window \
  --apply
```

### **Emergency Recovery Workflow**
```bash
# Step 1: Assess damage
integration-auditor status
integration-auditor state --show

# Step 2: Quick fix for critical integrations
integration-auditor fix --edition premium \
  --allowlist critical-int1,critical-int2 \
  --force-confirmation \
  --apply

# Step 3: Full system recovery
integration-auditor fix --edition premium \
  --max-concurrent 20 \
  --apply
```

## 🐳 **Docker Deployment Examples - PERSISTENT SERVICE**

### **🎯 One-Time Deployment (Deploy Once, Use Forever)**
```bash
# Navigate to any generated remediation plan
cd output/session-2025-09-27-binitkumar/remediation-plan

# Deploy persistent service (ONE TIME ONLY)
docker-compose up -d

# Verify service is running
curl http://localhost:3000/health
# Expected: {"status":"healthy","service":"integration-auditor-remediation"}
```

### **🔄 Daily Operations (No Redeployment Needed)**
```bash
# For each new corruption detection run:

# Step 1: Run auditor tool
integration-auditor fix --edition premium --dry-run

# Step 2: Submit plan to RUNNING service (no deployment)
cd output/session-*/remediation-plan
curl -X POST http://localhost:3000/api/remediation/plans \
  -H "Content-Type: application/json" \
  -d @remediation-plan-*.json

# Step 3: Monitor execution
curl http://localhost:3000/api/remediation/stats
curl http://localhost:3000/api/remediation/queue

# Step 4: Trigger processing if needed
curl -X POST http://localhost:3000/api/remediation/process
```

### **🏭 Production Docker Deployment**
```bash
# One-time production deployment
docker run -d \
  --name integration-auditor-service \
  -e NODE_ENV=production \
  -e INTEGRATION_API_URL=https://api.company.com \
  -e API_AUTH_TOKEN=${PROD_API_TOKEN} \
  -p 3000:3000 \
  --restart unless-stopped \
  integration-auditor

# Daily operations - submit plans to running service
curl -X POST https://remediation.company.com/api/remediation/plans \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -d @remediation-plan.json
```

## ☸️ **Kubernetes Deployment Examples - PERSISTENT SERVICE**

### **🎯 One-Time Kubernetes Deployment**
```bash
# Create secrets (ONE TIME)
kubectl create secret generic api-secrets \
  --from-literal=auth-token=your-auth-token

# Deploy persistent service (ONE TIME)
kubectl apply -f k8s-deployment.yaml

# Verify service is running
kubectl get pods -l app=integration-auditor
kubectl get service integration-auditor-service

# Get service endpoint
kubectl port-forward service/integration-auditor-service 3000:80
```

### **🔄 Submit Plans to Running Kubernetes Service**
```bash
# For each new remediation plan:

# Step 1: Run auditor tool
integration-auditor fix --edition premium --dry-run

# Step 2: Submit to running Kubernetes service
curl -X POST http://localhost:3000/api/remediation/plans \
  -H "Content-Type: application/json" \
  -d @output/session-*/remediation-plan/remediation-plan-*.json

# Step 3: Monitor via Kubernetes
kubectl logs -l app=integration-auditor
curl http://localhost:3000/api/remediation/stats
```

### **🏭 Production Kubernetes with Scaling**
```bash
# One-time production setup
kubectl create namespace integration-auditor
kubectl create secret generic api-secrets \
  --from-literal=auth-token=${PROD_API_TOKEN} \
  --namespace integration-auditor

# Deploy service (ONE TIME)
kubectl apply -f k8s-deployment.yaml --namespace integration-auditor

# Scale for high availability (ONE TIME)
kubectl scale deployment integration-auditor --replicas=3 --namespace integration-auditor

# Daily operations - submit plans to running service
curl -X POST https://remediation.company.com/api/remediation/plans \
  -H "Authorization: Bearer ${API_TOKEN}" \
  -d @remediation-plan.json
```

## 📊 **State Management Examples**

### **Monitoring Processing State**
```bash
# View current processing state
integration-auditor state --show

# View state for specific operator
integration-auditor state --show --operator binitkumar

# Export state for backup
integration-auditor state --export backup-$(date +%Y%m%d).json

# Import state from backup
integration-auditor state --import backup-20250927.json
```

### **State Maintenance**
```bash
# Clean up old records (30+ days)
integration-auditor state --cleanup

# Reset all processing state (DANGEROUS)
integration-auditor state --reset

# Force reprocess all integrations
integration-auditor fix --edition premium --force-reprocess --apply

# Set custom age threshold
integration-auditor fix --edition premium --max-age 48 --apply
```

## 🔧 **Business Rules Management Examples**

### **Configuration Management**
```bash
# Show current business configuration
integration-auditor config --show

# Validate configuration files
integration-auditor config --validate

# View edition requirements
integration-auditor business-rules --edition premium

# List all available products and versions
integration-auditor products --list

# Create new product configuration
integration-auditor products --create shopify-bigcommerce --version 1.0.0
```

### **Multi-Product Support**
```bash
# Process different products
integration-auditor fix --product shopify-netsuite --edition premium --apply
integration-auditor fix --product shopify-hubspot --edition standard --apply

# Switch between configuration versions
integration-auditor fix --version 1.51.0 --edition premium --apply
integration-auditor fix --version 2.0.0 --edition premium --apply
```

## 🔍 **Corruption Analysis Examples**

### **Detailed Analysis**
```bash
# Generate corruption analysis only (no remediation)
integration-auditor audit --tier tier1 --dry-run

# Analyze specific tier
integration-auditor audit --tier tier2 --product shopify-netsuite

# Custom input directory
integration-auditor fix --input ./custom-csv-data --edition premium --dry-run
```

### **Output Analysis**
```bash
# After running the tool, analyze generated files:

# View executive summary
cat output/session-*/reports/executive-summary.json

# Analyze specific corruption types
cat output/session-*/corruptions-by-type/import-count-issues.json
cat output/session-*/corruptions-by-type/offline-connection-problems.json

# Review audit logs
tail -f output/session-*/logs/2025-09-27.log
cat output/session-*/logs/audit-summary.json
```

## 🚀 **API Integration Examples**

### **Using Generated API Scripts**
```bash
# Execute via generated API script
cd output/session-*/remediation-plan
./execute-remediation-*.sh

# Custom API base URL
INTEGRATION_API_URL=https://api.company.com ./execute-remediation-*.sh

# With authentication
API_AUTH_TOKEN=your-token ./execute-remediation-*.sh
```

### **Direct API Calls**
```bash
# Submit remediation job
curl -X POST http://localhost:3000/api/remediation/jobs \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d @remediation-plan-*.json

# Check job status
curl http://localhost:3000/api/remediation/jobs/job_123

# Execute specific action
curl -X POST http://localhost:3000/api/integrations/int_123/remediation \
  -H "Content-Type: application/json" \
  -d '{"action": "delete", "resourceType": "import", "resourceId": "excess-import-123"}'
```

## 🎯 **Real-World Scenarios - PERSISTENT SERVICE APPROACH**

### **Scenario 1: One-Time Setup + Daily Operations**
```bash
# ONE-TIME SETUP (Deploy persistent service)
cd output/session-*/remediation-plan
docker-compose up -d

# DAILY OPERATIONS (No redeployment needed)
integration-auditor fix --edition premium --dry-run
curl -X POST http://localhost:3000/api/remediation/plans \
  -d @output/session-*/remediation-plan/remediation-plan-*.json
```

### **Scenario 2: CI/CD Integration**
```bash
# ONE-TIME: Deploy service to production
kubectl apply -f k8s-deployment.yaml

# CI/CD PIPELINE (runs daily/weekly)
#!/bin/bash
# Generate remediation plan
integration-auditor fix --edition premium --operator-id ci-system --dry-run

# Submit to running service (no deployment)
curl -X POST $REMEDIATION_SERVICE_URL/api/remediation/plans \
  -H "Authorization: Bearer $CI_API_TOKEN" \
  -d @output/session-*/remediation-plan/remediation-plan-*.json

# Monitor results
curl $REMEDIATION_SERVICE_URL/api/remediation/stats
```

### **Scenario 3: Multi-Environment Operations**
```bash
# ONE-TIME: Deploy to all environments
docker-compose -f docker-compose.dev.yml up -d      # Development
docker-compose -f docker-compose.staging.yml up -d  # Staging
kubectl apply -f k8s-deployment.prod.yaml           # Production

# DAILY: Submit plans to appropriate environment
integration-auditor fix --edition premium --dry-run

# Submit to dev
curl -X POST http://dev-remediation:3000/api/remediation/plans \
  -d @remediation-plan.json

# Submit to staging  
curl -X POST http://staging-remediation:3000/api/remediation/plans \
  -d @remediation-plan.json

# Submit to production
curl -X POST https://prod-remediation.company.com/api/remediation/plans \
  -H "Authorization: Bearer ${PROD_TOKEN}" \
  -d @remediation-plan.json
```

## 📈 **Performance Optimization Examples**

### **High-Volume Processing**
```bash
# Optimize for large datasets
integration-auditor fix --edition premium \
  --batch-size 50 \
  --max-concurrent 20 \
  --rate-limit 10 \
  --apply

# Memory-efficient processing
integration-auditor fix --edition premium \
  --batch-size 10 \
  --max-concurrent 5 \
  --apply
```

### **Resource-Constrained Environments**
```bash
# Low-resource deployment
integration-auditor fix --edition premium \
  --max-concurrent 2 \
  --rate-limit 1 \
  --batch-size 5 \
  --apply
```

## 🎯 **Generated Output Usage**

### **Working with Corruption Analysis**
```bash
# Navigate to session output
cd output/session-2025-09-27-binitkumar

# Review corruption types
ls corruptions-by-type/
# - import-count-issues.json (7.7MB - 569 issues)
# - export-count-issues.json (5.7MB - 513 issues)
# - flow-count-issues.json (3.8MB - 380 issues)
# - missing-settings.json (691KB - 630 issues)
# - offline-connection-problems.json (236KB - 94 issues)
# - license-conflicts.json (36KB - 18 issues)
# - stuck-updates.json (2KB - 1 issue)

# Analyze specific corruption type
jq '.summary' corruptions-by-type/import-count-issues.json
jq '.corruptions[0]' corruptions-by-type/offline-connection-problems.json
```

### **Docker Deployment from Generated Files**
```bash
# Navigate to remediation plan
cd remediation-plan/

# Review deployment options
cat API-DOCUMENTATION.md
cat docker-compose.yml
cat k8s-deployment.yaml

# Deploy with Docker
docker-compose up -d

# Monitor deployment
curl http://localhost:3000/api/remediation/stats
```

## 🏆 **Best Practices**

### **Development**
1. **Always start with dry-run** to preview changes
2. **Test on single integration** before batch processing
3. **Use allowlists** for targeted testing
4. **Monitor processing state** regularly

### **Production**
1. **Create restore bundles** before major operations
2. **Use maintenance windows** for large deployments
3. **Set appropriate rate limits** to protect APIs
4. **Monitor execution statistics** during deployment
5. **Keep processing state backups** for recovery

### **Docker/Kubernetes**
1. **Use environment variables** for configuration
2. **Mount persistent volumes** for logs and state
3. **Set resource limits** appropriate for your environment
4. **Configure health checks** for monitoring
5. **Use secrets management** for API tokens

---

## 🏆 **Deployment Strategy Summary**

### **✅ CORRECT APPROACH - NO REDEPLOYMENT NEEDED**

#### **One-Time Setup:**
```bash
# Deploy persistent remediation service (ONCE)
docker-compose up -d
# OR
kubectl apply -f k8s-deployment.yaml
```

#### **Daily Operations:**
```bash
# Run auditor tool (generates plan)
integration-auditor fix --edition premium --dry-run

# Submit plan to running service (no redeployment)
curl -X POST http://service:3000/api/remediation/plans \
  -d @remediation-plan.json

# Monitor execution
curl http://service:3000/api/remediation/stats
```

### **📊 Expected Results**

When you run the tool on the provided input data, you get:

- **630 integrations processed**
- **2,205 corruption events detected** 
- **11,399 remediation actions generated**
- **630 enterprise remediation jobs queued**
- **Complete persistent service deployment package**
- **API endpoints for plan submission**

### **🎯 Key Benefits**

✅ **Deploy Once**: Service runs persistently  
✅ **Submit Plans**: Via API - no redeployment needed  
✅ **Enterprise Scale**: Handles multiple plans over time  
✅ **Production Ready**: Health checks, monitoring, scaling  
✅ **Cost Effective**: No infrastructure churn  

The tool now provides **true enterprise deployment** with **persistent service architecture**! 🚀
