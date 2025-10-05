#!/bin/bash

# Comprehensive test runner script for Integration Auditor
# Runs all types of tests with proper reporting and error handling

set -e  # Exit on any error

echo "🧪 Integration Auditor - Comprehensive Test Suite"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
UNIT_TESTS_PASSED=false
INTEGRATION_TESTS_PASSED=false
E2E_TESTS_PASSED=false
LINT_PASSED=false
TYPECHECK_PASSED=false

# Cleanup function
cleanup() {
  echo -e "\n${BLUE}🧹 Cleaning up test artifacts...${NC}"
  rm -rf test-output test-logs test-audit test-state test-e2e-output test-e2e-logs test-e2e-state coverage-temp || true
}

# Error handler
handle_error() {
  echo -e "\n${RED}❌ Test suite failed at step: $1${NC}"
  cleanup
  exit 1
}

# Success handler for individual test types
mark_success() {
  case $1 in
    "lint") LINT_PASSED=true ;;
    "typecheck") TYPECHECK_PASSED=true ;;
    "unit") UNIT_TESTS_PASSED=true ;;
    "integration") INTEGRATION_TESTS_PASSED=true ;;
    "e2e") E2E_TESTS_PASSED=true ;;
  esac
}

# Trap errors
trap 'handle_error "Unknown step"' ERR

echo -e "${BLUE}📋 Pre-flight checks${NC}"

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo -e "${RED}❌ Node.js is not installed${NC}"
  exit 1
fi

# Check if npm is available
if ! command -v npm &> /dev/null; then
  echo -e "${RED}❌ npm is not installed${NC}"
  exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version)
echo -e "${GREEN}✅ Node.js version: $NODE_VERSION${NC}"

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}📦 Installing dependencies...${NC}"
  npm install
fi

# Build the project
echo -e "\n${BLUE}🔨 Building project...${NC}"
npm run build || handle_error "Build"
echo -e "${GREEN}✅ Build completed${NC}"

# Run linting
echo -e "\n${BLUE}🔍 Running linter...${NC}"
if npm run lint; then
  mark_success "lint"
  echo -e "${GREEN}✅ Linting passed${NC}"
else
  echo -e "${YELLOW}⚠️  Linting issues found, but continuing...${NC}"
fi

# Run type checking
echo -e "\n${BLUE}🔍 Running type checking...${NC}"
if npm run typecheck; then
  mark_success "typecheck"
  echo -e "${GREEN}✅ Type checking passed${NC}"
else
  echo -e "${RED}❌ Type checking failed${NC}"
  handle_error "Type checking"
fi

# Run unit tests
echo -e "\n${BLUE}🧪 Running unit tests...${NC}"
if npm run test:unit; then
  mark_success "unit"
  echo -e "${GREEN}✅ Unit tests passed${NC}"
else
  echo -e "${RED}❌ Unit tests failed${NC}"
  handle_error "Unit tests"
fi

# Run integration tests
echo -e "\n${BLUE}🔗 Running integration tests...${NC}"
if npm run test:integration; then
  mark_success "integration"
  echo -e "${GREEN}✅ Integration tests passed${NC}"
else
  echo -e "${RED}❌ Integration tests failed${NC}"
  handle_error "Integration tests"
fi

# Run E2E tests
echo -e "\n${BLUE}🎭 Running E2E tests...${NC}"
if npm run test:e2e; then
  mark_success "e2e"
  echo -e "${GREEN}✅ E2E tests passed${NC}"
else
  echo -e "${YELLOW}⚠️  E2E tests failed, but continuing (may be environment-specific)...${NC}"
fi

# Generate coverage report
echo -e "\n${BLUE}📊 Generating coverage report...${NC}"
npm run test:coverage || echo -e "${YELLOW}⚠️  Coverage generation had issues${NC}"

# Test summary
echo -e "\n${BLUE}📋 Test Summary${NC}"
echo "==============="

echo -n "Linting: "
if [ "$LINT_PASSED" = true ]; then
  echo -e "${GREEN}✅ PASSED${NC}"
else
  echo -e "${YELLOW}⚠️  WARNINGS${NC}"
fi

echo -n "Type Checking: "
if [ "$TYPECHECK_PASSED" = true ]; then
  echo -e "${GREEN}✅ PASSED${NC}"
else
  echo -e "${RED}❌ FAILED${NC}"
fi

echo -n "Unit Tests: "
if [ "$UNIT_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✅ PASSED${NC}"
else
  echo -e "${RED}❌ FAILED${NC}"
fi

echo -n "Integration Tests: "
if [ "$INTEGRATION_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✅ PASSED${NC}"
else
  echo -e "${RED}❌ FAILED${NC}"
fi

echo -n "E2E Tests: "
if [ "$E2E_TESTS_PASSED" = true ]; then
  echo -e "${GREEN}✅ PASSED${NC}"
else
  echo -e "${YELLOW}⚠️  ISSUES${NC}"
fi

# Overall result
if [ "$TYPECHECK_PASSED" = true ] && [ "$UNIT_TESTS_PASSED" = true ] && [ "$INTEGRATION_TESTS_PASSED" = true ]; then
  echo -e "\n${GREEN}🎉 All critical tests passed!${NC}"
  
  if [ "$E2E_TESTS_PASSED" = true ] && [ "$LINT_PASSED" = true ]; then
    echo -e "${GREEN}🏆 Perfect score - all tests passed!${NC}"
  fi
  
  # Show coverage info if available
  if [ -d "coverage" ]; then
    echo -e "\n${BLUE}📊 Coverage report available in: coverage/index.html${NC}"
  fi
  
  cleanup
  exit 0
else
  echo -e "\n${RED}❌ Some critical tests failed${NC}"
  cleanup
  exit 1
fi
