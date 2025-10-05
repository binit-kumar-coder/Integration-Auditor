// Core types for the rule-based CSV integration auditor system

export interface IntegrationSnapshot {
  id: string;
  email: string;
  userId: string;
  version: string;
  storeCount: number;
  licenseEdition: 'starter' | 'standard' | 'premium' | 'enterprise';
  updateInProgress: boolean;
  settings: Settings;
  imports: ImportResource[];
  exports: ExportResource[];
  flows: FlowResource[];
  connections: ConnectionResource[];
}

export interface Settings {
  connectorEdition: 'starter' | 'standard' | 'premium' | 'enterprise';
  [key: string]: any;
}

export interface ImportResource {
  externalId: string;
  connectionId?: string;
  _id: string;
  name: string;
  type: string;
}

export interface ExportResource {
  externalId: string;
  connectionId?: string;
  _id: string;
  name: string;
  type: string;
}

export interface FlowResource {
  _id: string;
  name: string;
  type: string;
}

export interface ConnectionResource {
  _id: string;
  name: string;
  type: string;
  offline?: boolean;
}

export interface AuditResult {
  integrationId: string;
  email: string;
  version: string;
  edition: string;
  fixable: boolean;
  issues: {
    importsCheck: {
      missing: string[];
      duplicate: string[];
    };
    exportsCheck: {
      missing: string[];
      duplicate: string[];
    };
    flowsCheck: {
      missing: string[];
      duplicate: string[];
    };
    connectionsCheck: {
      missing: string[];
      duplicate: string[];
    };
    offlineConnections: string[];
    missingSettings: Array<{
      section: string;
      keys: string[];
    }>;
    updateInProgress: boolean;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
  estimatedFixTime: number;
}

export interface RemediationPlan {
  integrationId: string;
  actions: RemediationAction[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dryRun: boolean;
}

export interface RemediationAction {
  type: 'create' | 'update' | 'delete' | 'reconnect' | 'clearFlag';
  target: {
    type: 'import' | 'export' | 'flow' | 'connection' | 'setting';
    id: string;
    resourceType?: string;
  };
  data?: any;
  reason: string;
}

// Rule-based processing types
export interface RuleBasedAuditResult {
  integrationId: string;
  email: string;
  version: string;
  edition: string;
  corruptionEvents: any[];
  overallSeverity: 'low' | 'medium' | 'high' | 'critical';
  fixable: boolean;
  estimatedFixTime: number;
  rulesApplied: string[];
  processingTime: number;
}

export interface CSVProcessingMetrics {
  totalFiles: number;
  totalSize: number;
  processingTime: number;
  recordsProcessed: number;
  errorsFound: number;
}

// Legacy exports for compatibility - now pointing to rule-based system
export class IntegrationAuditor {
  constructor() {
    throw new Error('IntegrationAuditor has been deprecated. Use the new rule-based system with RuleBasedCorruptionDetector instead.');
  }
}

export class IntegrationRemediator {
  constructor() {
    throw new Error('IntegrationRemediator has been deprecated. Use the new rule-based system with RuleBasedRemediationEngine instead.');
  }
}
