// Integration Auditor - Enterprise Edition
// Main entry point for the Data-Driven Integration Auditor system

// Core data-driven components
export { DataDrivenCorruptionDetector } from './rules/data-driven-corruption-detector';
export { DataDrivenRemediationEngine } from './rules/data-driven-remediation-engine';

// CSV processing
export { CSVProcessor } from './csv/csv-processor';

// Note: Manifest management removed - all business logic now in config/business-rules.json

// Planning and execution
export { ExecutionPlanner } from './planner/execution-planner';
export type { ExecutionAction, ExecutionPlan } from './planner/execution-planner';

// Enterprise components
export { createSafetyController } from './safety/safety-controls';
export { AuditLogger } from './audit/audit-logger';
export { Logger } from './utils/logger';

// Types
export type {
  IntegrationSnapshot,
  AuditResult,
  RemediationPlan,
  RuleBasedAuditResult,
  CSVProcessingMetrics
} from './types';

// Legacy compatibility (redirect to new system)
export { IntegrationAuditor, IntegrationRemediator } from './types';
