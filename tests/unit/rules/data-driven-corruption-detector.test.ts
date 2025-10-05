/**
 * Unit tests for DataDrivenCorruptionDetector
 */

import { DataDrivenCorruptionDetector } from '../../../src/rules/data-driven-corruption-detector';
import { ConfigurationManager } from '../../../src/config/configuration-manager';
import { integrationSnapshots } from '../../fixtures/integration-snapshots';
import { testBusinessConfig } from '../../fixtures/business-config';
import { MockFileSystem } from '../../mocks/file-system';

// Mock the configuration manager
jest.mock('../../../src/config/configuration-manager');
const MockedConfigurationManager = ConfigurationManager as jest.MockedClass<typeof ConfigurationManager>;

describe('DataDrivenCorruptionDetector', () => {
  let detector: DataDrivenCorruptionDetector;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;
  let mockFs: MockFileSystem;

  beforeEach(async () => {
    // Setup mock file system
    mockFs = new MockFileSystem();
    
    // Setup mock configuration manager
    mockConfigManager = new MockedConfigurationManager() as jest.Mocked<ConfigurationManager>;
    mockConfigManager.initialize.mockResolvedValue();
    mockConfigManager.loadConfiguration.mockResolvedValue(testBusinessConfig as any);
    
    // Create detector and mock its config manager
    detector = new DataDrivenCorruptionDetector();
    (detector as any).configManager = mockConfigManager;
    
    await detector.initialize('shopify-netsuite', '1.51.0');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const newDetector = new DataDrivenCorruptionDetector();
      (newDetector as any).configManager = mockConfigManager;
      
      await expect(newDetector.initialize('shopify-netsuite', '1.51.0')).resolves.not.toThrow();
      expect(mockConfigManager.initialize).toHaveBeenCalled();
      expect(mockConfigManager.loadConfiguration).toHaveBeenCalledWith('shopify-netsuite', '1.51.0');
    });

    it('should throw error when configuration loading fails', async () => {
      mockConfigManager.loadConfiguration.mockRejectedValue(new Error('Config not found'));
      
      const newDetector = new DataDrivenCorruptionDetector();
      (newDetector as any).configManager = mockConfigManager;
      
      await expect(newDetector.initialize('invalid-product', '1.0.0')).rejects.toThrow('Config not found');
    });

    it('should get available configurations', async () => {
      const mockConfigs = {
        products: ['shopify-netsuite', 'shopify-hubspot'],
        productVersions: {
          'shopify-netsuite': ['1.51.0', '1.52.0'],
          'shopify-hubspot': ['2.0.0']
        }
      };
      mockConfigManager.listConfigurations.mockResolvedValue(mockConfigs);

      const configs = await detector.getAvailableConfigurations();
      
      expect(configs.products).toEqual(mockConfigs.products);
      expect(configs.productVersions).toEqual(mockConfigs.productVersions);
      expect(configs.currentConfig).toEqual({ product: 'shopify-netsuite', version: '1.51.0' });
    });
  });

  describe('corruption detection', () => {
    it('should detect no corruption in valid integration', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.valid, {});
      
      expect(result).toBeValidAuditResult();
      expect(result.integrationId).toBe(integrationSnapshots.valid.id);
      expect(result.email).toBe(integrationSnapshots.valid.email);
      expect(result.corruptionEvents).toHaveLength(0);
      expect(result.overallSeverity).toBe('low');
    });

    it('should detect missing resources', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.missingResources, {});
      
      expect(result.corruptionEvents.length).toBeGreaterThan(0);
      
      const resourceCountEvents = result.corruptionEvents.filter(e => 
        e.params.corruptionType.includes('count')
      );
      expect(resourceCountEvents.length).toBeGreaterThan(0);
      
      // Should detect missing imports, exports, and flows
      const importEvent = resourceCountEvents.find(e => e.params.corruptionType === 'incorrect-import-count');
      const exportEvent = resourceCountEvents.find(e => e.params.corruptionType === 'incorrect-export-count');
      const flowEvent = resourceCountEvents.find(e => e.params.corruptionType === 'incorrect-flow-count');
      
      expect(importEvent).toBeDefined();
      expect(exportEvent).toBeDefined();
      expect(flowEvent).toBeDefined();
    });

    it('should detect duplicate resources', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.duplicateResources, {});
      
      expect(result.corruptionEvents.length).toBeGreaterThan(0);
      
      const resourceCountEvents = result.corruptionEvents.filter(e => 
        e.params.corruptionType.includes('count')
      );
      expect(resourceCountEvents.length).toBeGreaterThan(0);
      
      // Verify details show duplicate status
      resourceCountEvents.forEach(event => {
        expect(event.params.details).toBeDefined();
        expect(event.params.details.difference).toBeGreaterThan(0);
        expect(event.params.details.status).toBe('DUPLICATE_RESOURCES');
      });
    });

    it('should detect offline connections with active resources', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.offlineConnections, {});
      
      const offlineEvent = result.corruptionEvents.find(e => 
        e.params.corruptionType === 'offline-connections'
      );
      
      expect(offlineEvent).toBeDefined();
      expect(offlineEvent!.params.severity).toBe('high');
      expect(offlineEvent!.params.details).toBeDefined();
      expect(offlineEvent!.params.details.offlineConnections).toBeDefined();
      expect(offlineEvent!.params.details.totalAffectedResources).toBeGreaterThan(0);
    });

    it('should detect license edition mismatch', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.licenseMismatch, {});
      
      const licenseEvent = result.corruptionEvents.find(e => 
        e.params.corruptionType === 'license-edition-mismatch'
      );
      
      expect(licenseEvent).toBeDefined();
      expect(licenseEvent!.params.details).toBeDefined();
      expect(licenseEvent!.params.details.licenseEdition).toBe('premium');
      expect(licenseEvent!.params.details.connectorEdition).toBe('standard');
    });

    it('should detect missing properties', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.missingProperties, {});
      
      const propertiesEvent = result.corruptionEvents.find(e => 
        e.params.corruptionType === 'missing-properties'
      );
      
      expect(propertiesEvent).toBeDefined();
      expect(propertiesEvent!.params.details).toBeDefined();
      expect(propertiesEvent!.params.details.missingProperties).toBeDefined();
      expect(propertiesEvent!.params.details.missingProperties.length).toBeGreaterThan(0);
    });

    it('should detect stuck update process', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.stuckInUpdate, {});
      
      const updateEvent = result.corruptionEvents.find(e => 
        e.params.corruptionType === 'stuck-in-update-process'
      );
      
      expect(updateEvent).toBeDefined();
      expect(updateEvent!.params.severity).toBe('high');
    });

    it('should detect multiple issues in problematic integration', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.multipleIssues, {});
      
      expect(result.corruptionEvents.length).toBeGreaterThan(3);
      expect(result.overallSeverity).toBeOneOf(['high', 'critical']);
      
      // Should have various types of corruption
      const corruptionTypes = result.corruptionEvents.map(e => e.params.corruptionType);
      expect(corruptionTypes).toContain('license-edition-mismatch');
      expect(corruptionTypes).toContain('missing-properties');
      expect(corruptionTypes).toContain('stuck-in-update-process');
      expect(corruptionTypes).toContain('offline-connections');
    });

    it('should provide business analysis with corruption details', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.multipleIssues, {});
      
      expect(result.businessAnalysis).toBeDefined();
      expect(result.businessAnalysis.integrationProfile).toBeDefined();
      expect(result.businessAnalysis.corruptionSummary).toBeDefined();
      expect(result.businessAnalysis.businessImpact).toBeDefined();
      expect(result.businessAnalysis.recommendedActions).toBeDefined();
      
      expect(result.businessAnalysis.integrationProfile.id).toBe(integrationSnapshots.multipleIssues.id);
      expect(result.businessAnalysis.corruptionSummary.totalEvents).toBe(result.corruptionEvents.length);
    });
  });

  describe('resource count validation', () => {
    it('should validate starter edition resource counts correctly', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.validStarter, {});
      
      const resourceCountEvents = result.corruptionEvents.filter(e => 
        e.params.corruptionType.includes('count')
      );
      
      expect(resourceCountEvents).toHaveLength(0);
    });

    it('should validate shopify markets edition resource counts correctly', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.validShopifyMarkets, {});
      
      const resourceCountEvents = result.corruptionEvents.filter(e => 
        e.params.corruptionType.includes('count')
      );
      
      expect(resourceCountEvents).toHaveLength(0);
    });

    it('should handle unknown edition gracefully', async () => {
      const unknownEditionIntegration = {
        ...integrationSnapshots.valid,
        licenseEdition: 'unknown-edition' as any
      };
      
      const result = await detector.detectCorruption(unknownEditionIntegration, {});
      
      // Should not crash, but may not detect resource count issues
      expect(result.corruptionEvents).toBeDefined();
    });
  });

  describe('configuration management', () => {
    it('should switch configuration successfully', async () => {
      const newConfig = { ...testBusinessConfig, version: '2.0.0' };
      mockConfigManager.loadConfiguration.mockResolvedValueOnce(newConfig as any);
      
      await detector.switchConfiguration('shopify-netsuite', '2.0.0');
      
      expect(mockConfigManager.loadConfiguration).toHaveBeenCalledWith('shopify-netsuite', '2.0.0');
    });

    it('should reload business configuration', async () => {
      const reloadedConfig = { ...testBusinessConfig, metadata: { ...testBusinessConfig.metadata, reloaded: true } };
      mockConfigManager.loadConfiguration.mockResolvedValueOnce(reloadedConfig as any);
      
      await detector.reloadBusinessConfig();
      
      expect(mockConfigManager.loadConfiguration).toHaveBeenCalledWith('shopify-netsuite', '1.51.0');
    });

    it('should get business config', () => {
      const config = detector.getBusinessConfig();
      expect(config).toEqual(testBusinessConfig);
    });
  });

  describe('error handling', () => {
    it('should throw error when detecting corruption before initialization', async () => {
      const uninitializedDetector = new DataDrivenCorruptionDetector();
      
      await expect(
        uninitializedDetector.detectCorruption(integrationSnapshots.valid, {})
      ).rejects.toThrow('System not initialized');
    });

    it('should handle malformed integration data gracefully', async () => {
      const malformedIntegration = {
        ...integrationSnapshots.valid,
        settings: null,
        imports: null,
        exports: null,
        flows: null,
        connections: null
      };
      
      const result = await detector.detectCorruption(malformedIntegration as any, {});
      
      // Should not crash and should return some result
      expect(result).toBeDefined();
      expect(result.integrationId).toBe(malformedIntegration.id);
    });

    it('should handle missing business config fields gracefully', async () => {
      const incompleteConfig = {
        editionRequirements: {},
        licenseValidation: { validEditions: [] },
        requiredProperties: { topLevel: [], settingsLevel: [], commonresources: [], sectionProperties: [] },
        tolerances: { resourceCountTolerance: 0 }
      };
      
      mockConfigManager.loadConfiguration.mockResolvedValueOnce(incompleteConfig as any);
      
      const newDetector = new DataDrivenCorruptionDetector();
      (newDetector as any).configManager = mockConfigManager;
      
      await newDetector.initialize('test-product', '1.0.0');
      const result = await newDetector.detectCorruption(integrationSnapshots.valid, {});
      
      expect(result).toBeDefined();
    });
  });

  describe('metadata and logging', () => {
    it('should include metadata in corruption events', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.multipleIssues, {});
      
      result.corruptionEvents.forEach(event => {
        expect(event.metadata).toBeDefined();
        expect(event.metadata.detectedAt).toBeDefined();
        expect(event.metadata.ruleId).toBeDefined();
        expect(event.metadata.businessLogic).toBeDefined();
      });
    });

    it('should provide business logic explanations for corruption types', async () => {
      const result = await detector.detectCorruption(integrationSnapshots.missingResources, {});
      
      const resourceEvent = result.corruptionEvents.find(e => 
        e.params.corruptionType.includes('count')
      );
      
      expect(resourceEvent?.metadata.businessLogic).toBeDefined();
      expect(resourceEvent?.metadata.businessLogic.source).toBe('config/business-rules.json');
      expect(resourceEvent?.metadata.businessLogic.modifiable).toContain('Business users');
    });
  });
});

// Custom Jest matcher
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

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}
