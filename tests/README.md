# Integration Auditor - Test Suite Documentation

This document describes the comprehensive test suite for the Integration Auditor project.

## 🧪 Test Structure

The test suite is organized into multiple layers following best practices:

```
tests/
├── setup.ts                    # Global test setup and utilities
├── fixtures/                   # Test data and configurations
│   ├── integration-snapshots.ts    # Sample integration data
│   ├── business-config.ts          # Test business configurations
│   └── csv-data.ts                 # Sample CSV data for testing
├── mocks/                      # Mock implementations
│   ├── execution-engine.ts        # Mock execution engine
│   └── file-system.ts             # Mock file system operations
├── unit/                       # Unit tests
│   ├── rules/                     # Core business logic tests
│   ├── csv/                       # CSV processing tests
│   ├── utils/                     # Utility component tests
│   ├── safety/                    # Safety control tests
│   └── audit/                     # Audit logging tests
├── integration/                # Integration tests
│   └── complete-workflow.test.ts  # End-to-end workflow tests
└── e2e/                       # End-to-end tests
    ├── setup.ts                  # E2E test utilities
    ├── global-setup.ts           # Global E2E setup
    ├── global-teardown.ts        # Global E2E cleanup
    └── cli-commands.e2e.ts       # CLI command tests
```

## 🎯 Test Types

### Unit Tests
- **Coverage**: Individual components and functions
- **Focus**: Business logic, error handling, edge cases
- **Speed**: Fast execution (< 5 seconds total)
- **Dependencies**: Mocked external dependencies

#### Core Components Tested:
- `DataDrivenCorruptionDetector` - Business rule validation
- `DataDrivenRemediationEngine` - Action generation
- `CSVProcessor` - Data parsing and transformation
- `SafetyController` - Safety and compliance controls
- `AuditLogger` - Audit trail and rollback capabilities
- `Logger` - Logging and error categorization

### Integration Tests
- **Coverage**: Component interactions and workflows
- **Focus**: Data flow, system integration, business processes
- **Speed**: Medium execution (5-15 seconds)
- **Dependencies**: Real components with mocked I/O

#### Workflows Tested:
- Complete CSV processing pipeline
- Corruption detection to remediation workflow
- Audit trail and rollback generation
- Error handling across components
- Performance with large datasets

### End-to-End Tests
- **Coverage**: Complete user scenarios via CLI
- **Focus**: User experience, command validation, output generation
- **Speed**: Slower execution (30-120 seconds)
- **Dependencies**: Built application with test data

#### CLI Commands Tested:
- `fix` - Main remediation command
- `audit` - Legacy audit command
- `config` - Configuration management
- `business-rules` - Business rule inspection
- `status` - System status checking

## 🛠️ Test Configuration

### Jest Configuration
- **Main Config**: `jest.config.js` - Unit and integration tests
- **E2E Config**: `jest.config.e2e.js` - End-to-end tests
- **Coverage**: 85% threshold for lines, functions, branches, statements

### Test Scripts
```bash
# Run all tests
npm test

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:e2e

# Coverage and debugging
npm run test:coverage
npm run test:debug
npm run test:watch

# CI/CD
npm run test:ci
npm run test:all
```

## 📊 Coverage Requirements

| Metric | Threshold |
|--------|-----------|
| Lines | 85% |
| Functions | 85% |
| Branches | 80% |
| Statements | 85% |

### Coverage Exclusions
- CLI entry point (`cli-data-driven.ts`)
- Type definitions (`*.d.ts`)
- Test files themselves
- Build artifacts (`dist/`)

## 🧩 Test Fixtures and Mocks

### Integration Snapshots
- `validIntegrationSnapshot` - Properly configured integration
- `integrationWithMissingResources` - Resource count issues
- `integrationWithDuplicateResources` - Excess resources
- `integrationWithOfflineConnections` - Connection issues
- `integrationWithLicenseMismatch` - License configuration problems
- `integrationWithMultipleIssues` - Complex corruption scenarios

### Business Configurations
- `testBusinessConfig` - Complete business rules configuration
- `testRemediationConfig` - Remediation action templates
- `minimalBusinessConfig` - Minimal valid configuration

### CSV Test Data
- Sample CSV files for all resource types
- Malformed data for error testing
- Large datasets for performance testing
- Unicode and special character handling

