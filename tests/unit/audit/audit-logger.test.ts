/**
 * Unit tests for AuditLogger
 */

import { AuditLogger, AuditLogEntry, RestoreBundle, AuditQuery } from '../../../src/audit/audit-logger';
import { ExecutionAction, ExecutionResult } from '../../../src/planner/execution-planner';
import { testUtils } from '../../setup';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock fs/promises
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('AuditLogger', () => {
  let auditLogger: AuditLogger;
  let testAuditDir: string;
  let mockFileContents: Map<string, string>;

  beforeEach(async () => {
    testAuditDir = await testUtils.createTestDir('audit-test');
    mockFileContents = new Map();

    // Mock fs operations
    mockedFs.mkdir.mockResolvedValue(undefined as any);
    mockedFs.appendFile.mockImplementation(async (filePath: string, content: string) => {
      const existing = mockFileContents.get(filePath) || '';
      mockFileContents.set(filePath, existing + content);
    });
    mockedFs.writeFile.mockImplementation(async (filePath: string, content: string) => {
      mockFileContents.set(filePath, content);
    });
    mockedFs.readFile.mockImplementation(async (filePath: string) => {
      const content = mockFileContents.get(filePath);
      if (!content) {
        throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
      }
      return content;
    });
    mockedFs.readdir.mockResolvedValue([]);

    auditLogger = new AuditLogger(testAuditDir, 'test-operator', 'test-session');
    await auditLogger.initialize();
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockFileContents.clear();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(mockedFs.mkdir).toHaveBeenCalledWith(testAuditDir, { recursive: true });
      expect(mockedFs.mkdir).toHaveBeenCalledWith(path.join(testAuditDir, 'restore-bundles'), { recursive: true });
    });

    it('should generate session ID if not provided', async () => {
      const loggerWithoutSession = new AuditLogger(testAuditDir, 'test-operator');
      await loggerWithoutSession.initialize();
      
      expect(mockedFs.mkdir).toHaveBeenCalled();
    });
  });

  describe('action logging', () => {
    it('should log action successfully', async () => {
      const actionLog = {
        actionId: 'action-123',
        integrationId: 'integration-456',
        actionType: 'create',
        resourceType: 'import',
        resourceId: 'resource-789',
        payload: {
          before: null,
          after: { name: 'New Import' },
          diff: { op: 'add', path: '/name', value: 'New Import' }
        },
        metadata: {
          reason: 'Add missing import',
          priority: 5,
          dependencies: [],
          retryable: true,
          rollbackable: true
        },
        timestamp: '2025-01-01T12:00:00.000Z',
        status: 'success',
        error: undefined
      };

      await auditLogger.logAction(actionLog);

      // Verify file was written
      const expectedLogFile = path.join(testAuditDir, '2025-01-01.log');
      expect(mockedFs.appendFile).toHaveBeenCalledWith(expectedLogFile, expect.any(String));

      // Verify log entry structure
      const logContent = mockFileContents.get(expectedLogFile);
      expect(logContent).toBeDefined();
      
      const logEntry = JSON.parse(logContent!.trim());
      expect(logEntry.id).toBeDefined();
      expect(logEntry.timestamp).toBe(actionLog.timestamp);
      expect(logEntry.operatorId).toBe('test-operator');
      expect(logEntry.sessionId).toBe('test-session');
      expect(logEntry.integrationId).toBe(actionLog.integrationId);
      expect(logEntry.action.type).toBe(actionLog.actionType);
      expect(logEntry.execution.actionId).toBe(actionLog.actionId);
      expect(logEntry.execution.status).toBe(actionLog.status);
      expect(logEntry.rollback.available).toBe(true);
    });

    it('should handle action with error', async () => {
      const actionLog = {
        actionId: 'action-error',
        integrationId: 'integration-error',
        actionType: 'delete',
        resourceType: 'export',
        resourceId: 'resource-error',
        payload: {
          before: { name: 'Old Export' },
          after: null
        },
        metadata: {
          reason: 'Remove duplicate export',
          priority: 3,
          dependencies: [],
          retryable: true,
          rollbackable: false
        },
        timestamp: '2025-01-01T12:00:00.000Z',
        status: 'failed',
        error: 'Resource not found'
      };

      await auditLogger.logAction(actionLog);

      const expectedLogFile = path.join(testAuditDir, '2025-01-01.log');
      const logContent = mockFileContents.get(expectedLogFile);
      const logEntry = JSON.parse(logContent!.trim());

      expect(logEntry.execution.status).toBe('failed');
      expect(logEntry.execution.error).toBe('Resource not found');
      expect(logEntry.rollback.available).toBe(false);
    });

    it('should handle dry run actions', async () => {
      const actionLog = {
        actionId: 'action-dry-run',
        integrationId: 'integration-dry',
        actionType: 'patch',
        resourceType: 'setting',
        payload: {
          before: { value: 'old' },
          after: { value: 'new' }
        },
        metadata: {
          reason: 'Update setting',
          priority: 4,
          dependencies: [],
          retryable: true,
          rollbackable: true
        },
        timestamp: '2025-01-01T12:00:00.000Z',
        status: 'dry_run_success'
      };

      await auditLogger.logAction(actionLog);

      const expectedLogFile = path.join(testAuditDir, '2025-01-01.log');
      const logContent = mockFileContents.get(expectedLogFile);
      const logEntry = JSON.parse(logContent!.trim());

      expect(logEntry.context.dryRun).toBe(true);
      expect(logEntry.execution.status).toBe('dry_run_success');
    });
  });

  describe('execution result logging', () => {
    it('should log execution result summary', async () => {
      const executionResult: ExecutionResult = {
        planId: 'plan-123',
        integrationId: 'integration-456',
        status: 'success',
        startTime: '2025-01-01T12:00:00.000Z',
        endTime: '2025-01-01T12:05:00.000Z',
        duration: 300000,
        actions: {
          executed: [
            {
              id: 'action-1',
              type: 'create',
              target: { integrationId: 'integration-456', resourceType: 'import' },
              payload: {},
              metadata: { reason: 'Test', priority: 5, dependencies: [], retryable: true, rollbackable: true }
            }
          ],
          failed: [],
          skipped: []
        }
      };

      const context = {
        operatorId: 'test-operator',
        dryRun: false,
        environment: 'test'
      };

      await auditLogger.logExecutionResult(executionResult, context);

      const summaryFile = path.join(testAuditDir, 'execution-summaries.jsonl');
      expect(mockedFs.appendFile).toHaveBeenCalledWith(summaryFile, expect.any(String));

      const summaryContent = mockFileContents.get(summaryFile);
      expect(summaryContent).toBeDefined();

      const summaryEntry = JSON.parse(summaryContent!.trim());
      expect(summaryEntry.type).toBe('execution_summary');
      expect(summaryEntry.planId).toBe('plan-123');
      expect(summaryEntry.integrationId).toBe('integration-456');
      expect(summaryEntry.result.status).toBe('success');
      expect(summaryEntry.result.actions.executed).toBe(1);
      expect(summaryEntry.context).toEqual(context);
    });
  });

  describe('restore bundle management', () => {
    it('should create restore bundle successfully', async () => {
      const integrations = [
        {
          integrationId: 'integration-1',
          email: 'user1@example.com',
          beforeSnapshot: { id: 'integration-1', version: 'before' },
          afterSnapshot: { id: 'integration-1', version: 'after' },
          actions: [
            {
              id: 'action-1',
              type: 'patch' as const,
              target: { integrationId: 'integration-1', resourceType: 'setting' as const },
              payload: {},
              metadata: { reason: 'Test', priority: 5, dependencies: [], retryable: true, rollbackable: true }
            }
          ]
        },
        {
          integrationId: 'integration-2',
          email: 'user2@example.com',
          beforeSnapshot: { id: 'integration-2', version: 'before' },
          afterSnapshot: { id: 'integration-2', version: 'after' },
          actions: []
        }
      ];

      const bundleId = await auditLogger.createRestoreBundle(
        integrations,
        'Test restore bundle'
      );

      expect(bundleId).toMatch(/^restore_\d+_\w+$/);

      const bundleFile = path.join(testAuditDir, 'restore-bundles', `${bundleId}.json`);
      expect(mockedFs.writeFile).toHaveBeenCalledWith(bundleFile, expect.any(String));

      const bundleContent = mockFileContents.get(bundleFile);
      expect(bundleContent).toBeDefined();

      const bundle = JSON.parse(bundleContent!);
      expect(bundle.id).toBe(bundleId);
      expect(bundle.description).toBe('Test restore bundle');
      expect(bundle.integrations).toHaveLength(2);
      expect(bundle.metadata.totalIntegrations).toBe(2);
      expect(bundle.metadata.totalActions).toBe(1);
      expect(bundle.operatorId).toBe('test-operator');
      expect(bundle.sessionId).toBe('test-session');
    });

    it('should get restore bundle by ID', async () => {
      const bundleId = 'test-bundle-123';
      const bundle: RestoreBundle = {
        id: bundleId,
        createdAt: '2025-01-01T12:00:00.000Z',
        operatorId: 'test-operator',
        sessionId: 'test-session',
        description: 'Test bundle',
        integrations: [],
        metadata: {
          totalIntegrations: 0,
          totalActions: 0,
          environment: 'test',
          version: '1.0.0'
        }
      };

      const bundleFile = path.join(testAuditDir, 'restore-bundles', `${bundleId}.json`);
      mockFileContents.set(bundleFile, JSON.stringify(bundle));

      const retrievedBundle = await auditLogger.getRestoreBundle(bundleId);

      expect(retrievedBundle).toEqual(bundle);
    });

    it('should return null for non-existent bundle', async () => {
      const result = await auditLogger.getRestoreBundle('non-existent-bundle');
      expect(result).toBeNull();
    });

    it('should list restore bundles', async () => {
      const bundle1 = { id: 'bundle-1', operatorId: 'test-operator', createdAt: '2025-01-01T12:00:00.000Z' };
      const bundle2 = { id: 'bundle-2', operatorId: 'other-operator', createdAt: '2025-01-01T11:00:00.000Z' };

      mockFileContents.set(
        path.join(testAuditDir, 'restore-bundles', 'bundle-1.json'),
        JSON.stringify(bundle1)
      );
      mockFileContents.set(
        path.join(testAuditDir, 'restore-bundles', 'bundle-2.json'),
        JSON.stringify(bundle2)
      );

      mockedFs.readdir.mockResolvedValue(['bundle-1.json', 'bundle-2.json'] as any);

      // List all bundles
      const allBundles = await auditLogger.listRestoreBundles();
      expect(allBundles).toHaveLength(2);
      expect(allBundles[0].createdAt).toBe('2025-01-01T12:00:00.000Z'); // Sorted by creation time desc

      // List bundles for specific operator
      const operatorBundles = await auditLogger.listRestoreBundles('test-operator');
      expect(operatorBundles).toHaveLength(1);
      expect(operatorBundles[0].id).toBe('bundle-1');
    });
  });

  describe('log querying', () => {
    beforeEach(async () => {
      // Setup some test log entries
      const logEntries = [
        {
          id: 'entry-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          operatorId: 'test-operator',
          sessionId: 'session-1',
          integrationId: 'integration-1',
          action: { type: 'create' },
          execution: { planId: 'plan-1', actionId: 'action-1', status: 'success' }
        },
        {
          id: 'entry-2',
          timestamp: '2025-01-01T12:01:00.000Z',
          operatorId: 'test-operator',
          sessionId: 'session-1',
          integrationId: 'integration-2',
          action: { type: 'delete' },
          execution: { planId: 'plan-1', actionId: 'action-2', status: 'failed' }
        },
        {
          id: 'entry-3',
          timestamp: '2025-01-01T12:02:00.000Z',
          operatorId: 'other-operator',
          sessionId: 'session-2',
          integrationId: 'integration-1',
          action: { type: 'patch' },
          execution: { planId: 'plan-2', actionId: 'action-3', status: 'success' }
        }
      ];

      const logFile = path.join(testAuditDir, 'daily', '2025-01-01.jsonl');
      const logContent = logEntries.map(entry => JSON.stringify(entry)).join('\n');
      mockFileContents.set(logFile, logContent);

      mockedFs.readdir.mockImplementation(async (dirPath: string) => {
        if (dirPath.includes('daily')) {
          return ['2025-01-01.jsonl'] as any;
        }
        return [] as any;
      });
    });

    it('should query logs by integration ID', async () => {
      const query: AuditQuery = {
        integrationId: 'integration-1',
        limit: 10
      };

      const results = await auditLogger.queryLogs(query);

      expect(results).toHaveLength(2);
      expect(results[0].integrationId).toBe('integration-1');
      expect(results[1].integrationId).toBe('integration-1');
    });

    it('should query logs by operator ID', async () => {
      const query: AuditQuery = {
        operatorId: 'test-operator',
        limit: 10
      };

      const results = await auditLogger.queryLogs(query);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.operatorId === 'test-operator')).toBe(true);
    });

    it('should query logs by status', async () => {
      const query: AuditQuery = {
        status: 'success',
        limit: 10
      };

      const results = await auditLogger.queryLogs(query);

      expect(results).toHaveLength(2);
      expect(results.every(r => r.execution.status === 'success')).toBe(true);
    });

    it('should query logs with time range', async () => {
      const query: AuditQuery = {
        startTime: '2025-01-01T12:00:30.000Z',
        endTime: '2025-01-01T12:01:30.000Z',
        limit: 10
      };

      const results = await auditLogger.queryLogs(query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('entry-2');
    });

    it('should apply limit and offset', async () => {
      const query: AuditQuery = {
        limit: 1,
        offset: 1
      };

      const results = await auditLogger.queryLogs(query);

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('entry-2');
    });

    it('should handle empty query results', async () => {
      const query: AuditQuery = {
        integrationId: 'non-existent-integration',
        limit: 10
      };

      const results = await auditLogger.queryLogs(query);

      expect(results).toHaveLength(0);
    });
  });

  describe('rollback action generation', () => {
    beforeEach(async () => {
      // Setup log entries for rollback testing
      const logEntries = [
        {
          id: 'rollback-entry-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          operatorId: 'test-operator',
          sessionId: 'test-session',
          integrationId: 'integration-rollback',
          action: {
            type: 'create',
            target: { resourceType: 'import', resourceId: 'import-1' },
            before: null,
            after: { name: 'New Import' },
            diff: { op: 'add', path: '/name', value: 'New Import' }
          },
          execution: { planId: 'plan-rollback', actionId: 'action-1', status: 'success' },
          rollback: { available: true }
        },
        {
          id: 'rollback-entry-2',
          timestamp: '2025-01-01T12:01:00.000Z',
          operatorId: 'test-operator',
          sessionId: 'test-session',
          integrationId: 'integration-rollback',
          action: {
            type: 'patch',
            target: { resourceType: 'setting', path: 'config.value' },
            before: 'old-value',
            after: 'new-value',
            diff: { op: 'replace', path: '/config/value', value: 'new-value' }
          },
          execution: { planId: 'plan-rollback', actionId: 'action-2', status: 'success' },
          rollback: { available: true }
        }
      ];

      const logFile = path.join(testAuditDir, 'daily', '2025-01-01.jsonl');
      const logContent = logEntries.map(entry => JSON.stringify(entry)).join('\n');
      mockFileContents.set(logFile, logContent);

      mockedFs.readdir.mockImplementation(async (dirPath: string) => {
        if (dirPath.includes('daily')) {
          return ['2025-01-01.jsonl'] as any;
        }
        return [] as any;
      });
    });

    it('should generate rollback actions', async () => {
      const rollbackActions = await auditLogger.generateRollbackActions(
        'integration-rollback',
        '2025-01-01T11:59:00.000Z',
        '2025-01-01T12:02:00.000Z'
      );

      expect(rollbackActions).toHaveLength(2);

      // Actions should be in reverse chronological order
      expect(rollbackActions[0].type).toBe('patch'); // Rollback of patch action
      expect(rollbackActions[0].payload.before).toBe('new-value');
      expect(rollbackActions[0].payload.after).toBe('old-value');

      expect(rollbackActions[1].type).toBe('delete'); // Rollback of create action
      expect(rollbackActions[1].payload.before).toEqual({ name: 'New Import' });
      expect(rollbackActions[1].payload.after).toBe(null);
    });

    it('should handle actions without rollback capability', async () => {
      // Add non-rollbackable action
      const nonRollbackableEntry = {
        id: 'non-rollback-entry',
        timestamp: '2025-01-01T12:03:00.000Z',
        operatorId: 'test-operator',
        sessionId: 'test-session',
        integrationId: 'integration-rollback',
        action: {
          type: 'reconnect',
          target: { resourceType: 'connection', resourceId: 'conn-1' },
          before: { status: 'offline' },
          after: { status: 'online' }
        },
        execution: { planId: 'plan-rollback', actionId: 'action-3', status: 'success' },
        rollback: { available: false }
      };

      const existingContent = mockFileContents.get(path.join(testAuditDir, 'daily', '2025-01-01.jsonl')) || '';
      mockFileContents.set(
        path.join(testAuditDir, 'daily', '2025-01-01.jsonl'),
        existingContent + '\n' + JSON.stringify(nonRollbackableEntry)
      );

      const rollbackActions = await auditLogger.generateRollbackActions(
        'integration-rollback',
        '2025-01-01T11:59:00.000Z',
        '2025-01-01T12:04:00.000Z'
      );

      // Should only include rollbackable actions
      expect(rollbackActions).toHaveLength(2);
      expect(rollbackActions.every(a => a.metadata.rollbackable === false)).toBe(true);
    });
  });

  describe('audit statistics', () => {
    beforeEach(async () => {
      // Setup diverse log entries for statistics
      const logEntries = [
        {
          id: 'stats-1',
          timestamp: '2025-01-01T12:00:00.000Z',
          operatorId: 'operator-1',
          integrationId: 'integration-1',
          action: { type: 'create' },
          execution: { status: 'success', duration: 1000 }
        },
        {
          id: 'stats-2',
          timestamp: '2025-01-01T12:01:00.000Z',
          operatorId: 'operator-1',
          integrationId: 'integration-2',
          action: { type: 'delete' },
          execution: { status: 'failed', duration: 500 }
        },
        {
          id: 'stats-3',
          timestamp: '2025-01-01T12:02:00.000Z',
          operatorId: 'operator-2',
          integrationId: 'integration-1',
          action: { type: 'patch' },
          execution: { status: 'success', duration: 1500 }
        },
        {
          id: 'stats-4',
          timestamp: '2025-01-01T12:03:00.000Z',
          operatorId: 'operator-2',
          integrationId: 'integration-3',
          action: { type: 'create' },
          execution: { status: 'success', duration: 800 }
        }
      ];

      const logFile = path.join(testAuditDir, 'daily', '2025-01-01.jsonl');
      const logContent = logEntries.map(entry => JSON.stringify(entry)).join('\n');
      mockFileContents.set(logFile, logContent);

      mockedFs.readdir.mockImplementation(async (dirPath: string) => {
        if (dirPath.includes('daily')) {
          return ['2025-01-01.jsonl'] as any;
        }
        return [] as any;
      });
    });

    it('should generate audit statistics', async () => {
      const stats = await auditLogger.getAuditStatistics();

      expect(stats.totalActions).toBe(4);
      expect(stats.actionsByType.create).toBe(2);
      expect(stats.actionsByType.delete).toBe(1);
      expect(stats.actionsByType.patch).toBe(1);
      expect(stats.actionsByStatus.success).toBe(3);
      expect(stats.actionsByStatus.failed).toBe(1);
      expect(stats.integrationsCovered).toBe(3);
      expect(stats.operatorsActive).toBe(2);
      expect(stats.averageDuration).toBe(950); // (1000 + 500 + 1500 + 800) / 4
      expect(stats.errorRate).toBe(0.25); // 1 failure out of 4 actions
    });

    it('should generate statistics for time range', async () => {
      const timeRange = {
        start: '2025-01-01T12:01:30.000Z',
        end: '2025-01-01T12:03:30.000Z'
      };

      const stats = await auditLogger.getAuditStatistics(timeRange);

      expect(stats.totalActions).toBe(2); // Only entries 3 and 4
      expect(stats.actionsByType.patch).toBe(1);
      expect(stats.actionsByType.create).toBe(1);
      expect(stats.errorRate).toBe(0); // No failures in this range
    });

    it('should handle empty statistics', async () => {
      mockFileContents.clear();
      mockedFs.readdir.mockResolvedValue([] as any);

      const stats = await auditLogger.getAuditStatistics();

      expect(stats.totalActions).toBe(0);
      expect(stats.integrationsCovered).toBe(0);
      expect(stats.operatorsActive).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.errorRate).toBe(0);
    });
  });

  describe('error handling', () => {
    it('should handle file write errors gracefully', async () => {
      mockedFs.appendFile.mockRejectedValue(new Error('Disk full'));

      const actionLog = {
        actionId: 'error-test',
        integrationId: 'integration-error',
        actionType: 'create',
        resourceType: 'import',
        payload: {},
        metadata: {
          reason: 'Test error handling',
          priority: 5,
          dependencies: [],
          retryable: true,
          rollbackable: true
        },
        timestamp: '2025-01-01T12:00:00.000Z',
        status: 'success'
      };

      // Should not throw error
      await expect(auditLogger.logAction(actionLog)).resolves.not.toThrow();
    });

    it('should handle invalid JSON in log files', async () => {
      const invalidLogContent = 'invalid-json\n{"valid": "json"}\ninvalid-json-again';
      const logFile = path.join(testAuditDir, 'daily', '2025-01-01.jsonl');
      mockFileContents.set(logFile, invalidLogContent);

      mockedFs.readdir.mockImplementation(async (dirPath: string) => {
        if (dirPath.includes('daily')) {
          return ['2025-01-01.jsonl'] as any;
        }
        return [] as any;
      });

      const query: AuditQuery = { limit: 10 };
      const results = await auditLogger.queryLogs(query);

      // Should only return valid JSON entries
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ valid: 'json' });
    });

    it('should handle missing log files gracefully', async () => {
      mockedFs.readdir.mockRejectedValue(new Error('Directory not found'));

      const query: AuditQuery = { integrationId: 'test', limit: 10 };
      const results = await auditLogger.queryLogs(query);

      expect(results).toHaveLength(0);
    });
  });

  describe('ID generation', () => {
    it('should generate unique IDs', () => {
      const logger1 = new AuditLogger(testAuditDir, 'operator-1');
      const logger2 = new AuditLogger(testAuditDir, 'operator-2');

      // Access private methods for testing (normally not recommended)
      const generateId1 = (logger1 as any).generateEntryId.bind(logger1);
      const generateId2 = (logger2 as any).generateEntryId.bind(logger2);

      const id1 = generateId1();
      const id2 = generateId2();

      expect(id1).toMatch(/^audit_\d+_\w+$/);
      expect(id2).toMatch(/^audit_\d+_\w+$/);
      expect(id1).not.toBe(id2);
    });

    it('should generate unique session IDs', () => {
      const logger1 = new AuditLogger(testAuditDir, 'operator-1');
      const logger2 = new AuditLogger(testAuditDir, 'operator-2');

      // Access private session IDs
      const sessionId1 = (logger1 as any).sessionId;
      const sessionId2 = (logger2 as any).sessionId;

      expect(sessionId1).toMatch(/^session_\d+_\w+$/);
      expect(sessionId2).toMatch(/^session_\d+_\w+$/);
      expect(sessionId1).not.toBe(sessionId2);
    });
  });
});
