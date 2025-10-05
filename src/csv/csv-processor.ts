/**
 * CSV Processor for Integration Data
 * Replaces API-based data loading with CSV file processing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { IntegrationSnapshot } from '../types';

export interface CSVProcessingOptions {
  inputDirectory: string;
  tier: string;
  batchSize?: number;
  validateHeaders?: boolean;
}

export interface CSVProcessingResult {
  totalIntegrations: number;
  processedIntegrations: number;
  errorCount: number;
  warnings: string[];
  errors: string[];
  processingTime: number;
}

export class CSVProcessor {
  private readonly requiredFiles = [
    'integrations.csv',
    'imports.csv',
    'exports.csv',
    'flows.csv',
    'connections.csv'
  ];

  /**
   * Process CSV files and return integration snapshots
   */
  async processCSVFiles(options: CSVProcessingOptions): Promise<{
    integrations: IntegrationSnapshot[];
    result: CSVProcessingResult;
  }> {
    const startTime = Date.now();
    const result: CSVProcessingResult = {
      totalIntegrations: 0,
      processedIntegrations: 0,
      errorCount: 0,
      warnings: [],
      errors: [],
      processingTime: 0
    };

    try {
      // Validate input directory and files
      await this.validateInputFiles(options, result);

      // Load CSV data
      const csvData = await this.loadCSVData(options, result);

      // Transform CSV data to integration snapshots
      const integrations = await this.transformToIntegrations(csvData, result);

      result.totalIntegrations = integrations.length;
      result.processedIntegrations = integrations.length;
      result.processingTime = Date.now() - startTime;

      return { integrations, result };

    } catch (error) {
      result.errors.push(`CSV processing failed: ${(error as Error).message}`);
      result.errorCount++;
      result.processingTime = Date.now() - startTime;
      
      return { integrations: [], result };
    }
  }

  /**
   * Validate that all required CSV files exist
   */
  private async validateInputFiles(
    options: CSVProcessingOptions,
    result: CSVProcessingResult
  ): Promise<void> {
    const tierPath = path.join(options.inputDirectory, options.tier);

    try {
      const stat = await fs.stat(tierPath);
      if (!stat.isDirectory()) {
        throw new Error(`Tier directory not found: ${tierPath}`);
      }
    } catch (error) {
      throw new Error(`Cannot access tier directory: ${tierPath}`);
    }

    // Check for required files
    for (const requiredFile of this.requiredFiles) {
      const filePath = path.join(tierPath, requiredFile);
      try {
        await fs.access(filePath);
      } catch (error) {
        const warning = `Missing required file: ${requiredFile}`;
        result.warnings.push(warning);
        console.warn(`⚠️  ${warning}`);
      }
    }

    console.log(`✅ Validated input directory: ${tierPath}`);
  }

  /**
   * Load data from all CSV files
   */
  private async loadCSVData(
    options: CSVProcessingOptions,
    result: CSVProcessingResult
  ): Promise<{
    integrations: any[];
    imports: any[];
    exports: any[];
    flows: any[];
    connections: any[];
  }> {
    const tierPath = path.join(options.inputDirectory, options.tier);
    
    const [integrations, imports, exports, flows, connections] = await Promise.all([
      this.loadCSVFile(path.join(tierPath, 'integrations.csv')),
      this.loadCSVFile(path.join(tierPath, 'imports.csv')),
      this.loadCSVFile(path.join(tierPath, 'exports.csv')),
      this.loadCSVFile(path.join(tierPath, 'flows.csv')),
      this.loadCSVFile(path.join(tierPath, 'connections.csv'))
    ]);

    console.log(`📊 Loaded CSV data:
    - Integrations: ${integrations.length}
    - Imports: ${imports.length}
    - Exports: ${exports.length}
    - Flows: ${flows.length}
    - Connections: ${connections.length}`);

    return { integrations, imports, exports, flows, connections };
  }

  /**
   * Load individual CSV file
   */
  private async loadCSVFile(filePath: string): Promise<any[]> {
    try {
      await fs.access(filePath);
    } catch (error) {
      console.warn(`⚠️  File not found: ${filePath}, returning empty array`);
      return [];
    }

    return new Promise((resolve, reject) => {
      const results: any[] = [];
      
      createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          console.log(`✅ Loaded ${results.length} records from ${path.basename(filePath)}`);
          resolve(results);
        })
        .on('error', (error) => {
          console.error(`❌ Error loading ${filePath}:`, error);
          reject(error);
        });
    });
  }

  /**
   * Transform CSV data into integration snapshots
   */
  private async transformToIntegrations(
    csvData: {
      integrations: any[];
      imports: any[];
      exports: any[];
      flows: any[];
      connections: any[];
    },
    result: CSVProcessingResult
  ): Promise<IntegrationSnapshot[]> {
    const integrations: IntegrationSnapshot[] = [];

    for (const integrationRow of csvData.integrations) {
      try {
        const integration = this.createIntegrationSnapshot(
          integrationRow,
          csvData
        );
        integrations.push(integration);
      } catch (error) {
        result.errors.push(`Failed to process integration ${integrationRow.id || 'unknown'}: ${(error as Error).message}`);
        result.errorCount++;
      }
    }

    return integrations;
  }

  /**
   * Create integration snapshot from CSV row data (handles tier1 format)
   */
  private createIntegrationSnapshot(
    integrationRow: any,
    csvData: {
      imports: any[];
      exports: any[];
      flows: any[];
      connections: any[];
    }
  ): IntegrationSnapshot {
    // Handle tier1 format with quoted fields and different column names
    const integrationId = this.cleanQuotedValue(integrationRow._ID || integrationRow.id || integrationRow.integrationId);
    
    if (!integrationId) {
      throw new Error('Integration ID is required');
    }

    // Filter related resources by integration ID (handle quoted values)
    const relatedImports = csvData.imports.filter(imp => 
      this.cleanQuotedValue(imp.INTEGRATIONID || imp.integrationId) === integrationId
    );
    
    const relatedExports = csvData.exports.filter(exp => 
      this.cleanQuotedValue(exp.INTEGRATIONID || exp.integrationId) === integrationId
    );
    
    const relatedFlows = csvData.flows.filter(flow => 
      this.cleanQuotedValue(flow.INTEGRATIONID || flow.integrationId) === integrationId
    );
    
    const relatedConnections = csvData.connections.filter(conn => 
      this.cleanQuotedValue(conn.INTEGRATIONID || conn.integrationId) === integrationId
    );

    // Parse settings - handle tier1 format
    let settings: any = {};
    const settingsStr = integrationRow.SETTINGS || integrationRow.settings;
    if (settingsStr) {
      try {
        settings = typeof settingsStr === 'string' 
          ? JSON.parse(settingsStr)
          : settingsStr;
      } catch (error) {
        console.warn(`⚠️  Failed to parse settings for integration ${integrationId}`);
        settings = { 
          connectorEdition: this.cleanQuotedValue(integrationRow.LICENSEEDITION) || 'standard' 
        };
      }
    } else {
      // Default settings structure
      settings = {
        connectorEdition: this.cleanQuotedValue(integrationRow.LICENSEEDITION) || 'standard',
        general: {},
        storemap: [],
        sections: [],
        commonresources: {}
      };
    }

    // Ensure connectorEdition is set from license if not in settings
    if (!settings.connectorEdition) {
      settings.connectorEdition = this.cleanQuotedValue(integrationRow.LICENSEEDITION) || 'standard';
    }

    return {
      id: integrationId,
      email: this.cleanQuotedValue(integrationRow.EMAIL || integrationRow.email) || 'unknown@example.com',
      userId: this.cleanQuotedValue(integrationRow._USERID || integrationRow.userId) || 'unknown',
      version: this.cleanQuotedValue(integrationRow.VERSION || integrationRow.version) || '1.0.0',
      storeCount: parseInt(integrationRow.NUMSTORES || integrationRow.storeCount || '1'),
      licenseEdition: this.cleanQuotedValue(integrationRow.LICENSEEDITION || integrationRow.licenseEdition) as any || 'standard',
      updateInProgress: this.parseBoolean(integrationRow.UPDATEINPROGRESS || integrationRow.updateInProgress),
      settings,
      imports: relatedImports.map(imp => ({
        externalId: this.cleanQuotedValue(imp.EXTERNALID || imp.externalId),
        connectionId: this.cleanQuotedValue(imp.IMPORTCONNECTIONID || imp.connectionId),
        _id: this.cleanQuotedValue(imp.IMPORTID || imp._id || imp.id),
        name: this.cleanQuotedValue(imp.EXTERNALID || imp.name || imp.externalId),
        type: 'import'
      })),
      exports: relatedExports.map(exp => ({
        externalId: this.cleanQuotedValue(exp.EXTERNALID || exp.externalId),
        connectionId: this.cleanQuotedValue(exp.EXPORTCONNECTIONID || exp.connectionId),
        _id: this.cleanQuotedValue(exp.EXPORTID || exp._id || exp.id),
        name: this.cleanQuotedValue(exp.EXTERNALID || exp.name || exp.externalId),
        type: 'export'
      })),
      flows: relatedFlows.map(flow => ({
        _id: this.cleanQuotedValue(flow.FLOWID || flow._id || flow.id),
        name: this.cleanQuotedValue(flow.EXTERNALID || flow.name || flow.externalId),
        type: 'flow'
      })),
      connections: relatedConnections.map(conn => ({
        _id: this.cleanQuotedValue(conn.IACONNECTIONID || conn._id || conn.id),
        name: this.cleanQuotedValue(conn.EXTERNALID || conn.name || conn.externalId),
        type: 'connection',
        offline: this.parseBoolean(conn.CONNECTIONOFFLINE || conn.offline)
      }))
    };
  }

  /**
   * Parse boolean values from CSV string data
   */
  private parseBoolean(value: any): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') {
      const cleaned = this.cleanQuotedValue(value);
      return cleaned.toLowerCase() === 'true' || cleaned === '1';
    }
    return false;
  }

  /**
   * Clean quoted values from CSV fields (removes surrounding quotes)
   */
  private cleanQuotedValue(value: any): string {
    if (typeof value !== 'string') return String(value || '');
    
    // Remove surrounding quotes if present
    let cleaned = value.trim();
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) || 
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1);
    }
    
    return cleaned;
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(options: CSVProcessingOptions): Promise<{
    fileStats: { file: string; size: number; rows?: number }[];
    totalSize: number;
  }> {
    const tierPath = path.join(options.inputDirectory, options.tier);
    const fileStats: { file: string; size: number; rows?: number }[] = [];
    let totalSize = 0;

    for (const fileName of this.requiredFiles) {
      const filePath = path.join(tierPath, fileName);
      try {
        const stat = await fs.stat(filePath);
        fileStats.push({
          file: fileName,
          size: stat.size
        });
        totalSize += stat.size;
      } catch (error) {
        fileStats.push({
          file: fileName,
          size: 0
        });
      }
    }

    return { fileStats, totalSize };
  }

  /**
   * Validate CSV headers match expected format
   */
  async validateCSVHeaders(options: CSVProcessingOptions): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    const tierPath = path.join(options.inputDirectory, options.tier);

    const expectedHeaders = {
      'integrations.csv': ['_ID', 'EMAIL', 'VERSION', 'NUMSTORES', 'LICENSEEDITION'],
      'imports.csv': ['INTEGRATIONID', 'EXTERNALID', 'IMPORTID'],
      'exports.csv': ['INTEGRATIONID', 'EXTERNALID', 'EXPORTID'],
      'flows.csv': ['INTEGRATIONID', 'EXTERNALID', 'FLOWID'],
      'connections.csv': ['INTEGRATIONID', 'IACONNECTIONID', 'EXTERNALID', 'CONNECTIONOFFLINE']
    };

    for (const [fileName, expectedCols] of Object.entries(expectedHeaders)) {
      const filePath = path.join(tierPath, fileName);
      try {
        // Read first row to check headers
        const headers = await this.getCSVHeaders(filePath);
        const missing = expectedCols.filter(col => !headers.includes(col));
        
        if (missing.length > 0) {
          issues.push(`${fileName}: Missing columns: ${missing.join(', ')}`);
        }
      } catch (error) {
        issues.push(`${fileName}: Could not validate headers - ${(error as Error).message}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Get CSV file headers
   */
  private async getCSVHeaders(filePath: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const headers: string[] = [];
      let headersParsed = false;

      createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headerList) => {
          headers.push(...headerList);
          headersParsed = true;
        })
        .on('data', () => {
          if (headersParsed) {
            resolve(headers);
          }
        })
        .on('error', reject);
    });
  }
}
