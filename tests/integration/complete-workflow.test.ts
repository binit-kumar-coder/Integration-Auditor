/**
 * Integration tests for complete workflows
 */

import { CSVProcessor } from '../../src/csv/csv-processor';
import { DataDrivenCorruptionDetector } from '../../src/rules/data-driven-corruption-detector';
import { DataDrivenRemediationEngine } from '../../src/rules/data-driven-remediation-engine';
import { ExecutionPlanner } from '../../src/planner/execution-planner';
import { AuditLogger } from '../../src/audit/audit-logger';
import { SafetyController } from '../../src/safety/safety-controls';
import { ConfigurationManager } from '../../src/config/configuration-manager';
import { testBusinessConfig, testRemediationConfig } from '../fixtures/business-config';
import { csvTestData } from '../fixtures/csv-data';
import { MockExecutionEngine } from '../mocks/execution-engine';
import { testUtils } from '../setup';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock the configuration manager and file system
jest.mock('../../src/config/configuration-manager');
jest.mock('fs/promises');

const MockedConfigurationManager = ConfigurationManager as jest.MockedClass<typeof ConfigurationManager>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Complete Workflow Integration Tests', () => {
  let testDir: string;
  let csvProcessor: CSVProcessor;
  let corruptionDetector: DataDrivenCorruptionDetector;
  let remediationEngine: DataDrivenRemediationEngine;
  let executionPlanner: ExecutionPlanner;
  let auditLogger: AuditLogger;
  let safetyController: SafetyController;
  let mockExecutionEngine: MockExecutionEngine;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;

  beforeEach(async () => {
    testDir = await testUtils.createTestDir('integration-workflow-test');
    
    // Setup mock configuration manager
    mockConfigManager = new MockedConfigurationManager() as jest.Mocked<ConfigurationManager>;
    mockConfigManager.initialize.mockResolvedValue();
    mockConfigManager.loadConfiguration.mockResolvedValue(testBusinessConfig as any);
    
    // Setup mock file system
    mockedFs.readFile.mockImplementation(async (filePath: string) => {
      if (filePath.includes('remediation-logic.json')) {
        return JSON.stringify(testRemediationConfig);
      }
      if (filePath.includes('business-rules.json')) {
        return JSON.stringify(testBusinessConfig);
      }
      throw new Error(`File not found: ${filePath}`);
    });

    mockedFs.mkdir.mockResolvedValue(undefined as any);
    mockedFs.appendFile.mockResolvedValue();

    // Initialize components
    csvProcessor = new CSVProcessor();
    
    corruptionDetector = new DataDrivenCorruptionDetector();
    (corruptionDetector as any).configManager = mockConfigManager;
    await corruptionDetector.initialize('shopify-netsuite', '1.51.0');
    
    remediationEngine = new DataDrivenRemediationEngine();
    await remediationEngine.initialize();
    
    executionPlanner = new ExecutionPlanner();
    
    auditLogger = new AuditLogger(path.join(testDir, 'audit'), 'test-operator', 'test-session');
    await auditLogger.initialize();
    
    safetyController = new SafetyController({
      allowlist: {
        integrationIds: [],
        accounts: [],
        enabled: false
      },
      limits: {
        maxOpsPerIntegration: 100,
        maxConcurrentIntegrations: 50,
        maxTotalOperations: 1000,
        rateLimit: { requestsPerSecond: 10, burstLimit: 50 }
      },
      maintenanceWindow: {
        enabled: false,
        start: '02:00',
        end: '06:00',
        timezone: 'UTC',
        days: ['sunday']
      },
      confirmation: {
        required: false,
        thresholds: { destructiveOps: 10, totalOps: 100, highRiskIntegrations: 20 }
      },
      circuit: {
        enabled: false,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3
      }
    });
    
    mockExecutionEngine = new MockExecutionEngine();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End CSV Processing and Corruption Detection', () => {
    it('should process CSV files and detect corruptions in complete workflow', async () => {
      // Setup CSV files with known corruption issues
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });

      // Create CSV with problematic integrations
      const problematicIntegrationsCSV = `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-missing-resources","user1@example.com","user-001","1.51.0","2","premium","false","{""connectorEdition"":""premium"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{}}"
"test-license-mismatch","user2@example.com","user-002","1.51.0","1","premium","false","{""connectorEdition"":""standard"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{}}"
"test-stuck-update","user3@example.com","user-003","1.51.0","1","starter","true","{""connectorEdition"":""starter"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{}}"`

      const problematicImportsCSV = `"INTEGRATIONID","EXTERNALID","IMPORTID","IMPORTCONNECTIONID"
"test-missing-resources","import-1","imp-1","conn-1"
"test-license-mismatch","import-2","imp-2","conn-2"`;

      const problematicExportsCSV = `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"
"test-missing-resources","export-1","exp-1","conn-1"
"test-license-mismatch","export-2","exp-2","conn-2"`;

      const problematicFlowsCSV = `"INTEGRATIONID","EXTERNALID","FLOWID"
"test-missing-resources","flow-1","flow-1"`;

      const problematicConnectionsCSV = `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"
"test-missing-resources","conn-1","connection-1","false"
"test-license-mismatch","conn-2","connection-2","true"
"test-stuck-update","conn-3","connection-3","false"`;

      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), problematicIntegrationsCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), problematicImportsCSV);
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), problematicExportsCSV);
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), problematicFlowsCSV);
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), problematicConnectionsCSV);

      // Step 1: Process CSV files
      const csvResult = await csvProcessor.processCSVFiles({
        inputDirectory: testDir,
        tier: 'tier1',
        validateHeaders: true
      });

      expect(csvResult.result.errorCount).toBe(0);
      expect(csvResult.integrations).toHaveLength(3);

      // Step 2: Detect corruptions for each integration
      const corruptionResults = [];
      for (const integration of csvResult.integrations) {
        const result = await corruptionDetector.detectCorruption(integration, {});
        corruptionResults.push(result);
      }

      // Verify corruption detection results
      expect(corruptionResults).toHaveLength(3);
      
      // First integration: missing resources (premium with 2 stores should have more resources)
      const missingResourcesResult = corruptionResults.find(r => r.integrationId === 'test-missing-resources');
      expect(missingResourcesResult).toBeDefined();
      expect(missingResourcesResult!.corruptionEvents.length).toBeGreaterThan(0);
      expect(missingResourcesResult!.corruptionEvents.some(e => e.params.corruptionType.includes('count'))).toBe(true);

      // Second integration: license mismatch
      const licenseMismatchResult = corruptionResults.find(r => r.integrationId === 'test-license-mismatch');
      expect(licenseMismatchResult).toBeDefined();
      expect(licenseMismatchResult!.corruptionEvents.some(e => e.params.corruptionType === 'license-edition-mismatch')).toBe(true);

      // Third integration: stuck in update
      const stuckUpdateResult = corruptionResults.find(r => r.integrationId === 'test-stuck-update');
      expect(stuckUpdateResult).toBeDefined();
      expect(stuckUpdateResult!.corruptionEvents.some(e => e.params.corruptionType === 'stuck-in-update-process')).toBe(true);

      // Step 3: Generate remediation actions
      const remediationResults = [];
      for (const corruptionResult of corruptionResults) {
        if (corruptionResult.corruptionEvents.length > 0) {
          const remediationResult = await remediationEngine.generateActions(
            corruptionResult.corruptionEvents,
            {
              integrationId: corruptionResult.integrationId,
              email: corruptionResult.email,
              storeCount: 2,
              edition: 'premium',
              operatorId: 'test-operator',
              dryRun: false,
              maxOpsPerIntegration: 100
            }
          );
          remediationResults.push(remediationResult);
        }
      }

      expect(remediationResults.length).toBeGreaterThan(0);
      
      // Verify remediation actions were generated
      remediationResults.forEach(result => {
        expect(result.actions.length).toBeGreaterThan(0);
        expect(result.summary).toBeDefined();
        expect(result.businessAnalysis).toBeDefined();
      });
    });
  });

  describe('Complete Remediation Workflow', () => {
    it('should execute complete remediation workflow from detection to execution', async () => {
      // Create a problematic integration
      const problematicIntegration = {
        id: 'test-complete-workflow',
        email: 'workflow@example.com',
        userId: 'user-workflow',
        version: '1.51.0',
        storeCount: 1,
        licenseEdition: 'starter' as const,
        updateInProgress: true, // Stuck in update
        settings: {
          connectorEdition: 'premium', // License mismatch
          general: {},
          storemap: [],
          sections: [],
          commonresources: {} // Missing required properties
        },
        imports: [], // Missing imports for starter edition
        exports: [], // Missing exports for starter edition
        flows: [], // Missing flows for starter edition
        connections: [
          { _id: 'conn-1', name: 'Connection 1', type: 'connection', offline: true }
        ]
      };

      // Step 1: Detect corruptions
      const corruptionResult = await corruptionDetector.detectCorruption(problematicIntegration, {});
      
      expect(corruptionResult.corruptionEvents.length).toBeGreaterThan(3);
      expect(corruptionResult.overallSeverity).toBeOneOf(['high', 'critical']);

      // Step 2: Generate remediation actions
      const remediationResult = await remediationEngine.generateActions(
        corruptionResult.corruptionEvents,
        {
          integrationId: problematicIntegration.id,
          email: problematicIntegration.email,
          storeCount: problematicIntegration.storeCount,
          edition: problematicIntegration.licenseEdition,
          operatorId: 'test-operator',
          dryRun: false,
          maxOpsPerIntegration: 100
        }
      );

      expect(remediationResult.actions.length).toBeGreaterThan(0);

      // Step 3: Create execution plan
      const executionPlan = executionPlanner.createExecutionPlan(
        problematicIntegration,
        {
          integrationId: problematicIntegration.id,
          email: problematicIntegration.email,
          version: problematicIntegration.version,
          edition: problematicIntegration.licenseEdition,
          fixable: true,
          issues: {
            importsCheck: { missing: ['import1'], duplicate: [] },
            exportsCheck: { missing: ['export1'], duplicate: [] },
            flowsCheck: { missing: ['flow1'], duplicate: [] },
            connectionsCheck: { missing: [], duplicate: [] },
            offlineConnections: ['conn-1'],
            missingSettings: [{ section: 'commonresources', keys: ['netsuiteConnectionId'] }],
            updateInProgress: true
          },
          severity: 'high',
          estimatedFixTime: 5000
        },
        testBusinessConfig,
        { maxOpsPerIntegration: 100 }
      );

      expect(executionPlan).toBeValidExecutionPlan();
      expect(executionPlan.actions.length).toBeGreaterThan(0);

      // Step 4: Safety check
      const safetyCheck = await safetyController.performPreflightCheck(
        [problematicIntegration.id],
        [{ 
          actions: executionPlan.actions,
          summary: executionPlan.summary 
        }],
        'test-operator'
      );

      expect(safetyCheck.allowed).toBe(true);

      // Step 5: Execute plan (dry run)
      const executionOptions = {
        dryRun: true,
        maxOpsPerIntegration: 100,
        rateLimit: { actionsPerSecond: 10, burstLimit: 50 },
        retries: { maxAttempts: 3, backoffMultiplier: 2, maxDelay: 5000 },
        safety: {
          requireConfirmation: false,
          allowDestructive: true
        }
      };

      const executionResult = await executionPlanner.executePlan(
        executionPlan,
        mockExecutionEngine,
        executionOptions
      );

      expect(executionResult.status).toBe('success');
      expect(executionResult.actions.executed.length).toBe(executionPlan.actions.length);
      expect(executionResult.actions.failed.length).toBe(0);

      // Step 6: Log audit trail
      await auditLogger.logExecutionResult(executionResult, {
        operatorId: 'test-operator',
        dryRun: true,
        environment: 'test'
      });

      // Verify audit logging
      expect(mockedFs.appendFile).toHaveBeenCalled();
    });
  });

  describe('Error Handling in Complete Workflow', () => {
    it('should handle errors gracefully throughout the workflow', async () => {
      // Create an integration that will cause various errors
      const errorProneIntegration = {
        id: 'test-error-handling',
        email: 'error@example.com',
        userId: 'user-error',
        version: '1.51.0',
        storeCount: 1,
        licenseEdition: 'unknown-edition' as any, // Invalid edition
        updateInProgress: false,
        settings: null, // Null settings should be handled gracefully
        imports: null,
        exports: null,
        flows: null,
        connections: null
      };

      // Step 1: Detect corruptions (should handle gracefully)
      const corruptionResult = await corruptionDetector.detectCorruption(errorProneIntegration, {});
      
      expect(corruptionResult).toBeDefined();
      expect(corruptionResult.integrationId).toBe(errorProneIntegration.id);

      // Step 2: Generate remediation actions (should handle gracefully)
      const remediationResult = await remediationEngine.generateActions(
        corruptionResult.corruptionEvents,
        {
          integrationId: errorProneIntegration.id,
          email: errorProneIntegration.email,
          storeCount: errorProneIntegration.storeCount,
          edition: 'starter', // Use valid edition for remediation
          operatorId: 'test-operator',
          dryRun: true,
          maxOpsPerIntegration: 100
        }
      );

      expect(remediationResult).toBeDefined();
      expect(remediationResult.integrationId).toBe(errorProneIntegration.id);
    });

    it('should handle execution failures and provide rollback options', async () => {
      // Create a simple integration for testing execution failures
      const testIntegration = {
        id: 'test-execution-failure',
        email: 'execution@example.com',
        userId: 'user-execution',
        version: '1.51.0',
        storeCount: 1,
        licenseEdition: 'starter' as const,
        updateInProgress: false,
        settings: { connectorEdition: 'starter' },
        imports: [],
        exports: [],
        flows: [],
        connections: []
      };

      // Create a simple execution plan
      const executionPlan = executionPlanner.createExecutionPlan(
        testIntegration,
        {
          integrationId: testIntegration.id,
          email: testIntegration.email,
          version: testIntegration.version,
          edition: testIntegration.licenseEdition,
          fixable: true,
          issues: {
            importsCheck: { missing: ['import1'], duplicate: [] },
            exportsCheck: { missing: [], duplicate: [] },
            flowsCheck: { missing: [], duplicate: [] },
            connectionsCheck: { missing: [], duplicate: [] },
            offlineConnections: [],
            missingSettings: [],
            updateInProgress: false
          },
          severity: 'medium',
          estimatedFixTime: 2000
        },
        testBusinessConfig,
        { maxOpsPerIntegration: 100 }
      );

      // Configure mock execution engine to fail some actions
      mockExecutionEngine.setFailureRate(0.5); // 50% failure rate

      const executionOptions = {
        dryRun: false,
        maxOpsPerIntegration: 100,
        rateLimit: { actionsPerSecond: 10, burstLimit: 50 },
        retries: { maxAttempts: 1, backoffMultiplier: 1, maxDelay: 1000 },
        safety: {
          requireConfirmation: false,
          allowDestructive: true
        }
      };

      const executionResult = await executionPlanner.executePlan(
        executionPlan,
        mockExecutionEngine,
        executionOptions
      );

      // Should handle failures gracefully
      expect(executionResult.status).toBeOneOf(['partial', 'failed', 'success']);
      expect(executionResult.actions.executed.length + executionResult.actions.failed.length).toBe(executionPlan.actions.length);

      if (executionResult.status === 'failed' && executionPlan.safety.rollbackPlan) {
        expect(executionResult.rollback).toBeDefined();
        expect(executionResult.rollback!.available).toBe(true);
        expect(executionResult.rollback!.actions.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Performance and Scale Testing', () => {
    it('should handle large datasets efficiently', async () => {
      // Create large dataset
      const largeIntegrationCount = 100;
      const largeIntegrations = Array.from({ length: largeIntegrationCount }, (_, i) => ({
        id: `large-test-${String(i + 1).padStart(4, '0')}`,
        email: `user${i + 1}@example.com`,
        userId: `user-${i + 1}`,
        version: '1.51.0',
        storeCount: Math.floor(Math.random() * 3) + 1,
        licenseEdition: ['starter', 'standard', 'premium'][Math.floor(Math.random() * 3)] as any,
        updateInProgress: Math.random() < 0.1,
        settings: { connectorEdition: 'starter' },
        imports: Array.from({ length: Math.floor(Math.random() * 20) }, (_, j) => ({
          externalId: `import-${i}-${j}`,
          connectionId: `conn-${i}`,
          _id: `imp-${i}-${j}`,
          name: `Import ${i}-${j}`,
          type: 'import' as const
        })),
        exports: Array.from({ length: Math.floor(Math.random() * 20) }, (_, j) => ({
          externalId: `export-${i}-${j}`,
          connectionId: `conn-${i}`,
          _id: `exp-${i}-${j}`,
          name: `Export ${i}-${j}`,
          type: 'export' as const
        })),
        flows: Array.from({ length: Math.floor(Math.random() * 15) }, (_, j) => ({
          _id: `flow-${i}-${j}`,
          name: `Flow ${i}-${j}`,
          type: 'flow' as const
        })),
        connections: [
          { _id: `conn-${i}`, name: `Connection ${i}`, type: 'connection', offline: Math.random() < 0.2 }
        ]
      }));

      const startTime = Date.now();

      // Process large dataset through corruption detection
      const corruptionResults = [];
      for (const integration of largeIntegrations.slice(0, 10)) { // Test with subset for speed
        const result = await corruptionDetector.detectCorruption(integration, {});
        corruptionResults.push(result);
      }

      const processingTime = Date.now() - startTime;

      // Verify performance (should process 10 integrations reasonably quickly)
      expect(processingTime).toBeLessThan(10000); // Less than 10 seconds
      expect(corruptionResults).toHaveLength(10);
      
      // Verify all results are valid
      corruptionResults.forEach(result => {
        expect(result).toBeValidAuditResult();
        expect(result.integrationId).toMatch(/^large-test-\d{4}$/);
      });
    });

    it('should handle concurrent processing safely', async () => {
      // Create multiple integrations for concurrent processing
      const integrations = Array.from({ length: 5 }, (_, i) => ({
        id: `concurrent-test-${i + 1}`,
        email: `concurrent${i + 1}@example.com`,
        userId: `user-concurrent-${i + 1}`,
        version: '1.51.0',
        storeCount: 1,
        licenseEdition: 'starter' as const,
        updateInProgress: false,
        settings: { connectorEdition: 'starter' },
        imports: [],
        exports: [],
        flows: [],
        connections: []
      }));

      // Process all integrations concurrently
      const promises = integrations.map(integration => 
        corruptionDetector.detectCorruption(integration, {})
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result).toBeValidAuditResult();
        expect(result.integrationId).toBe(`concurrent-test-${index + 1}`);
      });
    });
  });

  describe('Audit Trail and Compliance', () => {
    it('should maintain complete audit trail throughout workflow', async () => {
      const testIntegration = {
        id: 'test-audit-trail',
        email: 'audit@example.com',
        userId: 'user-audit',
        version: '1.51.0',
        storeCount: 1,
        licenseEdition: 'starter' as const,
        updateInProgress: false,
        settings: { connectorEdition: 'starter' },
        imports: [],
        exports: [],
        flows: [],
        connections: []
      };

      // Step 1: Detect corruptions and log
      const corruptionResult = await corruptionDetector.detectCorruption(testIntegration, {});
      
      // Step 2: Generate remediation and log
      if (corruptionResult.corruptionEvents.length > 0) {
        const remediationResult = await remediationEngine.generateActions(
          corruptionResult.corruptionEvents,
          {
            integrationId: testIntegration.id,
            email: testIntegration.email,
            storeCount: testIntegration.storeCount,
            edition: testIntegration.licenseEdition,
            operatorId: 'test-operator',
            dryRun: true,
            maxOpsPerIntegration: 100
          }
        );

        // Step 3: Log each action
        for (const action of remediationResult.actions) {
          await auditLogger.logAction({
            actionId: action.id,
            integrationId: testIntegration.id,
            actionType: action.type,
            resourceType: action.target.resourceType,
            resourceId: action.target.resourceId,
            payload: action.payload,
            metadata: action.metadata,
            timestamp: new Date().toISOString(),
            status: 'dry_run_success'
          });
        }

        // Verify audit logging occurred
        expect(mockedFs.appendFile).toHaveBeenCalledTimes(remediationResult.actions.length);
      }

      // Step 4: Create restore bundle
      const bundleId = await auditLogger.createRestoreBundle(
        [{
          integrationId: testIntegration.id,
          email: testIntegration.email,
          beforeSnapshot: testIntegration,
          afterSnapshot: testIntegration, // Same for test
          actions: []
        }],
        'Test workflow restore bundle'
      );

      expect(bundleId).toBeDefined();
      expect(bundleId).toMatch(/^restore_\d+_\w+$/);
    });
  });
});

// Extend Jest matchers
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}
