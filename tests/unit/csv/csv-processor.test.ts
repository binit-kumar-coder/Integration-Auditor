/**
 * Unit tests for CSVProcessor
 */

import { CSVProcessor } from '../../../src/csv/csv-processor';
import { csvTestData } from '../../fixtures/csv-data';
import { testUtils } from '../../setup';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CSVProcessor', () => {
  let processor: CSVProcessor;
  let testDir: string;

  beforeEach(async () => {
    processor = new CSVProcessor();
    testDir = await testUtils.createTestDir('csv-processor-test');
  });

  afterEach(async () => {
    // Cleanup is handled by global afterEach in setup.ts
  });

  describe('CSV file processing', () => {
    it('should process valid CSV files successfully', async () => {
      // Create test CSV files
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.sample.integrations);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.sample.imports);
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.sample.exports);
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.sample.flows);
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.sample.connections);

      const options = {
        inputDirectory: testDir,
        tier: 'tier1',
        validateHeaders: true
      };

      const result = await processor.processCSVFiles(options);

      expect(result.result.errorCount).toBe(0);
      expect(result.integrations).toHaveLength(3);
      expect(result.result.totalIntegrations).toBe(3);
      expect(result.result.processedIntegrations).toBe(3);
      expect(result.result.processingTime).toBeGreaterThan(0);

      // Verify integration structure
      const firstIntegration = result.integrations[0];
      expect(firstIntegration).toBeValidIntegrationSnapshot();
      expect(firstIntegration.id).toBe('test-001');
      expect(firstIntegration.email).toBe('user1@example.com');
      expect(firstIntegration.licenseEdition).toBe('premium');
      expect(firstIntegration.storeCount).toBe(2);
    });

    it('should handle missing CSV files gracefully', async () => {
      // Create directory but no files
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);

      expect(result.result.warnings.length).toBeGreaterThan(0);
      expect(result.integrations).toHaveLength(0);
      expect(result.result.errorCount).toBe(0); // Missing files are warnings, not errors
    });

    it('should handle malformed CSV data', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      // Create files with malformed data
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.malformed.integrations);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.malformed.imports);
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.malformed.exports);
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.malformed.flows);
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.malformed.connections);

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);

      // Should handle malformed data without crashing
      expect(result.result.errorCount).toBeGreaterThan(0);
      expect(result.result.errors.length).toBeGreaterThan(0);
      expect(result.integrations.length).toBeLessThan(3); // Some integrations may fail to process
    });

    it('should handle empty CSV files', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.edgeCases.emptyCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), '');
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), '');
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), '');
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), '');

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);

      expect(result.integrations).toHaveLength(0);
      expect(result.result.errorCount).toBe(0);
    });

    it('should handle Unicode characters in CSV data', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.edgeCases.unicodeCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.headers.imports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.headers.exports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.headers.flows.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.headers.connections.map(h => `"${h}"`).join(','));

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);

      expect(result.integrations).toHaveLength(1);
      const integration = result.integrations[0];
      expect(integration.id).toBe('test-unicode');
      expect(integration.email).toBe('用户@例子.com');
    });

    it('should handle very large CSV files', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      // Generate large dataset
      const largeIntegrationsCSV = csvTestData.large.integrations();
      const integrationIds = Array.from({ length: 100 }, (_, i) => `large-test-${String(i + 1).padStart(4, '0')}`);
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), largeIntegrationsCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.large.imports(integrationIds.slice(0, 10)));
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.large.exports(integrationIds.slice(0, 10)));
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.large.flows(integrationIds.slice(0, 10)));
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.large.connections(integrationIds.slice(0, 10)));

      const options = {
        inputDirectory: testDir,
        tier: 'tier1',
        batchSize: 50
      };

      const result = await processor.processCSVFiles(options);

      expect(result.integrations.length).toBeGreaterThan(50);
      expect(result.result.processingTime).toBeGreaterThan(0);
      expect(result.result.errorCount).toBe(0);
    });
  });

  describe('CSV validation', () => {
    it('should validate CSV headers correctly', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.sample.integrations);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.sample.imports);
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.sample.exports);
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.sample.flows);
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.sample.connections);

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const validation = await processor.validateCSVHeaders(options);

      expect(validation.valid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    it('should detect missing headers', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.edgeCases.missingColumnsCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.sample.imports);
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.sample.exports);
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.sample.flows);
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.sample.connections);

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const validation = await processor.validateCSVHeaders(options);

      expect(validation.valid).toBe(false);
      expect(validation.issues.length).toBeGreaterThan(0);
      expect(validation.issues[0]).toContain('Missing columns');
    });
  });

  describe('data transformation', () => {
    it('should transform CSV data to integration snapshots correctly', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.sample.integrations);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.sample.imports);
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.sample.exports);
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.sample.flows);
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.sample.connections);

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);
      const integration = result.integrations[0];

      // Verify proper transformation
      expect(integration.id).toBe('test-001');
      expect(integration.email).toBe('user1@example.com');
      expect(integration.version).toBe('1.51.0');
      expect(integration.storeCount).toBe(2);
      expect(integration.licenseEdition).toBe('premium');
      expect(integration.updateInProgress).toBe(false);

      // Verify settings parsing
      expect(integration.settings).toBeDefined();
      expect(integration.settings.connectorEdition).toBe('premium');
      expect(integration.settings.commonresources).toBeDefined();

      // Verify related resources
      expect(integration.imports).toHaveLength(2);
      expect(integration.exports).toHaveLength(2);
      expect(integration.flows).toHaveLength(2);
      expect(integration.connections).toHaveLength(2);

      // Verify resource structure
      const firstImport = integration.imports[0];
      expect(firstImport.externalId).toBe('customer-import');
      expect(firstImport.connectionId).toBe('conn-001');
      expect(firstImport._id).toBe('imp-001');
      expect(firstImport.type).toBe('import');
    });

    it('should handle quoted CSV values correctly', async () => {
      const quotedCSV = `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-quoted","\"user@domain.com\"","user-001","1.51.0","1","starter","false","{""connectorEdition"":""starter""}"`;

      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), quotedCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.headers.imports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.headers.exports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.headers.flows.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.headers.connections.map(h => `"${h}"`).join(','));

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);
      const integration = result.integrations[0];

      expect(integration.id).toBe('test-quoted');
      expect(integration.email).toBe('user@domain.com'); // Quotes should be cleaned
    });

    it('should handle boolean values correctly', async () => {
      const booleanTestCSV = `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-bool-1","user1@example.com","user-001","1.51.0","1","starter","true","{""connectorEdition"":""starter""}"
"test-bool-2","user2@example.com","user-002","1.51.0","1","starter","false","{""connectorEdition"":""starter""}"
"test-bool-3","user3@example.com","user-003","1.51.0","1","starter","1","{""connectorEdition"":""starter""}"
"test-bool-4","user4@example.com","user-004","1.51.0","1","starter","0","{""connectorEdition"":""starter""}"`;

      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), booleanTestCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.headers.imports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.headers.exports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.headers.flows.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.headers.connections.map(h => `"${h}"`).join(','));

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);

      expect(result.integrations[0].updateInProgress).toBe(true);
      expect(result.integrations[1].updateInProgress).toBe(false);
      expect(result.integrations[2].updateInProgress).toBe(true);
      expect(result.integrations[3].updateInProgress).toBe(false);
    });

    it('should handle malformed JSON settings gracefully', async () => {
      const malformedSettingsCSV = `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-malformed","user@example.com","user-001","1.51.0","1","starter","false","invalid-json-here"`;

      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), malformedSettingsCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.headers.imports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.headers.exports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.headers.flows.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.headers.connections.map(h => `"${h}"`).join(','));

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);
      const integration = result.integrations[0];

      // Should fall back to default settings structure
      expect(integration.settings).toBeDefined();
      expect(integration.settings.connectorEdition).toBe('starter');
    });
  });

  describe('processing statistics', () => {
    it('should provide processing statistics', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.sample.integrations);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.sample.imports);
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.sample.exports);
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.sample.flows);
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.sample.connections);

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const stats = await processor.getProcessingStats(options);

      expect(stats.fileStats).toHaveLength(5);
      expect(stats.totalSize).toBeGreaterThan(0);
      
      stats.fileStats.forEach(fileStat => {
        expect(fileStat.file).toMatch(/\.(csv)$/);
        expect(fileStat.size).toBeGreaterThan(0);
      });
    });

    it('should handle missing files in statistics', async () => {
      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      // Only create some files
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), csvTestData.sample.integrations);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.sample.imports);

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const stats = await processor.getProcessingStats(options);

      expect(stats.fileStats).toHaveLength(5); // Should include missing files with size 0
      const missingFiles = stats.fileStats.filter(f => f.size === 0);
      expect(missingFiles.length).toBe(3); // exports, flows, connections
    });
  });

  describe('error handling', () => {
    it('should handle non-existent tier directory', async () => {
      const options = {
        inputDirectory: testDir,
        tier: 'non-existent-tier'
      };

      const result = await processor.processCSVFiles(options);

      expect(result.result.errorCount).toBeGreaterThan(0);
      expect(result.result.errors[0]).toContain('Cannot access tier directory');
      expect(result.integrations).toHaveLength(0);
    });

    it('should handle file access errors gracefully', async () => {
      const options = {
        inputDirectory: '/non-existent-directory',
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);

      expect(result.result.errorCount).toBeGreaterThan(0);
      expect(result.integrations).toHaveLength(0);
    });

    it('should continue processing after individual integration errors', async () => {
      const mixedDataCSV = `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-good","user1@example.com","user-001","1.51.0","2","premium","false","{""connectorEdition"":""premium""}"
"","user2@example.com","user-002","1.51.0","1","starter","false","{""connectorEdition"":""starter""}"
"test-good-2","user3@example.com","user-003","1.51.0","1","standard","false","{""connectorEdition"":""standard""}"`;

      const tierDir = path.join(testDir, 'tier1');
      await fs.mkdir(tierDir, { recursive: true });
      
      await testUtils.createTestFile(path.join(tierDir, 'integrations.csv'), mixedDataCSV);
      await testUtils.createTestFile(path.join(tierDir, 'imports.csv'), csvTestData.headers.imports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'exports.csv'), csvTestData.headers.exports.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'flows.csv'), csvTestData.headers.flows.map(h => `"${h}"`).join(','));
      await testUtils.createTestFile(path.join(tierDir, 'connections.csv'), csvTestData.headers.connections.map(h => `"${h}"`).join(','));

      const options = {
        inputDirectory: testDir,
        tier: 'tier1'
      };

      const result = await processor.processCSVFiles(options);

      // Should process good integrations and report errors for bad ones
      expect(result.integrations.length).toBe(2); // Two valid integrations
      expect(result.result.errorCount).toBe(1); // One error for empty ID
      expect(result.result.errors[0]).toContain('Integration ID is required');
    });
  });
});
