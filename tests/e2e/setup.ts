/**
 * E2E test setup
 */

import * as fs from 'fs/promises';
import * as path from 'path';

// Global E2E test timeout
jest.setTimeout(120000);

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Global test utilities for E2E tests
export const e2eUtils = {
  /**
   * Create a temporary test environment
   */
  async createTestEnvironment(name: string): Promise<{
    testDir: string;
    inputDir: string;
    outputDir: string;
    configDir: string;
  }> {
    const testDir = path.join('./test-e2e-output', name);
    const inputDir = path.join(testDir, 'input');
    const outputDir = path.join(testDir, 'output');
    const configDir = path.join(testDir, 'config');

    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(inputDir, { recursive: true });
    await fs.mkdir(outputDir, { recursive: true });
    await fs.mkdir(configDir, { recursive: true });

    return { testDir, inputDir, outputDir, configDir };
  },

  /**
   * Execute CLI command
   */
  async executeCLI(command: string, args: string[] = [], options: {
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  } = {}): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
  }> {
    const { spawn } = require('child_process');
    
    return new Promise((resolve, reject) => {
      const child = spawn('node', [command, ...args], {
        cwd: options.cwd || process.cwd(),
        env: { ...process.env, ...options.env },
        stdio: 'pipe'
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`Command timed out after ${options.timeout || 30000}ms`));
      }, options.timeout || 30000);

      child.on('close', (code: number) => {
        clearTimeout(timeout);
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code
        });
      });

      child.on('error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  },

  /**
   * Create test CSV files
   */
  async createTestCSVFiles(inputDir: string, tier: string, data: {
    integrations: string;
    imports: string;
    exports: string;
    flows: string;
    connections: string;
  }): Promise<void> {
    const tierDir = path.join(inputDir, tier);
    await fs.mkdir(tierDir, { recursive: true });

    await fs.writeFile(path.join(tierDir, 'integrations.csv'), data.integrations);
    await fs.writeFile(path.join(tierDir, 'imports.csv'), data.imports);
    await fs.writeFile(path.join(tierDir, 'exports.csv'), data.exports);
    await fs.writeFile(path.join(tierDir, 'flows.csv'), data.flows);
    await fs.writeFile(path.join(tierDir, 'connections.csv'), data.connections);
  },

  /**
   * Create test configuration files
   */
  async createTestConfig(configDir: string, businessConfig: any, remediationConfig: any): Promise<void> {
    await fs.writeFile(
      path.join(configDir, 'business-rules.json'),
      JSON.stringify(businessConfig, null, 2)
    );
    await fs.writeFile(
      path.join(configDir, 'remediation-logic.json'),
      JSON.stringify(remediationConfig, null, 2)
    );
  },

  /**
   * Wait for file to exist
   */
  async waitForFile(filePath: string, timeout = 10000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        await fs.access(filePath);
        return true;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    return false;
  },

  /**
   * Read JSON file
   */
  async readJSONFile(filePath: string): Promise<any> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  },

  /**
   * Check if directory contains expected files
   */
  async checkDirectoryContents(dirPath: string, expectedFiles: string[]): Promise<{
    found: string[];
    missing: string[];
  }> {
    try {
      const files = await fs.readdir(dirPath);
      const found = expectedFiles.filter(file => files.includes(file));
      const missing = expectedFiles.filter(file => !files.includes(file));
      return { found, missing };
    } catch {
      return { found: [], missing: expectedFiles };
    }
  },

  /**
   * Clean up test environment
   */
  async cleanupTestEnvironment(testDir: string): Promise<void> {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
};

// Global cleanup
afterEach(async () => {
  // Clean up any test environments
  try {
    await fs.rm('./test-e2e-output', { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});
