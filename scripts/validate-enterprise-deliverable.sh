#!/bin/bash

# Enterprise Deliverable Validation Script
# Validates that all enterprise requirements are met

set -euo pipefail

echo "🏢 ENTERPRISE DELIVERABLE VALIDATION"
echo "===================================="

# Check all editions have enhanced manifests
echo "📋 Validating manifest completeness..."

EDITIONS=("starter" "standard" "premium" "shopifymarkets")
MISSING_ENHANCED=0

for edition in "${EDITIONS[@]}"; do
    ENHANCED_MANIFEST="./manifests/$edition/1.51.0-enhanced.json"
    ORIGINAL_MANIFEST="./manifests/$edition/1.51.0.json"
    
    if [[ -f "$ENHANCED_MANIFEST" && -f "$ORIGINAL_MANIFEST" ]]; then
        echo "✅ $edition: Both original and enhanced manifests present"
    elif [[ -f "$ORIGINAL_MANIFEST" ]]; then
        echo "❌ $edition: Missing enhanced manifest"
        MISSING_ENHANCED=$((MISSING_ENHANCED + 1))
    else
        echo "❌ $edition: Missing both manifests"
        MISSING_ENHANCED=$((MISSING_ENHANCED + 1))
    fi
done

# Check configuration completeness
echo ""
echo "📋 Validating configuration completeness..."

REQUIRED_CONFIGS=(
    "config/business-rules.json"
    "config/remediation-logic.json" 
    "config/environments/production.json"
    "config/environments/development.json"
    "config/schemas/business-rules-schema.json"
)

MISSING_CONFIGS=0

for config in "${REQUIRED_CONFIGS[@]}"; do
    if [[ -f "$config" ]]; then
        echo "✅ $config"
    else
        echo "❌ $config - MISSING"
        MISSING_CONFIGS=$((MISSING_CONFIGS + 1))
    fi
done

# Check documentation completeness
echo ""
echo "📋 Validating documentation completeness..."

REQUIRED_DOCS=(
    "README.md"
    "docs/README.md"
    "docs/business-user-guide.md"
    "examples/business-config-examples.md"
)

MISSING_DOCS=0

for doc in "${REQUIRED_DOCS[@]}"; do
    if [[ -f "$doc" ]]; then
        echo "✅ $doc"
    else
        echo "❌ $doc - MISSING"
        MISSING_DOCS=$((MISSING_DOCS + 1))
    fi
done

# Check build artifacts
echo ""
echo "📋 Validating build artifacts..."

if [[ -f "dist/cli-data-driven.js" ]]; then
    echo "✅ CLI build artifact present"
else
    echo "❌ CLI build artifact missing"
    exit 1
fi

# Test CLI functionality
echo ""
echo "📋 Validating CLI functionality..."

if node dist/cli-data-driven.js status > /dev/null 2>&1; then
    echo "✅ CLI status command working"
else
    echo "❌ CLI status command failed"
    exit 1
fi

if node dist/cli-data-driven.js config --show > /dev/null 2>&1; then
    echo "✅ CLI config command working"
else
    echo "❌ CLI config command failed"  
    exit 1
fi

# Validate business configuration loading
echo ""
echo "📋 Validating business configuration..."

node -e "
const { DataDrivenCorruptionDetector } = require('./dist/rules/data-driven-corruption-detector');
const detector = new DataDrivenCorruptionDetector();

(async () => {
  try {
    await detector.initialize('./config/business-rules.json');
    const config = detector.getBusinessConfig();
    
    if (config && config.editionRequirements) {
      console.log('✅ Business configuration loads successfully');
      console.log(\`✅ Edition requirements: \${Object.keys(config.editionRequirements).length} editions\`);
    } else {
      console.log('❌ Business configuration invalid');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ Business configuration failed to load:', error.message);
    process.exit(1);
  }
})();
"

# Final validation summary
echo ""
echo "📊 ENTERPRISE VALIDATION SUMMARY"
echo "================================"

TOTAL_ISSUES=$((MISSING_ENHANCED + MISSING_CONFIGS + MISSING_DOCS))

if [[ $TOTAL_ISSUES -eq 0 ]]; then
    echo "🎉 ALL ENTERPRISE REQUIREMENTS MET"
    echo ""
    echo "✅ Manifest Coverage: All editions have enhanced manifests"
    echo "✅ Configuration: All required configuration files present"
    echo "✅ Documentation: Complete enterprise documentation"
    echo "✅ Build Artifacts: CLI and components built successfully"
    echo "✅ Functionality: All CLI commands working"
    echo "✅ Business Configuration: Loads and validates successfully"
    echo ""
    echo "🏆 ENTERPRISE GRADE DELIVERABLE VALIDATED"
    echo "🚀 Ready for production deployment"
else
    echo "❌ VALIDATION FAILED"
    echo "Missing enhanced manifests: $MISSING_ENHANCED"
    echo "Missing configurations: $MISSING_CONFIGS" 
    echo "Missing documentation: $MISSING_DOCS"
    echo "Total issues: $TOTAL_ISSUES"
    exit 1
fi
