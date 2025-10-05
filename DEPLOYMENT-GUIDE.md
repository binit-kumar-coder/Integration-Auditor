# Integration Auditor - Enterprise Deployment Guide

## 🎯 **Deployment Strategy - NO REDEPLOYMENT NEEDED**

### **❌ WRONG APPROACH:**
```bash
# DON'T DO THIS - requires redeployment for each run
1. Run tool → Generate session files
2. Build Docker image with session files  
3. Deploy new container
4. Repeat for every tool run
```

### **✅ CORRECT APPROACH:**
```bash
# DO THIS - deploy once, submit plans via API
1. Deploy persistent remediation service (ONCE)
2. Run tool → Generate remediation plan JSON
3. Submit plan to running service via API
4. Service processes plan without redeployment
```

## 🚀 **One-Time Deployment Setup**

### **Step 1: Deploy Persistent Service**
```bash
# Navigate to any generated remediation plan
cd output/session-2025-09-27-binitkumar/remediation-plan

# Deploy persistent service (ONCE)
docker-compose up -d

# Verify service is running
curl http://localhost:3000/health
```

### **Step 2: Service is Now Ready**
```bash
# Service endpoints available:
# - POST /api/remediation/plans     # Submit new plans
# - GET  /api/remediation/queue     # Monitor queue
# - GET  /api/remediation/stats     # View statistics
# - POST /api/remediation/process   # Trigger execution
```

## 🔄 **Daily Operations - No Redeployment**

### **Workflow for Each Tool Run:**
```bash
# 1. Run auditor tool (generates new plan)
integration-auditor fix --edition premium --dry-run

# 2. Submit plan to RUNNING service (no redeployment)
cd output/session-YYYY-MM-DD-operator/remediation-plan
curl -X POST http://localhost:3000/api/remediation/plans \
  -H "Content-Type: application/json" \
  -d @remediation-plan-YYYY-MM-DDTHH-MM-SS.json

# 3. Monitor execution
curl http://localhost:3000/api/remediation/stats

# 4. Trigger processing if needed
curl -X POST http://localhost:3000/api/remediation/process
```

## 🐳 **Docker Deployment Options**

### **Option 1: Docker Compose (Recommended)**
```bash
# One-time setup
cd output/session-*/remediation-plan
docker-compose up -d

# For each new remediation plan:
curl -X POST http://localhost:3000/api/remediation/plans \
  -d @new-remediation-plan.json
```

### **Option 2: Standalone Docker**
```bash
# Deploy persistent service
docker run -d \
  --name integration-auditor-service \
  -e INTEGRATION_API_URL=https://api.company.com \
  -e API_AUTH_TOKEN=prod-token \
  -p 3000:3000 \
  --restart unless-stopped \
  integration-auditor

# Submit plans to running service
curl -X POST http://localhost:3000/api/remediation/plans \
  -d @remediation-plan.json
```

## ☸️ **Kubernetes Deployment**

### **One-Time Kubernetes Setup**
```bash
# Create secrets
kubectl create secret generic api-secrets \
  --from-literal=auth-token=your-auth-token

# Deploy service (ONCE)
kubectl apply -f k8s-deployment.yaml

# Get service endpoint
kubectl get service integration-auditor-service
```

### **Submit Plans to Kubernetes Service**
```bash
# Port forward for local access
kubectl port-forward service/integration-auditor-service 3000:80

# Submit remediation plans
curl -X POST http://localhost:3000/api/remediation/plans \
  -d @remediation-plan.json
```

## 📊 **Monitoring & Management**

### **Health Monitoring**
```bash
# Check service health
curl http://localhost:3000/health

# View queue status
curl http://localhost:3000/api/remediation/queue

# Get execution statistics
curl http://localhost:3000/api/remediation/stats

# View processing state
curl http://localhost:3000/api/state
```

### **Job Management**
```bash
# Get specific job details
curl http://localhost:3000/api/remediation/jobs/job_123

# Execute specific job
curl -X POST http://localhost:3000/api/remediation/jobs/job_123/execute

# Cancel job
curl -X DELETE http://localhost:3000/api/remediation/jobs/job_123
```

## 🎯 **Real-World Usage Scenarios**

### **Scenario 1: Daily Automated Processing**
```bash
# 1. Deploy service once
docker-compose up -d

# 2. Daily cron job
#!/bin/bash
cd /app/integration-auditor
integration-auditor fix --edition premium --dry-run
cd output/session-$(date +%Y-%m-%d)-system/remediation-plan
curl -X POST http://remediation-service:3000/api/remediation/plans \
  -d @remediation-plan-*.json
```

### **Scenario 2: CI/CD Integration**
```bash
# In your CI/CD pipeline:
# 1. Run auditor
integration-auditor fix --edition premium --operator-id ci-system --dry-run

# 2. Submit to persistent service
curl -X POST $REMEDIATION_SERVICE_URL/api/remediation/plans \
  -H "Authorization: Bearer $API_TOKEN" \
  -d @output/session-*/remediation-plan/remediation-plan-*.json

# 3. Monitor execution
curl $REMEDIATION_SERVICE_URL/api/remediation/stats
```

### **Scenario 3: Multi-Environment Deployment**
```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Staging  
docker-compose -f docker-compose.staging.yml up -d

# Production
kubectl apply -f k8s-deployment.prod.yaml

# Submit to appropriate environment
curl -X POST $DEV_REMEDIATION_URL/api/remediation/plans -d @plan.json
curl -X POST $PROD_REMEDIATION_URL/api/remediation/plans -d @plan.json
```

## 🏆 **Key Benefits**

### **✅ No Redeployment Required**
- **Deploy service ONCE** - it runs persistently
- **Submit new plans via API** - no container rebuild needed
- **Continuous operation** - service handles multiple remediation cycles
- **Stateful processing** - maintains queue and execution history

### **✅ Enterprise Features**
- **API-driven submission** of remediation plans
- **Job queue management** with priority handling
- **Concurrent execution control** and rate limiting
- **Real-time monitoring** and statistics
- **Graceful shutdown** and error handling

### **✅ Scalability**
- **Horizontal scaling** with Kubernetes
- **Load balancing** across multiple instances
- **Database-backed state** for persistence
- **Health checks** for auto-recovery

## 🎯 **Summary**

**The service is deployed ONCE and then accepts remediation plans via API.**

- ✅ **Deploy**: `docker-compose up -d` (one time)
- ✅ **Submit Plans**: `curl -X POST .../api/remediation/plans -d @plan.json` (every run)
- ✅ **Monitor**: `curl .../api/remediation/stats` (anytime)
- ✅ **No Redeployment**: Service handles all future plans automatically

This approach is **enterprise-ready** and **production-scalable**! 🚀
