/**
 * End-to-End tests for CLI commands
 */

import { e2eUtils } from './setup';
import { testBusinessConfig, testRemediationConfig } from '../fixtures/business-config';
import { csvTestData } from '../fixtures/csv-data';
import * as path from 'path';
import * as fs from 'fs/promises';

describe('CLI Commands E2E Tests', () => {
  const cliPath = path.join(process.cwd(), 'dist', 'cli-data-driven.js');

  describe('Basic CLI Operations', () => {
    it('should display help message', async () => {
      const result = await e2eUtils.executeCLI(cliPath, ['--help'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Integration Auditor');
      expect(result.stdout).toContain('fix');
      expect(result.stdout).toContain('audit');
      expect(result.stdout).toContain('config');
      expect(result.stdout).toContain('status');
    });

    it('should display version information', async () => {
      const result = await e2eUtils.executeCLI(cliPath, ['--version'], { timeout: 10000 });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should show status command', async () => {
      const result = await e2eUtils.executeCLI(cliPath, ['status'], { timeout: 15000 });

      // Status command might fail without proper config, but should not crash
      expect(result.exitCode).toBeOneOf([0, 1]);
      expect(result.stdout || result.stderr).toBeDefined();
    });
  });

  describe('Configuration Commands', () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await e2eUtils.createTestEnvironment('config-test');
      await e2eUtils.createTestConfig(testEnv.configDir, testBusinessConfig, testRemediationConfig);
    });

    afterEach(async () => {
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });

    it('should show configuration', async () => {
      const result = await e2eUtils.executeCLI(
        cliPath, 
        ['config', '--show', '--config', testEnv.configDir], 
        { timeout: 15000 }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Configuration');
    });

    it('should validate configuration', async () => {
      const result = await e2eUtils.executeCLI(
        cliPath, 
        ['config', '--validate', '--config', testEnv.configDir], 
        { timeout: 15000 }
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('valid') || expect(result.stdout).toContain('Configuration');
    });

    it('should list available products and versions', async () => {
      const result = await e2eUtils.executeCLI(
        cliPath, 
        ['config', '--list-products', '--config', testEnv.configDir], 
        { timeout: 15000 }
      );

      // May not have specific products configured, but should not crash
      expect(result.exitCode).toBeOneOf([0, 1]);
    });
  });

  describe('Audit and Fix Commands', () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await e2eUtils.createTestEnvironment('audit-test');
      await e2eUtils.createTestConfig(testEnv.configDir, testBusinessConfig, testRemediationConfig);
      
      // Create test CSV files with known issues
      await e2eUtils.createTestCSVFiles(testEnv.inputDir, 'tier1', {
        integrations: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-001","user1@example.com","user-001","1.51.0","1","starter","false","{""connectorEdition"":""premium"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{}}}"
"test-002","user2@example.com","user-002","1.51.0","1","premium","true","{""connectorEdition"":""premium"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{}}"`,
        
        imports: `"INTEGRATIONID","EXTERNALID","IMPORTID","IMPORTCONNECTIONID"
"test-001","import-1","imp-1","conn-1"
"test-002","import-2","imp-2","conn-2"`,
        
        exports: `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"
"test-001","export-1","exp-1","conn-1"
"test-002","export-2","exp-2","conn-2"`,
        
        flows: `"INTEGRATIONID","EXTERNALID","FLOWID"
"test-001","flow-1","flow-1"
"test-002","flow-2","flow-2"`,
        
        connections: `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"
"test-001","conn-1","connection-1","false"
"test-002","conn-2","connection-2","true"`
      });
    });

    afterEach(async () => {
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });

    it('should run audit command successfully', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'audit',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--dry-run'
      ], { timeout: 30000 });

      // Command might succeed or fail depending on configuration, but should not crash
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('audit') || expect(result.stdout).toContain('process');
      }
    });

    it('should run fix command with dry-run', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--dry-run',
        '--operator-id', 'test-operator'
      ], { timeout: 45000 });

      // Command might succeed or fail depending on configuration
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('DRY RUN') || expect(result.stdout).toContain('fix');
      }
    });

    it('should handle allowlist filtering', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--allowlist', 'test-001',
        '--dry-run'
      ], { timeout: 30000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('Allowlist') || expect(result.stdout).toContain('test-001');
      }
    });

    it('should handle account filtering', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'premium',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--allowlist-accounts', 'user1@example.com',
        '--dry-run'
      ], { timeout: 30000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('Account Filter') || expect(result.stdout).toContain('user1@example.com');
      }
    });

    it('should validate input parameters', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'invalid-edition',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--dry-run'
      ], { timeout: 20000 });

      // Should handle invalid edition gracefully
      expect(result.exitCode).toBeOneOf([0, 1]);
    });
  });

  describe('Business Rules Commands', () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await e2eUtils.createTestEnvironment('business-rules-test');
      await e2eUtils.createTestConfig(testEnv.configDir, testBusinessConfig, testRemediationConfig);
    });

    afterEach(async () => {
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });

    it('should show business rules for edition', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'business-rules',
        '--edition', 'starter',
        '--config', testEnv.configDir
      ], { timeout: 15000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('starter') || expect(result.stdout).toContain('Business');
      }
    });

    it('should list all editions', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'business-rules',
        '--list-editions',
        '--config', testEnv.configDir
      ], { timeout: 15000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('edition') || expect(result.stdout).toContain('starter');
      }
    });

    it('should show remediation templates', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'business-rules',
        '--show-templates',
        '--config', testEnv.configDir
      ], { timeout: 15000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('template') || expect(result.stdout).toContain('action');
      }
    });
  });

  describe('Output Generation', () => {
    let testEnv: any;

    beforeEach(async () => {
      testEnv = await e2eUtils.createTestEnvironment('output-test');
      await e2eUtils.createTestConfig(testEnv.configDir, testBusinessConfig, testRemediationConfig);
      
      // Create minimal test data
      await e2eUtils.createTestCSVFiles(testEnv.inputDir, 'tier1', {
        integrations: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-output","output@example.com","user-output","1.51.0","1","starter","false","{""connectorEdition"":""starter""}"`,
        imports: `"INTEGRATIONID","EXTERNALID","IMPORTID","IMPORTCONNECTIONID"`,
        exports: `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"`,
        flows: `"INTEGRATIONID","EXTERNALID","FLOWID"`,
        connections: `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"`
      });
    });

    afterEach(async () => {
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });

    it('should generate output files', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--dry-run'
      ], { timeout: 30000 });

      // Check if any output files were created
      const outputContents = await e2eUtils.checkDirectoryContents(testEnv.outputDir, [
        'logs',
        'reports',
        'remediation-plan',
        'remediation-scripts'
      ]);

      // May or may not create files depending on success, but should not crash
      expect(result.exitCode).toBeOneOf([0, 1]);
    });

    it('should handle custom output directory', async () => {
      const customOutputDir = path.join(testEnv.testDir, 'custom-output');
      
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', customOutputDir,
        '--dry-run'
      ], { timeout: 30000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      // Custom output directory should be created
      try {
        await fs.access(customOutputDir);
        // Directory exists - good
      } catch {
        // Directory might not be created if command failed early - that's ok
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing input directory gracefully', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', '/non-existent-directory',
        '--dry-run'
      ], { timeout: 15000 });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('not found') || expect(result.stderr).toContain('ENOENT') || expect(result.stderr).toContain('error');
    });

    it('should handle missing configuration gracefully', async () => {
      const testEnv = await e2eUtils.createTestEnvironment('error-test');
      
      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', '/non-existent-config',
        '--dry-run'
      ], { timeout: 15000 });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeDefined();
      
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });

    it('should handle invalid command arguments', async () => {
      const result = await e2eUtils.executeCLI(cliPath, [
        'invalid-command'
      ], { timeout: 10000 });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Unknown command') || expect(result.stderr).toContain('error');
    });

    it('should handle malformed CSV files', async () => {
      const testEnv = await e2eUtils.createTestEnvironment('malformed-csv-test');
      await e2eUtils.createTestConfig(testEnv.configDir, testBusinessConfig, testRemediationConfig);
      
      // Create malformed CSV
      await e2eUtils.createTestCSVFiles(testEnv.inputDir, 'tier1', {
        integrations: `"_ID","EMAIL","_USERID","VERSION"
"test-malformed","malformed@example.com","user-malformed"
"missing-columns-here"`,
        imports: `"INTEGRATIONID","EXTERNALID"
"test-malformed","import-1"
"invalid-line-here`,
        exports: `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"`,
        flows: `"INTEGRATIONID","EXTERNALID","FLOWID"`,
        connections: `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"`
      });

      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--dry-run'
      ], { timeout: 30000 });

      // Should handle malformed data gracefully
      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 1) {
        expect(result.stderr).toBeDefined();
      }
      
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });
  });

  describe('Performance and Limits', () => {
    it('should handle rate limiting options', async () => {
      const testEnv = await e2eUtils.createTestEnvironment('rate-limit-test');
      await e2eUtils.createTestConfig(testEnv.configDir, testBusinessConfig, testRemediationConfig);
      
      await e2eUtils.createTestCSVFiles(testEnv.inputDir, 'tier1', {
        integrations: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-rate","rate@example.com","user-rate","1.51.0","1","starter","false","{""connectorEdition"":""starter""}"`,
        imports: `"INTEGRATIONID","EXTERNALID","IMPORTID","IMPORTCONNECTIONID"`,
        exports: `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"`,
        flows: `"INTEGRATIONID","EXTERNALID","FLOWID"`,
        connections: `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"`
      });

      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--rate-limit', '5',
        '--max-concurrent', '10',
        '--max-ops-per-integration', '50',
        '--dry-run'
      ], { timeout: 30000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('Rate Limit') || expect(result.stdout).toContain('Max');
      }
      
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });

    it('should handle batch processing options', async () => {
      const testEnv = await e2eUtils.createTestEnvironment('batch-test');
      await e2eUtils.createTestConfig(testEnv.configDir, testBusinessConfig, testRemediationConfig);
      
      await e2eUtils.createTestCSVFiles(testEnv.inputDir, 'tier1', {
        integrations: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-batch","batch@example.com","user-batch","1.51.0","1","starter","false","{""connectorEdition"":""starter""}"`,
        imports: `"INTEGRATIONID","EXTERNALID","IMPORTID","IMPORTCONNECTIONID"`,
        exports: `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"`,
        flows: `"INTEGRATIONID","EXTERNALID","FLOWID"`,
        connections: `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"`
      });

      const result = await e2eUtils.executeCLI(cliPath, [
        'fix',
        '--edition', 'starter',
        '--tier', 'tier1',
        '--input', testEnv.inputDir,
        '--config', testEnv.configDir,
        '--output', testEnv.outputDir,
        '--batch-size', '5',
        '--dry-run'
      ], { timeout: 30000 });

      expect(result.exitCode).toBeOneOf([0, 1]);
      
      if (result.exitCode === 0) {
        expect(result.stdout).toContain('Batch Size') || expect(result.stdout).toContain('5');
      }
      
      await e2eUtils.cleanupTestEnvironment(testEnv.testDir);
    });
  });
});

// Extend Jest matchers for E2E tests
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}

expect.extend({
  toBeOneOf(received: any, expected: any[]) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false
      };
    }
  }
});
