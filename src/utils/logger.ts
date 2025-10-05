import fs from 'fs/promises';
import path from 'path';

// ============================================================================
// COMPREHENSIVE LOGGING SYSTEM
// ============================================================================

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  integrationId?: string;
  message: string;
  data?: any;
  error?: any;
}

export class Logger {
  private logDir: string;
  private logFile: string;
  private errorFile: string;
  private failureFile: string;

  constructor(logDir: string = './logs') {
    this.logDir = logDir;
    this.logFile = path.join(logDir, 'integration-auditor.log');
    this.errorFile = path.join(logDir, 'errors.log');
    this.failureFile = path.join(logDir, 'failures.log');
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.logDir, { recursive: true });
  }

  async info(component: string, message: string, data?: any, integrationId?: string): Promise<void> {
    await this.log('info', component, message, data, integrationId);
  }

  async warn(component: string, message: string, data?: any, integrationId?: string): Promise<void> {
    await this.log('warn', component, message, data, integrationId);
  }

  async error(component: string, message: string, error?: any, integrationId?: string): Promise<void> {
    await this.log('error', component, message, undefined, integrationId, error);
    
    // Also write to dedicated error file
    await this.writeToFile(this.errorFile, this.formatLogEntry({
      timestamp: new Date().toISOString(),
      level: 'error',
      component,
      integrationId,
      message,
      error: error ? this.serializeError(error) : undefined
    }));
  }

  async logFailure(integrationId: string, email: string, error: any, duration: number): Promise<void> {
    const failureEntry = {
      timestamp: new Date().toISOString(),
      integrationId,
      email,
      error: this.serializeError(error),
      duration,
      errorType: this.categorizeError(error)
    };

    // Write to failures log
    await this.writeToFile(this.failureFile, JSON.stringify(failureEntry) + '\n');
    
    // Also log as error
    await this.error('orchestrator', `Integration processing failed: ${integrationId}`, error, integrationId);
  }

  private async log(level: LogEntry['level'], component: string, message: string, data?: any, integrationId?: string, error?: any): Promise<void> {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      component,
      integrationId,
      message,
      data,
      error: error ? this.serializeError(error) : undefined
    };

    // Write to main log file
    await this.writeToFile(this.logFile, this.formatLogEntry(entry));

    // Also output to console in development
    if (process.env['NODE_ENV'] !== 'production') {
      const prefix = level.toUpperCase().padEnd(5);
      const componentStr = component.padEnd(15);
      const integrationStr = integrationId ? ` [${integrationId}]` : '';
      console.log(`${prefix} ${componentStr}${integrationStr} ${message}`);
      
      if (data) {
        console.log('      Data:', JSON.stringify(data, null, 2));
      }
      
      if (error) {
        console.log('      Error:', this.serializeError(error));
      }
    }
  }

  private formatLogEntry(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private async writeToFile(filePath: string, content: string): Promise<void> {
    try {
      await fs.appendFile(filePath, content);
    } catch (error) {
      // Fallback to console if file write fails
      console.error(`Failed to write to log file ${filePath}:`, error);
    }
  }

  private serializeError(error: any): any {
    if (error instanceof Error) {
      return {
        name: error.name,
        message: error.message,
        stack: error.stack,
        ...(error as any) // Include additional properties like ZodError issues
      };
    }
    return error;
  }

  private categorizeError(error: any): string {
    const errorStr = JSON.stringify(error);
    
    if (errorStr.includes('shopifyMarkets')) {
      return 'CASE_SENSITIVITY_ISSUE';
    } else if (errorStr.includes('Expected object, received array')) {
      return 'DATA_TYPE_MISMATCH';
    } else if (errorStr.includes('String must contain at least 1 character')) {
      return 'EMPTY_REQUIRED_FIELD';
    } else if (errorStr.includes('invalid_enum_value')) {
      return 'INVALID_ENUM_VALUE';
    } else if (errorStr.includes('ZodError')) {
      return 'SCHEMA_VALIDATION_ERROR';
    } else {
      return 'UNKNOWN_ERROR';
    }
  }

  async generateFailureSummary(): Promise<void> {
    try {
      const failureLogContent = await fs.readFile(this.failureFile, 'utf8');
      const failures = failureLogContent.trim().split('\n')
        .filter(line => line && line.trim())
        .map(line => JSON.parse(line));

      const summary = {
        totalFailures: failures.length,
        failuresByType: {},
        failuresByEmail: {},
        recentFailures: failures.slice(-10),
        oldestFailures: failures.slice(0, 10)
      };

      // Group by error type
      failures.forEach(failure => {
        const type = failure.errorType || 'UNKNOWN';
        (summary.failuresByType as any)[type] = ((summary.failuresByType as any)[type] || 0) + 1;
        
        const email = failure.email || 'unknown';
        (summary.failuresByEmail as any)[email] = ((summary.failuresByEmail as any)[email] || 0) + 1;
      });

      await fs.writeFile(
        path.join(this.logDir, 'failure-summary.json'),
        JSON.stringify(summary, null, 2)
      );

      console.log('📊 Failure summary generated: ./logs/failure-summary.json');
      
    } catch (error) {
      console.warn('⚠️ Could not generate failure summary:', (error as Error).message);
    }
  }
}

// Singleton logger instance
let loggerInstance: Logger | null = null;

export function getLogger(logDir?: string): Logger {
  if (!loggerInstance) {
    loggerInstance = new Logger(logDir);
  }
  return loggerInstance;
}

export default Logger;
