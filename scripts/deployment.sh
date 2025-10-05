#!/bin/bash

# Integration Auditor - Enterprise Deployment Script
# Version: 1.0.0
# Purpose: Automated deployment for enterprise environments

set -euo pipefail

echo "🚀 Integration Auditor - Enterprise Deployment"
echo "=============================================="

# Configuration
ENVIRONMENT=${1:-production}
CONFIG_DIR="./config/environments"
LOG_DIR="./logs"
AUDIT_DIR="./audit-logs"

echo "📋 Environment: $ENVIRONMENT"
echo "📁 Configuration: $CONFIG_DIR/$ENVIRONMENT.json"

# Validate environment
if [[ ! -f "$CONFIG_DIR/$ENVIRONMENT.json" ]]; then
    echo "❌ Environment configuration not found: $CONFIG_DIR/$ENVIRONMENT.json"
    exit 1
fi

echo "✅ Environment configuration validated"

# Create required directories
echo "📁 Creating directory structure..."
mkdir -p "$LOG_DIR" "$AUDIT_DIR/restore-bundles" "./output" "./manifests"

# Validate dependencies
echo "📦 Validating dependencies..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18.0.0 or higher."
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [[ $NODE_VERSION -lt 18 ]]; then
    echo "❌ Node.js version $NODE_VERSION too old. Please install Node.js 18.0.0 or higher."
    exit 1
fi

echo "✅ Node.js version validated"

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --only=production

# Build application
echo "🔨 Building application..."
npm run build

# Validate configuration files
echo "🔍 Validating configuration..."
node -e "
const fs = require('fs');
try {
  const businessRules = JSON.parse(fs.readFileSync('./config/business-rules.json', 'utf-8'));
  const remediationLogic = JSON.parse(fs.readFileSync('./config/remediation-logic.json', 'utf-8'));
  const envConfig = JSON.parse(fs.readFileSync('$CONFIG_DIR/$ENVIRONMENT.json', 'utf-8'));
  
  console.log('✅ Business rules configuration valid');
  console.log('✅ Remediation logic configuration valid');
  console.log('✅ Environment configuration valid');
  
  console.log('📊 Configuration Summary:');
  console.log(\`   Edition Requirements: \${Object.keys(businessRules.editionRequirements).length} editions\`);
  console.log(\`   Valid License Editions: \${businessRules.licenseValidation.validEditions.length}\`);
  console.log(\`   Required Properties: \${businessRules.requiredProperties.topLevel.length + businessRules.requiredProperties.settingsLevel.length}\`);
  console.log(\`   Remediation Templates: \${Object.keys(remediationLogic.actionTemplates).length}\`);
  console.log(\`   Environment: \${envConfig.environment}\`);
  
} catch (error) {
  console.error('❌ Configuration validation failed:', error.message);
  process.exit(1);
}
"

# Test system health
echo "🏥 Testing system health..."
node dist/cli-data-driven.js status

# Validate CSV processing capability
echo "🔍 Validating CSV processing..."
if [[ -d "./input/tier1" ]]; then
    node dist/cli-data-driven.js audit --tier tier1 --dry-run --config ./config | head -20
    echo "✅ CSV processing validated"
else
    echo "⚠️  No tier1 data available for validation"
fi

# Set permissions
echo "🔒 Setting permissions..."
chmod +x dist/cli-data-driven.js
chmod 755 scripts/*.sh 2>/dev/null || true

# Generate deployment summary
echo "📊 Generating deployment summary..."
cat > "./deployment-summary.json" << EOF
{
  "deploymentDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "environment": "$ENVIRONMENT",
  "version": "$(node -e "console.log(require('./package.json').version)")",
  "nodeVersion": "$(node --version)",
  "components": {
    "dataDrivernCorruptionDetector": "✅ Deployed",
    "dataDrivernRemediationEngine": "✅ Deployed", 
    "csvProcessor": "✅ Deployed",
    "safetyController": "✅ Deployed",
    "auditLogger": "✅ Deployed"
  },
  "configuration": {
    "businessRules": "✅ Loaded",
    "remediationLogic": "✅ Loaded",
    "environmentConfig": "✅ Loaded ($ENVIRONMENT)",
    "manifestsAvailable": $(ls manifests/*/*.json 2>/dev/null | wc -l || echo 0)
  },
  "healthStatus": "Ready for operation"
}
EOF

echo ""
echo "🎉 DEPLOYMENT COMPLETE"
echo "====================="
echo "Environment: $ENVIRONMENT"
echo "Status: Ready for operation"
echo "CLI: node dist/cli-data-driven.js"
echo "Config: Business users can modify config/business-rules.json"
echo "Documentation: docs/"
echo ""
echo "📋 Next Steps:"
echo "1. Review business configuration: node dist/cli-data-driven.js config --show"
echo "2. Test with dry run: node dist/cli-data-driven.js audit --tier tier1 --dry-run"
echo "3. Monitor logs in: $LOG_DIR/"
echo "4. Review deployment summary: ./deployment-summary.json"

echo ""
echo "✅ Integration Auditor deployed successfully!"
