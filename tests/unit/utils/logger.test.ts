/**
 * Unit tests for Logger
 */

import { Logger, getLogger } from '../../../src/utils/logger';
import { testUtils } from '../../setup';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Logger', () => {
  let logger: Logger;
  let testLogDir: string;

  beforeEach(async () => {
    testLogDir = await testUtils.createTestDir('logger-test');
    logger = new Logger(testLogDir);
    await logger.initialize();
  });

  describe('initialization', () => {
    it('should initialize logger successfully', async () => {
      const newLogger = new Logger(testLogDir);
      await expect(newLogger.initialize()).resolves.not.toThrow();
      
      // Should create log directory
      expect(await testUtils.fileExists(testLogDir)).toBe(true);
    });

    it('should create log directory if it does not exist', async () => {
      const newLogDir = path.join(testLogDir, 'nested', 'logs');
      const newLogger = new Logger(newLogDir);
      
      await newLogger.initialize();
      
      expect(await testUtils.fileExists(newLogDir)).toBe(true);
    });
  });

  describe('logging methods', () => {
    it('should log info messages', async () => {
      await logger.info('test-component', 'Test info message', { key: 'value' }, 'integration-123');

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      expect(await testUtils.fileExists(logFile)).toBe(true);

      const logContent = await testUtils.readTestFile(logFile);
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.level).toBe('info');
      expect(logEntry.component).toBe('test-component');
      expect(logEntry.message).toBe('Test info message');
      expect(logEntry.data).toEqual({ key: 'value' });
      expect(logEntry.integrationId).toBe('integration-123');
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should log warning messages', async () => {
      await logger.warn('test-component', 'Test warning message', { warning: true });

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.level).toBe('warn');
      expect(logEntry.message).toBe('Test warning message');
      expect(logEntry.data).toEqual({ warning: true });
    });

    it('should log error messages', async () => {
      const testError = new Error('Test error');
      testError.stack = 'Error stack trace';

      await logger.error('test-component', 'Test error message', testError, 'integration-456');

      // Check main log file
      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.level).toBe('error');
      expect(logEntry.message).toBe('Test error message');
      expect(logEntry.integrationId).toBe('integration-456');
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.stack).toBe('Error stack trace');

      // Check dedicated error log file
      const errorFile = path.join(testLogDir, 'errors.log');
      expect(await testUtils.fileExists(errorFile)).toBe(true);
      const errorContent = await testUtils.readTestFile(errorFile);
      const errorEntry = JSON.parse(errorContent.trim());
      expect(errorEntry.level).toBe('error');
    });

    it('should log failure messages', async () => {
      const testError = new Error('Integration failed');
      
      await logger.logFailure('integration-789', 'failed@example.com', testError, 5000);

      // Check failure log file
      const failureFile = path.join(testLogDir, 'failures.log');
      expect(await testUtils.fileExists(failureFile)).toBe(true);
      
      const failureContent = await testUtils.readTestFile(failureFile);
      const failureEntry = JSON.parse(failureContent.trim());

      expect(failureEntry.integrationId).toBe('integration-789');
      expect(failureEntry.email).toBe('failed@example.com');
      expect(failureEntry.duration).toBe(5000);
      expect(failureEntry.error).toBeDefined();
      expect(failureEntry.errorType).toBeDefined();
    });
  });

  describe('error categorization', () => {
    it('should categorize case sensitivity errors', async () => {
      const caseError = new Error('shopifyMarkets edition not found');
      
      await logger.logFailure('integration-case', 'case@example.com', caseError, 1000);

      const failureFile = path.join(testLogDir, 'failures.log');
      const failureContent = await testUtils.readTestFile(failureFile);
      const failureEntry = JSON.parse(failureContent.trim());

      expect(failureEntry.errorType).toBe('CASE_SENSITIVITY_ISSUE');
    });

    it('should categorize data type mismatch errors', async () => {
      const typeError = new Error('Expected object, received array');
      
      await logger.logFailure('integration-type', 'type@example.com', typeError, 1000);

      const failureFile = path.join(testLogDir, 'failures.log');
      const failureContent = await testUtils.readTestFile(failureFile);
      const failureEntry = JSON.parse(failureContent.trim());

      expect(failureEntry.errorType).toBe('DATA_TYPE_MISMATCH');
    });

    it('should categorize empty field errors', async () => {
      const emptyError = new Error('String must contain at least 1 character');
      
      await logger.logFailure('integration-empty', 'empty@example.com', emptyError, 1000);

      const failureFile = path.join(testLogDir, 'failures.log');
      const failureContent = await testUtils.readTestFile(failureFile);
      const failureEntry = JSON.parse(failureContent.trim());

      expect(failureEntry.errorType).toBe('EMPTY_REQUIRED_FIELD');
    });

    it('should categorize enum validation errors', async () => {
      const enumError = new Error('invalid_enum_value: Expected starter | standard | premium');
      
      await logger.logFailure('integration-enum', 'enum@example.com', enumError, 1000);

      const failureFile = path.join(testLogDir, 'failures.log');
      const failureContent = await testUtils.readTestFile(failureFile);
      const failureEntry = JSON.parse(failureContent.trim());

      expect(failureEntry.errorType).toBe('INVALID_ENUM_VALUE');
    });

    it('should categorize Zod validation errors', async () => {
      const zodError = new Error('ZodError: Validation failed');
      
      await logger.logFailure('integration-zod', 'zod@example.com', zodError, 1000);

      const failureFile = path.join(testLogDir, 'failures.log');
      const failureContent = await testUtils.readTestFile(failureFile);
      const failureEntry = JSON.parse(failureContent.trim());

      expect(failureEntry.errorType).toBe('SCHEMA_VALIDATION_ERROR');
    });

    it('should categorize unknown errors', async () => {
      const unknownError = new Error('Some unexpected error');
      
      await logger.logFailure('integration-unknown', 'unknown@example.com', unknownError, 1000);

      const failureFile = path.join(testLogDir, 'failures.log');
      const failureContent = await testUtils.readTestFile(failureFile);
      const failureEntry = JSON.parse(failureContent.trim());

      expect(failureEntry.errorType).toBe('UNKNOWN_ERROR');
    });
  });

  describe('failure summary generation', () => {
    beforeEach(async () => {
      // Create some test failures
      await logger.logFailure('integration-1', 'user1@example.com', new Error('shopifyMarkets error'), 1000);
      await logger.logFailure('integration-2', 'user2@example.com', new Error('Expected object, received array'), 2000);
      await logger.logFailure('integration-3', 'user1@example.com', new Error('ZodError: Invalid data'), 1500);
      await logger.logFailure('integration-4', 'user3@example.com', new Error('String must contain at least 1 character'), 3000);
    });

    it('should generate failure summary', async () => {
      await logger.generateFailureSummary();

      const summaryFile = path.join(testLogDir, 'failure-summary.json');
      expect(await testUtils.fileExists(summaryFile)).toBe(true);

      const summaryContent = await testUtils.readTestFile(summaryFile);
      const summary = JSON.parse(summaryContent);

      expect(summary.totalFailures).toBe(4);
      expect(summary.failuresByType).toBeDefined();
      expect(summary.failuresByEmail).toBeDefined();
      expect(summary.recentFailures).toBeDefined();
      expect(summary.oldestFailures).toBeDefined();

      // Check failure type grouping
      expect(summary.failuresByType['CASE_SENSITIVITY_ISSUE']).toBe(1);
      expect(summary.failuresByType['DATA_TYPE_MISMATCH']).toBe(1);
      expect(summary.failuresByType['SCHEMA_VALIDATION_ERROR']).toBe(1);
      expect(summary.failuresByType['EMPTY_REQUIRED_FIELD']).toBe(1);

      // Check email grouping
      expect(summary.failuresByEmail['user1@example.com']).toBe(2);
      expect(summary.failuresByEmail['user2@example.com']).toBe(1);
      expect(summary.failuresByEmail['user3@example.com']).toBe(1);
    });

    it('should handle empty failure log gracefully', async () => {
      // Create new logger with empty failure log
      const emptyLogDir = await testUtils.createTestDir('empty-logger-test');
      const emptyLogger = new Logger(emptyLogDir);
      await emptyLogger.initialize();

      await expect(emptyLogger.generateFailureSummary()).resolves.not.toThrow();
      
      // Should create summary with zero failures
      const summaryFile = path.join(emptyLogDir, 'failure-summary.json');
      
      // File may not exist if there are no failures, which is fine
      if (await testUtils.fileExists(summaryFile)) {
        const summaryContent = await testUtils.readTestFile(summaryFile);
        const summary = JSON.parse(summaryContent);
        expect(summary.totalFailures).toBe(0);
      }
    });
  });

  describe('error serialization', () => {
    it('should serialize standard Error objects', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      await logger.error('test-component', 'Error test', error);

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.error.name).toBe('Error');
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.stack).toBe('Error stack trace');
    });

    it('should serialize custom error objects', async () => {
      const customError = {
        name: 'CustomError',
        message: 'Custom error message',
        code: 'CUSTOM_CODE',
        details: { key: 'value' }
      };

      await logger.error('test-component', 'Custom error test', customError);

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.error.name).toBe('CustomError');
      expect(logEntry.error.message).toBe('Custom error message');
      expect(logEntry.error.code).toBe('CUSTOM_CODE');
      expect(logEntry.error.details).toEqual({ key: 'value' });
    });

    it('should handle non-error objects', async () => {
      const nonError = 'String error';

      await logger.error('test-component', 'Non-error test', nonError);

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.error).toBe('String error');
    });
  });

  describe('file write error handling', () => {
    it('should handle file write failures gracefully', async () => {
      // Create logger with invalid directory
      const invalidLogger = new Logger('/invalid/readonly/path');
      
      // Should not throw error, should fallback to console
      await expect(invalidLogger.info('test', 'Test message')).resolves.not.toThrow();
    });
  });

  describe('singleton logger', () => {
    it('should return same logger instance', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      
      expect(logger1).toBe(logger2);
    });

    it('should create logger with custom directory', () => {
      const customLogger = getLogger('./custom-logs');
      
      expect(customLogger).toBeDefined();
      expect(customLogger).toBeInstanceOf(Logger);
    });
  });

  describe('log formatting', () => {
    it('should format log entries as JSON', async () => {
      await logger.info('formatter-test', 'Format test message');

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);

      // Should be valid JSON
      expect(() => JSON.parse(logContent.trim())).not.toThrow();

      const logEntry = JSON.parse(logContent.trim());
      expect(logEntry).toHaveProperty('timestamp');
      expect(logEntry).toHaveProperty('level');
      expect(logEntry).toHaveProperty('component');
      expect(logEntry).toHaveProperty('message');
    });

    it('should include all required fields in log entries', async () => {
      await logger.warn('complete-test', 'Complete log entry', { data: 'test' }, 'integration-complete');

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);
      const logEntry = JSON.parse(logContent.trim());

      expect(logEntry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(logEntry.level).toBe('warn');
      expect(logEntry.component).toBe('complete-test');
      expect(logEntry.integrationId).toBe('integration-complete');
      expect(logEntry.message).toBe('Complete log entry');
      expect(logEntry.data).toEqual({ data: 'test' });
      expect(logEntry.error).toBeUndefined();
    });
  });

  describe('multiple log files', () => {
    it('should write to multiple log files appropriately', async () => {
      await logger.info('multi-test', 'Info message');
      await logger.error('multi-test', 'Error message', new Error('Test error'));

      // Check main log file
      const mainLogFile = path.join(testLogDir, 'integration-auditor.log');
      expect(await testUtils.fileExists(mainLogFile)).toBe(true);
      const mainContent = await testUtils.readTestFile(mainLogFile);
      expect(mainContent.split('\n').filter(line => line.trim()).length).toBe(2);

      // Check error log file
      const errorLogFile = path.join(testLogDir, 'errors.log');
      expect(await testUtils.fileExists(errorLogFile)).toBe(true);
      const errorContent = await testUtils.readTestFile(errorLogFile);
      expect(errorContent.split('\n').filter(line => line.trim()).length).toBe(1);
    });
  });

  describe('concurrent logging', () => {
    it('should handle concurrent log writes', async () => {
      const promises = Array.from({ length: 10 }, (_, i) => 
        logger.info('concurrent-test', `Concurrent message ${i}`, { index: i })
      );

      await Promise.all(promises);

      const logFile = path.join(testLogDir, 'integration-auditor.log');
      const logContent = await testUtils.readTestFile(logFile);
      const lines = logContent.split('\n').filter(line => line.trim());

      expect(lines.length).toBe(10);
      
      // All lines should be valid JSON
      lines.forEach(line => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });
  });
});
