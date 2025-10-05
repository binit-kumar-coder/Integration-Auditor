/**
 * Unit tests for DataDrivenRemediationEngine
 */

import { DataDrivenRemediationEngine, RemediationContext } from '../../../src/rules/data-driven-remediation-engine';
import { CorruptionEvent } from '../../../src/rules/data-driven-corruption-detector';
import { testBusinessConfig, testRemediationConfig } from '../../fixtures/business-config';
import { MockFileSystem } from '../../mocks/file-system';
import * as fs from 'fs/promises';

// Mock the fs module
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('DataDrivenRemediationEngine', () => {
  let engine: DataDrivenRemediationEngine;
  let mockFs: MockFileSystem;
  let mockContext: RemediationContext;

  beforeEach(async () => {
    // Setup mock file system
    mockFs = new MockFileSystem();
    
    // Setup mock fs calls
    mockedFs.readFile.mockImplementation(async (path: string) => {
      if (path.includes('remediation-logic.json')) {
        return JSON.stringify(testRemediationConfig);
      }
      if (path.includes('business-rules.json')) {
        return JSON.stringify(testBusinessConfig);
      }
      throw new Error(`File not found: ${path}`);
    });

    // Create engine and initialize
    engine = new DataDrivenRemediationEngine();
    await engine.initialize('./config/remediation-logic.json', './config/business-rules.json');

    // Setup mock context
    mockContext = {
      integrationId: 'test-integration-001',
      email: 'test@example.com',
      storeCount: 2,
      edition: 'premium',
      operatorId: 'test-operator',
      dryRun: false,
      maxOpsPerIntegration: 100
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const newEngine = new DataDrivenRemediationEngine();
      
      await expect(newEngine.initialize()).resolves.not.toThrow();
      expect(mockedFs.readFile).toHaveBeenCalledTimes(2);
    });

    it('should throw error when configuration loading fails', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('Config file not found'));
      
      const newEngine = new DataDrivenRemediationEngine();
      
      await expect(newEngine.initialize()).rejects.toThrow('Config file not found');
    });

    it('should get configuration objects', () => {
      const remediationConfig = engine.getRemediationConfig();
      const businessConfig = engine.getBusinessConfig();
      
      expect(remediationConfig).toEqual(testRemediationConfig);
      expect(businessConfig).toEqual(testBusinessConfig);
    });
  });

  describe('action generation', () => {
    it('should generate actions for resource count issues', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'incorrect-import-count',
            resourceType: 'import',
            severity: 'medium',
            priority: 5,
            fixAction: 'adjust-import-count',
            rollbackable: true,
            details: {
              edition: 'premium',
              storeCount: 2,
              expectedTotal: 64,
              actualCount: 50,
              difference: -14,
              status: 'MISSING_RESOURCES'
            }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.integrationId).toBe(mockContext.integrationId);
      expect(result.actions).toHaveLength(14); // One action per missing resource
      
      result.actions.forEach(action => {
        expect(action.type).toBe('create');
        expect(action.target.resourceType).toBe('import');
        expect(action.metadata.reason).toContain('MISSING');
        expect(action.metadata.rollbackable).toBe(true);
      });
    });

    it('should generate actions for duplicate resources', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'incorrect-export-count',
            resourceType: 'export',
            severity: 'medium',
            priority: 5,
            fixAction: 'adjust-export-count',
            rollbackable: true,
            details: {
              edition: 'starter',
              storeCount: 1,
              expectedTotal: 19,
              actualCount: 25,
              difference: 6,
              status: 'DUPLICATE_RESOURCES'
            }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.actions).toHaveLength(6); // One action per excess resource
      
      result.actions.forEach(action => {
        expect(action.type).toBe('delete');
        expect(action.target.resourceType).toBe('export');
        expect(action.metadata.reason).toContain('DUPLICATE');
        expect(action.metadata.rollbackable).toBe(true);
      });
    });

    it('should generate license patch action', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'license-edition-mismatch',
            resourceType: 'setting',
            severity: 'medium',
            priority: 4,
            fixAction: 'fix-license-mismatch',
            rollbackable: true,
            details: {
              licenseEdition: 'premium',
              connectorEdition: 'standard'
            }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.actions).toHaveLength(1);
      
      const action = result.actions[0];
      expect(action.type).toBe('patch');
      expect(action.target.resourceType).toBe('setting');
      expect(action.payload.before).toBe('standard');
      expect(action.payload.after).toBe('premium');
      expect(action.metadata.rollbackable).toBe(true);
    });

    it('should generate property addition actions', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'missing-properties',
            resourceType: 'setting',
            severity: 'high',
            priority: 7,
            fixAction: 'add-missing-properties',
            rollbackable: true,
            details: {
              missingProperties: [
                'settings.commonresources.netsuiteConnectionId',
                'settings.commonresources.nsUtilImportAdaptorApiIdentifier'
              ]
            }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.actions).toHaveLength(2);
      
      result.actions.forEach(action => {
        expect(action.type).toBe('patch');
        expect(action.target.resourceType).toBe('setting');
        expect(action.payload.diff.op).toBe('add');
        expect(action.metadata.rollbackable).toBe(true);
      });
    });

    it('should generate connection reconnection actions', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'offline-connections',
            resourceType: 'connection',
            severity: 'high',
            priority: 6,
            fixAction: 'reconnect-connections',
            rollbackable: false,
            details: {
              offlineConnections: [
                { id: 'conn-1', name: 'Connection 1', type: 'connection' },
                { id: 'conn-2', name: 'Connection 2', type: 'connection' }
              ],
              totalAffectedResources: 5
            }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.actions).toHaveLength(2);
      
      result.actions.forEach(action => {
        expect(action.type).toBe('reconnect');
        expect(action.target.resourceType).toBe('connection');
        expect(action.payload.before.status).toBe('offline');
        expect(action.payload.after.status).toBe('online');
        expect(action.metadata.rollbackable).toBe(false);
      });
    });

    it('should generate update flag clearing action', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'stuck-in-update-process',
            resourceType: 'setting',
            severity: 'high',
            priority: 3,
            fixAction: 'clear-update-flag',
            rollbackable: true
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.actions).toHaveLength(1);
      
      const action = result.actions[0];
      expect(action.type).toBe('clearUpdateFlag');
      expect(action.target.resourceType).toBe('setting');
      expect(action.payload.before).toBe(true);
      expect(action.metadata.rollbackable).toBe(true);
    });
  });

  describe('action optimization', () => {
    it('should apply action limits', async () => {
      // Create many corruption events
      const corruptionEvents: CorruptionEvent[] = Array.from({ length: 50 }, (_, i) => ({
        type: 'corruption-detected',
        params: {
          corruptionType: 'incorrect-import-count',
          resourceType: 'import',
          severity: 'medium',
          priority: 5 + (i % 3),
          fixAction: 'adjust-import-count',
          rollbackable: true,
          details: {
            edition: 'premium',
            difference: -1,
            status: 'MISSING_RESOURCES'
          }
        }
      }));

      const limitedContext = { ...mockContext, maxOpsPerIntegration: 20 };
      const result = await engine.generateActions(corruptionEvents, limitedContext);

      expect(result.actions.length).toBeLessThanOrEqual(20);
    });

    it('should prioritize actions correctly', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'stuck-in-update-process',
            resourceType: 'setting',
            severity: 'high',
            priority: 3,
            fixAction: 'clear-update-flag',
            rollbackable: true
          }
        },
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'missing-properties',
            resourceType: 'setting',
            severity: 'high',
            priority: 7,
            fixAction: 'add-missing-properties',
            rollbackable: true,
            details: { missingProperties: ['settings.test'] }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      // Higher priority actions should come first
      expect(result.actions[0].metadata.priority).toBeGreaterThanOrEqual(result.actions[1].metadata.priority);
    });

    it('should apply safety controls for destructive actions', async () => {
      // Create many delete actions
      const corruptionEvents: CorruptionEvent[] = Array.from({ length: 30 }, () => ({
        type: 'corruption-detected',
        params: {
          corruptionType: 'incorrect-import-count',
          resourceType: 'import',
          severity: 'medium',
          priority: 5,
          fixAction: 'adjust-import-count',
          rollbackable: true,
          details: {
            edition: 'starter',
            difference: 1,
            status: 'DUPLICATE_RESOURCES'
          }
        }
      }));

      const result = await engine.generateActions(corruptionEvents, mockContext);

      const destructiveActions = result.actions.filter(a => a.type === 'delete');
      
      // Should be limited by safety controls (maxDestructiveActions: 20)
      expect(destructiveActions.length).toBeLessThanOrEqual(20);
    });
  });

  describe('business analysis', () => {
    it('should provide comprehensive business analysis', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'incorrect-import-count',
            resourceType: 'import',
            severity: 'medium',
            priority: 5,
            fixAction: 'adjust-import-count',
            rollbackable: true,
            details: { difference: -5, status: 'MISSING_RESOURCES' }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.businessAnalysis).toBeDefined();
      expect(result.businessAnalysis.corruptionAnalysis).toBeDefined();
      expect(result.businessAnalysis.remediationStrategy).toBeDefined();
      expect(result.businessAnalysis.businessImpact).toBeDefined();
      expect(result.businessAnalysis.executionPlan).toBeDefined();
      
      expect(result.businessAnalysis.remediationStrategy.approach).toBe('data-driven-remediation');
      expect(result.businessAnalysis.remediationStrategy.customizable).toContain('Business users');
    });

    it('should generate execution recommendations', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'offline-connections',
            resourceType: 'connection',
            severity: 'critical',
            priority: 6,
            fixAction: 'reconnect-connections',
            rollbackable: false,
            details: { offlineConnections: [{ id: 'conn-1' }] }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      const recommendations = result.businessAnalysis.remediationStrategy.executionRecommendations;
      
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('PRIORITY'))).toBe(true);
    });

    it('should assess business impact correctly', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'incorrect-import-count',
            resourceType: 'import',
            severity: 'medium',
            priority: 5,
            fixAction: 'adjust-import-count',
            rollbackable: true,
            details: { difference: -5 }
          }
        },
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'missing-properties',
            resourceType: 'setting',
            severity: 'high',
            priority: 7,
            fixAction: 'add-missing-properties',
            rollbackable: true,
            details: { missingProperties: ['test'] }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.businessAnalysis.businessImpact).toBeDefined();
      expect(result.businessAnalysis.businessImpact.dataFlowImpact).toBeGreaterThan(0);
      expect(result.businessAnalysis.businessImpact.configurationImpact).toBeGreaterThan(0);
    });
  });

  describe('summary generation', () => {
    it('should generate accurate action summary', async () => {
      const corruptionEvents: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'incorrect-import-count',
            resourceType: 'import',
            severity: 'medium',
            priority: 5,
            fixAction: 'adjust-import-count',
            rollbackable: true,
            details: { difference: -2, status: 'MISSING_RESOURCES' }
          }
        },
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'license-edition-mismatch',
            resourceType: 'setting',
            severity: 'medium',
            priority: 4,
            fixAction: 'fix-license-mismatch',
            rollbackable: true,
            details: { licenseEdition: 'premium', connectorEdition: 'standard' }
          }
        }
      ];

      const result = await engine.generateActions(corruptionEvents, mockContext);

      expect(result.summary).toBeDefined();
      expect(result.summary.totalActions).toBe(result.actions.length);
      expect(result.summary.actionsByType).toBeDefined();
      expect(result.summary.estimatedDuration).toBeGreaterThan(0);
      expect(result.summary.riskLevel).toBeOneOf(['low', 'medium', 'high', 'critical']);
    });

    it('should calculate risk level appropriately', async () => {
      // High-risk scenario with many destructive actions
      const highRiskEvents: CorruptionEvent[] = Array.from({ length: 15 }, () => ({
        type: 'corruption-detected',
        params: {
          corruptionType: 'incorrect-import-count',
          resourceType: 'import',
          severity: 'medium',
          priority: 5,
          fixAction: 'adjust-import-count',
          rollbackable: true,
          details: { difference: 1, status: 'DUPLICATE_RESOURCES' }
        }
      }));

      const result = await engine.generateActions(highRiskEvents, mockContext);

      expect(result.summary.riskLevel).toBeOneOf(['medium', 'high', 'critical']);
    });
  });

  describe('configuration reload', () => {
    it('should reload configuration successfully', async () => {
      const newRemediationConfig = {
        ...testRemediationConfig,
        actionTemplates: {
          ...testRemediationConfig.actionTemplates,
          test: { reason: 'Test template' }
        }
      };

      mockedFs.readFile.mockImplementation(async (path: string) => {
        if (path.includes('new-remediation-logic.json')) {
          return JSON.stringify(newRemediationConfig);
        }
        return JSON.stringify(testBusinessConfig);
      });

      await engine.reloadConfig('./config/new-remediation-logic.json');

      const config = engine.getRemediationConfig();
      expect(config?.actionTemplates.test).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should throw error when generating actions before initialization', async () => {
      const uninitializedEngine = new DataDrivenRemediationEngine();
      
      await expect(
        uninitializedEngine.generateActions([], mockContext)
      ).rejects.toThrow('Remediation config not loaded');
    });

    it('should handle unknown corruption types gracefully', async () => {
      const unknownEvent: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'unknown-corruption-type',
            resourceType: 'unknown',
            severity: 'medium',
            priority: 5,
            fixAction: 'unknown-action',
            rollbackable: true
          }
        } as any
      ];

      const result = await engine.generateActions(unknownEvent, mockContext);

      expect(result.actions).toHaveLength(0);
      expect(result.businessAnalysis.corruptionAnalysis[0].analysis.error).toContain('No template found');
    });

    it('should handle malformed corruption event details', async () => {
      const malformedEvent: CorruptionEvent[] = [
        {
          type: 'corruption-detected',
          params: {
            corruptionType: 'incorrect-import-count',
            resourceType: 'import',
            severity: 'medium',
            priority: 5,
            fixAction: 'adjust-import-count',
            rollbackable: true,
            details: null // Malformed details
          }
        }
      ];

      const result = await engine.generateActions(malformedEvent, mockContext);

      // Should not crash, but may generate no actions
      expect(result).toBeDefined();
      expect(result.actions).toHaveLength(0);
    });
  });
});

// Add the custom matcher
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}