### Mock Implementations
- `MockExecutionEngine` - Configurable execution simulation
- `MockFileSystem` - In-memory file system operations

## 🔧 Test Utilities

### Global Utilities (`setup.ts`)
- `testUtils.createTestDir()` - Temporary directory creation
- `testUtils.waitFor()` - Async condition waiting
- `testUtils.createTestFile()` - Test file creation
- `testUtils.fileExists()` - File existence checking

### E2E Utilities (`e2e/setup.ts`)
- `e2eUtils.createTestEnvironment()` - Complete test environment
- `e2eUtils.executeCLI()` - CLI command execution
- `e2eUtils.createTestCSVFiles()` - CSV test data setup
- `e2eUtils.waitForFile()` - File availability waiting

### Custom Jest Matchers
- `toBeValidIntegrationSnapshot()` - Integration data validation
- `toBeValidAuditResult()` - Audit result validation
- `toBeValidExecutionPlan()` - Execution plan validation

## 🚀 Running Tests

### Local Development
```bash
# Quick test run
npm test

# Watch mode for development
npm run test:watch

# Full test suite with coverage
npm run test:coverage

# Run comprehensive test script
./scripts/run-all-tests.sh
```

### Continuous Integration
Tests are automatically run on:
- Pull requests to `main` and `develop` branches
- Pushes to `main` and `develop` branches
- Daily scheduled runs at 2 AM UTC

### CI Pipeline Stages
1. **Lint and Type Check** - Code quality validation
2. **Unit Tests** - Core functionality testing (Node 18, 20)
3. **Integration Tests** - Component interaction testing
4. **E2E Tests** - Full application testing
5. **Coverage Report** - Test coverage analysis
6. **Security Scan** - Dependency vulnerability checking
7. **Performance Test** - Large dataset processing
8. **Build Validation** - Multi-platform build testing

## 🐛 Debugging Tests

### Debug Single Test
```bash
npm run test:debug -- --testNamePattern="specific test name"
```

### Debug with VS Code
1. Set breakpoints in test files
2. Use "Debug Jest Tests" configuration
3. Run specific test file or pattern

### Common Issues
- **Timeout Errors**: Increase `testTimeout` in Jest config
- **File System Issues**: Check mock file system setup
- **Async Issues**: Ensure proper `await` usage
- **Mock Issues**: Verify mock implementations and cleanup

## 📈 Performance Considerations

### Test Performance Targets
- Unit tests: < 5 seconds total
- Integration tests: < 15 seconds total
- E2E tests: < 120 seconds total

### Optimization Strategies
- Parallel test execution (4 workers)
- Efficient mock implementations
- Minimal test data creation
- Proper cleanup between tests

## 🔍 Test Data Management

### Test Data Principles
- **Realistic**: Based on actual integration data patterns
- **Comprehensive**: Covers all edge cases and scenarios
- **Maintainable**: Easy to update and extend
- **Isolated**: No dependencies between test cases

### Data Generation
- Programmatic generation for large datasets
- Template-based creation for consistent structure
- Random data for stress testing
- Fixed data for deterministic testing

## 📝 Writing New Tests

### Test Naming Convention
```typescript
describe('ComponentName', () => {
  describe('methodName', () => {
    it('should do something when condition is met', async () => {
      // Test implementation
    });
  });
});
```

### Test Structure (AAA Pattern)
```typescript
it('should process valid integration successfully', async () => {
  // Arrange
  const integration = createTestIntegration();
  const detector = new DataDrivenCorruptionDetector();
  await detector.initialize();

  // Act
  const result = await detector.detectCorruption(integration, {});

  // Assert
  expect(result).toBeValidAuditResult();
  expect(result.corruptionEvents).toHaveLength(0);
});
```

### Best Practices
- Use descriptive test names
- Test one thing per test case
- Include both positive and negative test cases
- Test error conditions and edge cases
- Use appropriate assertions
- Clean up resources after tests
- Mock external dependencies
- Keep tests independent and isolated

## 🔗 Related Documentation

- [Main README](../README.md) - Project overview
- [Business User Guide](../docs/business-user-guide.md) - Business configuration
- [Deployment Guide](../DEPLOYMENT-GUIDE.md) - Production deployment
- [API Reference](../API-CLI-REFERENCE.md) - CLI commands and options

---

For questions about testing or to report issues with the test suite, please create an issue in the project repository.
