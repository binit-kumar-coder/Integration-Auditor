/**
 * Global teardown for E2E tests
 */

import * as fs from 'fs/promises';

export default async function globalTeardown(): Promise<void> {
  console.log('🧹 Cleaning up E2E test environment...');

  // Clean up test directories
  const testDirs = [
    './test-e2e-output',
    './test-e2e-logs',
    './test-e2e-state'
  ];

  for (const dir of testDirs) {
    try {
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  console.log('✅ E2E test environment cleanup complete');
}
