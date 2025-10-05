/**
 * Global test setup for Jest
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce log noise during tests

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
const originalConsoleLog = console.log;
const originalConsoleWarn = console.warn;
const originalConsoleError = console.error;

beforeAll(() => {
  // Only show console output if TEST_VERBOSE is set
  if (!process.env.TEST_VERBOSE) {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  }
});

afterAll(() => {
  // Restore console methods
  console.log = originalConsoleLog;
  console.warn = originalConsoleWarn;
  console.error = originalConsoleError;
});

// Clean up test artifacts
afterEach(async () => {
  // Clean up any test-created files
  const testDirs = [
    './test-output',
    './test-logs',
    './test-audit',
    './test-state'
  ];

  for (const dir of testDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
});

// Global test utilities
declare global {
  namespace jest {
    interface Matchers<R> {
      toBeValidIntegrationSnapshot(): R;
      toBeValidAuditResult(): R;
      toBeValidExecutionPlan(): R;
    }
  }
}

// Custom Jest matchers
expect.extend({
  toBeValidIntegrationSnapshot(received: any) {
    const requiredFields = ['id', 'email', 'version', 'licenseEdition', 'storeCount', 'settings'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        message: () => `Expected integration snapshot to have required fields: ${missingFields.join(', ')}`,
        pass: false
      };
    }

    return {
      message: () => 'Expected integration snapshot to be invalid',
      pass: true
    };
  },

  toBeValidAuditResult(received: any) {
    const requiredFields = ['integrationId', 'email', 'corruptionEvents', 'overallSeverity'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        message: () => `Expected audit result to have required fields: ${missingFields.join(', ')}`,
        pass: false
      };
    }

    return {
      message: () => 'Expected audit result to be invalid',
      pass: true
    };
  },

  toBeValidExecutionPlan(received: any) {
    const requiredFields = ['planId', 'integrationId', 'actions', 'summary'];
    const missingFields = requiredFields.filter(field => !(field in received));
    
    if (missingFields.length > 0) {
      return {
        message: () => `Expected execution plan to have required fields: ${missingFields.join(', ')}`,
        pass: false
      };
    }

    return {
      message: () => 'Expected execution plan to be invalid',
      pass: true
    };
  }
});

// Utility functions for tests
export const testUtils = {
  /**
   * Create a temporary directory for test files
   */
  async createTestDir(name: string): Promise<string> {
    const testDir = path.join('./test-output', name);
    await fs.mkdir(testDir, { recursive: true });
    return testDir;
  },

  /**
   * Wait for a condition to be true
   */
  async waitFor(condition: () => boolean | Promise<boolean>, timeout = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  /**
   * Create a test file with content
   */
  async createTestFile(filePath: string, content: string): Promise<void> {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
  },

  /**
   * Read a test file
   */
  async readTestFile(filePath: string): Promise<string> {
    return await fs.readFile(filePath, 'utf-8');
  },

  /**
   * Check if a file exists
   */
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
};
