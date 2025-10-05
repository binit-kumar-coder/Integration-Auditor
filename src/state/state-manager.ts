/**
 * Persistent State Manager
 * Tracks processed integrations across multiple runs using SQLite
 * Survives session deletions and provides incremental processing
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Database } from 'sqlite3';
import { open } from 'sqlite';

export interface ProcessedIntegration {
  integrationId: string;
  email: string;
  lastProcessedAt: string;
  lastCorruptionHash: string;
  lastRemediationHash: string;
  processingStatus: 'detected' | 'remediated' | 'failed' | 'skipped';
  operatorId: string;
  sessionId: string;
  corruptionCount: number;
  actionCount: number;
}

export interface StateQuery {
  integrationId?: string;
  operatorId?: string;
  status?: string;
  since?: string;
  limit?: number;
}

export class StateManager {
  private dbPath: string;
  private db: any = null;
  private initialized = false;

  constructor(dbPath: string = './state/processing-state.db') {
    this.dbPath = dbPath;
  }

  /**
   * Initialize state database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure state directory exists
    await fs.mkdir(path.dirname(this.dbPath), { recursive: true });

    // Open SQLite database
    this.db = await open({
      filename: this.dbPath,
      driver: Database
    });

    // Create tables if they don't exist
    await this.createTables();
    
    this.initialized = true;
    console.log(`📊 State manager initialized: ${this.dbPath}`);
  }

  /**
   * Check if integration was already processed recently
   */
  async isAlreadyProcessed(
    integrationId: string, 
    corruptionHash: string,
    maxAge: number = 24 * 60 * 60 * 1000 // 24 hours default
  ): Promise<boolean> {
    await this.ensureInitialized();

    const result = await this.db.get(`
      SELECT lastProcessedAt, lastCorruptionHash, processingStatus
      FROM processed_integrations 
      WHERE integrationId = ?
      ORDER BY lastProcessedAt DESC
      LIMIT 1
    `, [integrationId]);

    if (!result) return false;

    const lastProcessed = new Date(result.lastProcessedAt).getTime();
    const now = Date.now();
    const age = now - lastProcessed;

    // Skip if processed recently with same corruption signature
    if (age < maxAge && result.lastCorruptionHash === corruptionHash) {
      console.log(`⏭️  SKIPPING: ${integrationId} - Processed ${Math.round(age / (60 * 60 * 1000))}h ago with same signature`);
      return true;
    }

    return false;
  }

  /**
   * Record integration processing
   */
  async recordProcessing(
    integrationId: string,
    email: string,
    corruptionEvents: any[],
    remediationActions: any[],
    operatorId: string,
    sessionId: string,
    status: 'detected' | 'remediated' | 'failed' | 'skipped'
  ): Promise<void> {
    await this.ensureInitialized();

    const corruptionHash = this.generateCorruptionHash(corruptionEvents);
    const remediationHash = this.generateHash(remediationActions);

    await this.db.run(`
      INSERT OR REPLACE INTO processed_integrations (
        integrationId, email, lastProcessedAt, lastCorruptionHash, 
        lastRemediationHash, processingStatus, operatorId, sessionId,
        corruptionCount, actionCount
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      integrationId,
      email,
      new Date().toISOString(),
      corruptionHash,
      remediationHash,
      status,
      operatorId,
      sessionId,
      corruptionEvents.length,
      remediationActions.length
    ]);
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(timeRange?: { start: string; end: string }): Promise<{
    totalProcessed: number;
    byStatus: Record<string, number>;
    byOperator: Record<string, number>;
    recentActivity: ProcessedIntegration[];
    oldestRecord: string;
    newestRecord: string;
  }> {
    await this.ensureInitialized();

    let whereClause = '';
    let params: any[] = [];

    if (timeRange) {
      whereClause = 'WHERE lastProcessedAt BETWEEN ? AND ?';
      params = [timeRange.start, timeRange.end];
    }

    const stats = await this.db.all(`
      SELECT 
        processingStatus,
        operatorId,
        COUNT(*) as count,
        MIN(lastProcessedAt) as oldest,
        MAX(lastProcessedAt) as newest
      FROM processed_integrations 
      ${whereClause}
      GROUP BY processingStatus, operatorId
    `, params);

    const recentActivity = await this.db.all(`
      SELECT * FROM processed_integrations 
      ${whereClause}
      ORDER BY lastProcessedAt DESC 
      LIMIT 10
    `, params);

    const byStatus: Record<string, number> = {};
    const byOperator: Record<string, number> = {};
    let totalProcessed = 0;
    let oldestRecord = '';
    let newestRecord = '';

    for (const stat of stats) {
      byStatus[stat.processingStatus] = (byStatus[stat.processingStatus] || 0) + stat.count;
      byOperator[stat.operatorId] = (byOperator[stat.operatorId] || 0) + stat.count;
      totalProcessed += stat.count;
      
      if (!oldestRecord || stat.oldest < oldestRecord) {
        oldestRecord = stat.oldest;
      }
      if (!newestRecord || stat.newest > newestRecord) {
        newestRecord = stat.newest;
      }
    }

    return {
      totalProcessed,
      byStatus,
      byOperator,
      recentActivity,
      oldestRecord,
      newestRecord
    };
  }

  /**
   * Query processed integrations
   */
  async queryProcessed(query: StateQuery): Promise<ProcessedIntegration[]> {
    await this.ensureInitialized();

    let sql = 'SELECT * FROM processed_integrations WHERE 1=1';
    const params: any[] = [];

    if (query.integrationId) {
      sql += ' AND integrationId = ?';
      params.push(query.integrationId);
    }

    if (query.operatorId) {
      sql += ' AND operatorId = ?';
      params.push(query.operatorId);
    }

    if (query.status) {
      sql += ' AND processingStatus = ?';
      params.push(query.status);
    }

    if (query.since) {
      sql += ' AND lastProcessedAt >= ?';
      params.push(query.since);
    }

    sql += ' ORDER BY lastProcessedAt DESC';

    if (query.limit) {
      sql += ' LIMIT ?';
      params.push(query.limit);
    }

    return await this.db.all(sql, params);
  }

  /**
   * Get integrations that need reprocessing
   */
  async getStaleIntegrations(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<ProcessedIntegration[]> {
    await this.ensureInitialized();

    const cutoffTime = new Date(Date.now() - maxAge).toISOString();

    return await this.db.all(`
      SELECT * FROM processed_integrations 
      WHERE lastProcessedAt < ? 
      OR processingStatus = 'failed'
      ORDER BY lastProcessedAt ASC
    `, [cutoffTime]);
  }

  /**
   * Clean up old records
   */
  async cleanup(olderThan: number = 30 * 24 * 60 * 60 * 1000): Promise<number> {
    await this.ensureInitialized();

    const cutoffTime = new Date(Date.now() - olderThan).toISOString();

    const result = await this.db.run(`
      DELETE FROM processed_integrations 
      WHERE lastProcessedAt < ? 
      AND processingStatus IN ('detected', 'remediated')
    `, [cutoffTime]);

    console.log(`🧹 Cleaned up ${result.changes} old records (older than ${Math.round(olderThan / (24 * 60 * 60 * 1000))} days)`);
    return result.changes;
  }

  /**
   * Get processing summary for current session
   */
  async getSessionSummary(sessionId: string): Promise<{
    totalProcessed: number;
    newProcessed: number;
    skipped: number;
    failed: number;
    startTime: string;
    endTime: string;
  }> {
    await this.ensureInitialized();

    const stats = await this.db.all(`
      SELECT 
        processingStatus,
        COUNT(*) as count,
        MIN(lastProcessedAt) as startTime,
        MAX(lastProcessedAt) as endTime
      FROM processed_integrations 
      WHERE sessionId = ?
      GROUP BY processingStatus
    `, [sessionId]);

    const summary = {
      totalProcessed: 0,
      newProcessed: 0,
      skipped: 0,
      failed: 0,
      startTime: '',
      endTime: ''
    };

    for (const stat of stats) {
      summary.totalProcessed += stat.count;
      
      if (stat.processingStatus === 'detected' || stat.processingStatus === 'remediated') {
        summary.newProcessed += stat.count;
      } else if (stat.processingStatus === 'skipped') {
        summary.skipped += stat.count;
      } else if (stat.processingStatus === 'failed') {
        summary.failed += stat.count;
      }

      if (!summary.startTime || stat.startTime < summary.startTime) {
        summary.startTime = stat.startTime;
      }
      if (!summary.endTime || stat.endTime > summary.endTime) {
        summary.endTime = stat.endTime;
      }
    }

    return summary;
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    await this.db.exec(`
      CREATE TABLE IF NOT EXISTS processed_integrations (
        integrationId TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        lastProcessedAt TEXT NOT NULL,
        lastCorruptionHash TEXT NOT NULL,
        lastRemediationHash TEXT NOT NULL,
        processingStatus TEXT NOT NULL,
        operatorId TEXT NOT NULL,
        sessionId TEXT NOT NULL,
        corruptionCount INTEGER DEFAULT 0,
        actionCount INTEGER DEFAULT 0,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_processed_at ON processed_integrations(lastProcessedAt);
      CREATE INDEX IF NOT EXISTS idx_operator ON processed_integrations(operatorId);
      CREATE INDEX IF NOT EXISTS idx_session ON processed_integrations(sessionId);
      CREATE INDEX IF NOT EXISTS idx_status ON processed_integrations(processingStatus);
    `);
  }

  /**
   * Generate hash for corruption events (consistent with CLI logic)
   */
  private generateCorruptionHash(corruptionEvents: any[]): string {
    const hashData = corruptionEvents.map(event => {
      // Create stable hash data excluding timestamps and volatile fields
      const stableDetails = { ...event.params.details };
      
      // Remove volatile fields that change between runs
      delete stableDetails.detectedAt;
      delete stableDetails.timestamp;
      delete stableDetails.lastProcessed;
      delete stableDetails.sessionId;
      
      return {
        type: event.params.corruptionType,
        resourceType: event.params.resourceType,
        severity: event.params.severity,
        // Only include stable aspects of details
        stableDetails: {
          status: stableDetails.status,
          integrationId: stableDetails.integrationId,
          updateInProgress: stableDetails.updateInProgress,
          // Include other stable fields but exclude timestamps
          expectedCount: stableDetails.expectedCount,
          actualCount: stableDetails.actualCount,
          missingProperties: stableDetails.missingProperties,
          offlineConnections: stableDetails.offlineConnections
        }
      };
    });
    
    return Buffer.from(JSON.stringify(hashData)).toString('base64').substring(0, 32);
  }

  /**
   * Generate hash for remediation data
   */
  private generateHash(data: any[]): string {
    const hashData = data.map(item => ({
      type: item.type || item.params?.corruptionType,
      target: item.target?.resourceType || item.params?.resourceType,
      severity: item.params?.severity || item.metadata?.priority
    }));
    
    return Buffer.from(JSON.stringify(hashData)).toString('base64').substring(0, 32);
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.db) {
      await this.db.close();
      this.db = null;
      this.initialized = false;
    }
  }

  /**
   * Export state for backup
   */
  async exportState(): Promise<any> {
    await this.ensureInitialized();

    return {
      exportedAt: new Date().toISOString(),
      totalRecords: await this.db.get('SELECT COUNT(*) as count FROM processed_integrations'),
      records: await this.db.all('SELECT * FROM processed_integrations ORDER BY lastProcessedAt DESC')
    };
  }

  /**
   * Import state from backup
   */
  async importState(stateData: any): Promise<void> {
    await this.ensureInitialized();

    for (const record of stateData.records) {
      await this.db.run(`
        INSERT OR REPLACE INTO processed_integrations 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        record.integrationId,
        record.email,
        record.lastProcessedAt,
        record.lastCorruptionHash,
        record.lastRemediationHash,
        record.processingStatus,
        record.operatorId,
        record.sessionId,
        record.corruptionCount,
        record.actionCount,
        record.createdAt,
        record.updatedAt
      ]);
    }

    console.log(`📥 Imported ${stateData.records.length} state records`);
  }
}
