/**
 * Global setup for E2E tests
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export default async function globalSetup(): Promise<void> {
  console.log('🚀 Setting up E2E test environment...');

  // Build the project if needed
  const distDir = path.join(process.cwd(), 'dist');
  try {
    await fs.access(distDir);
    console.log('✅ Dist directory found, skipping build');
  } catch {
    console.log('🔨 Building project for E2E tests...');
    const { spawn } = require('child_process');
    
    await new Promise<void>((resolve, reject) => {
      const buildProcess = spawn('npm', ['run', 'build'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      buildProcess.on('close', (code: number) => {
        if (code === 0) {
          console.log('✅ Build completed successfully');
          resolve();
        } else {
          reject(new Error(`Build failed with exit code ${code}`));
        }
      });

      buildProcess.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  // Create test directories
  const testDirs = [
    './test-e2e-output',
    './test-e2e-logs',
    './test-e2e-state'
  ];

  for (const dir of testDirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log('✅ E2E test environment setup complete');
}
