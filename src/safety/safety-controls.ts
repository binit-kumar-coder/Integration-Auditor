/**
 * Safety & Scope Controls
 * Implements allowlists, rate limits, and maintenance windows
 */

export interface SafetyConfig {
  allowlist: {
    integrationIds: string[];
    accounts: string[];
    enabled: boolean;
  };
  limits: {
    maxOpsPerIntegration: number;
    maxConcurrentIntegrations: number;
    maxTotalOperations: number;
    rateLimit: {
      requestsPerSecond: number;
      burstLimit: number;
    };
  };
  maintenanceWindow: {
    enabled: boolean;
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
    days: string[]; // ['monday', 'tuesday', ...]
  };
  confirmation: {
    required: boolean;
    thresholds: {
      destructiveOps: number;
      totalOps: number;
      highRiskIntegrations: number;
    };
  };
  circuit: {
    enabled: boolean;
    failureThreshold: number;
    recoveryTimeout: number;
    halfOpenMaxCalls: number;
  };
}

export interface PreflightResult {
  allowed: boolean;
  scope: {
    totalIntegrations: number;
    totalOperations: number;
    operationsByType: Record<string, number>;
    highRiskIntegrations: number;
    estimatedDuration: number;
  };
  warnings: string[];
  blockers: string[];
  recommendations: string[];
}

export class SafetyController {
  private config: SafetyConfig;
  private circuitBreaker: CircuitBreaker;

  constructor(config: SafetyConfig) {
    this.config = config;
    this.circuitBreaker = new CircuitBreaker(config.circuit);
  }

  /**
   * Perform pre-flight safety checks
   */
  async performPreflightCheck(
    integrationIds: string[],
    plans: any[],
    _operatorId: string
  ): Promise<PreflightResult> {
    const result: PreflightResult = {
      allowed: true,
      scope: {
        totalIntegrations: integrationIds.length,
        totalOperations: 0,
        operationsByType: {},
        highRiskIntegrations: 0,
        estimatedDuration: 0
      },
      warnings: [],
      blockers: [],
      recommendations: []
    };

    // Check circuit breaker
    if (!this.circuitBreaker.canExecute()) {
      result.allowed = false;
      result.blockers.push('Circuit breaker is OPEN - too many recent failures');
      return result;
    }

    // Check allowlist
    const allowlistCheck = this.checkAllowlist(integrationIds);
    if (!allowlistCheck.allowed) {
      result.allowed = false;
      result.blockers.push(...allowlistCheck.blockers);
    }

    // Check maintenance window
    const maintenanceCheck = this.checkMaintenanceWindow();
    if (!maintenanceCheck.allowed) {
      result.allowed = false;
      result.blockers.push(...maintenanceCheck.blockers);
    }

    // Analyze scope
    this.analyzeScope(plans, result);

    // Check limits
    const limitsCheck = this.checkLimits(result.scope);
    if (!limitsCheck.allowed) {
      result.allowed = false;
      result.blockers.push(...limitsCheck.blockers);
    }
    result.warnings.push(...limitsCheck.warnings);

    // Check confirmation requirements
    const confirmationCheck = this.checkConfirmationRequirements(result.scope);
    if (confirmationCheck.required) {
      result.warnings.push('This operation requires explicit confirmation due to scope/risk');
    }

    // Generate recommendations
    this.generateRecommendations(result);

    return result;
  }

  /**
   * Check if integrations are in allowlist
   */
  private checkAllowlist(integrationIds: string[]): { allowed: boolean; blockers: string[] } {
    if (!this.config.allowlist.enabled) {
      return { allowed: true, blockers: [] };
    }

    const blockers: string[] = [];
    const disallowedIds = integrationIds.filter(id => 
      !this.config.allowlist.integrationIds.includes(id)
    );

    if (disallowedIds.length > 0) {
      blockers.push(`Integrations not in allowlist: ${disallowedIds.slice(0, 5).join(', ')}${disallowedIds.length > 5 ? '...' : ''}`);
    }

    return {
      allowed: disallowedIds.length === 0,
      blockers
    };
  }

  /**
   * Check maintenance window
   */
  private checkMaintenanceWindow(): { allowed: boolean; blockers: string[] } {
    if (!this.config.maintenanceWindow.enabled) {
      return { allowed: true, blockers: [] };
    }

    const now = new Date();
    const currentDay = now.toLocaleDateString('en', { weekday: 'short' }).toLowerCase(); // 'mon', 'tue', etc.
    const currentTime = now.toTimeString().substring(0, 5); // 'HH:MM'

    // Check if current day is allowed
    const allowedDays = this.config.maintenanceWindow.days.map(d => d.substring(0, 3).toLowerCase());
    if (!allowedDays.includes(currentDay)) {
      return {
        allowed: false,
        blockers: [`Outside maintenance window: ${this.config.maintenanceWindow.days.join(', ')}`]
      };
    }

    // Check if current time is in window
    const start = this.config.maintenanceWindow.start;
    const end = this.config.maintenanceWindow.end;
    
    if (currentTime < start || currentTime > end) {
      return {
        allowed: false,
        blockers: [`Outside maintenance window: ${start} - ${end} ${this.config.maintenanceWindow.timezone}`]
      };
    }

    return { allowed: true, blockers: [] };
  }

  /**
   * Analyze operation scope
   */
  private analyzeScope(plans: any[], result: PreflightResult): void {
    for (const plan of plans) {
      result.scope.totalOperations += plan.actions.length;
      result.scope.estimatedDuration += plan.summary.estimatedDuration;

      if (plan.summary.riskLevel === 'high' || plan.summary.riskLevel === 'critical') {
        result.scope.highRiskIntegrations++;
      }

      // Count operations by type
      for (const [type, count] of Object.entries(plan.summary.actionsByType)) {
        result.scope.operationsByType[type] = (result.scope.operationsByType[type] || 0) + (count as number);
      }
    }
  }

  /**
   * Check operation limits
   */
  private checkLimits(scope: PreflightResult['scope']): { allowed: boolean; blockers: string[]; warnings: string[] } {
    const blockers: string[] = [];
    const warnings: string[] = [];

    // Check max operations per integration
    const avgOpsPerIntegration = scope.totalOperations / scope.totalIntegrations;
    if (avgOpsPerIntegration > this.config.limits.maxOpsPerIntegration) {
      blockers.push(`Average operations per integration (${avgOpsPerIntegration.toFixed(1)}) exceeds limit (${this.config.limits.maxOpsPerIntegration})`);
    }

    // Check max total operations
    if (scope.totalOperations > this.config.limits.maxTotalOperations) {
      blockers.push(`Total operations (${scope.totalOperations}) exceeds limit (${this.config.limits.maxTotalOperations})`);
    }

    // Check concurrent integrations
    if (scope.totalIntegrations > this.config.limits.maxConcurrentIntegrations) {
      blockers.push(`Concurrent integrations (${scope.totalIntegrations}) exceeds limit (${this.config.limits.maxConcurrentIntegrations})`);
    }

    // Warnings for approaching limits
    if (avgOpsPerIntegration > this.config.limits.maxOpsPerIntegration * 0.8) {
      warnings.push(`Approaching max operations per integration limit`);
    }

    if (scope.totalOperations > this.config.limits.maxTotalOperations * 0.8) {
      warnings.push(`Approaching max total operations limit`);
    }

    return {
      allowed: blockers.length === 0,
      blockers,
      warnings
    };
  }

  /**
   * Check if confirmation is required
   */
  private checkConfirmationRequirements(scope: PreflightResult['scope']): { required: boolean } {
    if (!this.config.confirmation.required) {
      return { required: false };
    }

    const destructiveOps = scope.operationsByType['delete'] || 0;
    
    return {
      required: (
        destructiveOps >= this.config.confirmation.thresholds.destructiveOps ||
        scope.totalOperations >= this.config.confirmation.thresholds.totalOps ||
        scope.highRiskIntegrations >= this.config.confirmation.thresholds.highRiskIntegrations
      )
    };
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(result: PreflightResult): void {
    // Recommend batch size reduction
    if (result.scope.totalIntegrations > 100) {
      result.recommendations.push('Consider reducing batch size for better monitoring and rollback capability');
    }

    // Recommend dry run first
    if (result.scope.highRiskIntegrations > 0) {
      result.recommendations.push('Run with --dry-run first to review high-risk operations');
    }

    // Recommend maintenance window
    if (!this.config.maintenanceWindow.enabled && result.scope.totalOperations > 50) {
      result.recommendations.push('Consider running during maintenance window for large operations');
    }

    // Recommend allowlist
    if (!this.config.allowlist.enabled && result.scope.totalIntegrations > 10) {
      result.recommendations.push('Consider using --allowlist to limit scope for testing');
    }
  }

  /**
   * Record execution result for circuit breaker
   */
  recordExecutionResult(success: boolean): void {
    this.circuitBreaker.recordResult(success);
  }

  /**
   * Get current safety status
   */
  getStatus(): {
    circuitBreaker: { state: string; failures: number };
    maintenanceWindow: { active: boolean; nextWindow?: string };
    limits: SafetyConfig['limits'];
  } {
    return {
      circuitBreaker: {
        state: this.circuitBreaker.getState(),
        failures: this.circuitBreaker.getFailureCount()
      },
      maintenanceWindow: {
        active: this.isInMaintenanceWindow(),
        nextWindow: this.getNextMaintenanceWindow()
      },
      limits: this.config.limits
    };
  }

  /**
   * Check if currently in maintenance window
   */
  private isInMaintenanceWindow(): boolean {
    if (!this.config.maintenanceWindow.enabled) return true;
    
    const check = this.checkMaintenanceWindow();
    return check.allowed;
  }

  /**
   * Get next maintenance window
   */
  private getNextMaintenanceWindow(): string | undefined {
    if (!this.config.maintenanceWindow.enabled) return undefined;
    
    // Simple implementation - in production, use proper date/time library
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    return `${tomorrow.toDateString()} ${this.config.maintenanceWindow.start}`;
  }
}

/**
 * Circuit breaker implementation
 */
class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private failures = 0;
  private lastFailureTime = 0;
  private halfOpenCalls = 0;

  constructor(private config: SafetyConfig['circuit']) {}

  canExecute(): boolean {
    if (!this.config.enabled) return true;

    switch (this.state) {
      case 'CLOSED':
        return true;
      
      case 'OPEN':
        if (new Date().getTime() - this.lastFailureTime > this.config.recoveryTimeout) {
          this.state = 'HALF_OPEN';
          this.halfOpenCalls = 0;
          return true;
        }
        return false;
      
      case 'HALF_OPEN':
        return this.halfOpenCalls < this.config.halfOpenMaxCalls;
      
      default:
        return false;
    }
  }

  recordResult(success: boolean): void {
    if (!this.config.enabled) return;

    if (success) {
      if (this.state === 'HALF_OPEN') {
        this.halfOpenCalls++;
        if (this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
          this.state = 'CLOSED';
          this.failures = 0;
        }
      } else {
        this.failures = Math.max(0, this.failures - 1);
      }
    } else {
      this.failures++;
      this.lastFailureTime = new Date().getTime();
      
      if (this.failures >= this.config.failureThreshold) {
        this.state = 'OPEN';
      }
    }
  }

  getState(): string {
    return this.state;
  }

  getFailureCount(): number {
    return this.failures;
  }
}

/**
 * Create safety controller from environment
 */
export function createSafetyController(): SafetyController {
  const config: SafetyConfig = {
    allowlist: {
      integrationIds: (process.env['SAFETY_ALLOWLIST_INTEGRATIONS'] || '').split(',').filter(Boolean),
      accounts: (process.env['SAFETY_ALLOWLIST_ACCOUNTS'] || '').split(',').filter(Boolean),
      enabled: process.env['SAFETY_ALLOWLIST_ENABLED'] === 'true'
    },
    limits: {
      maxOpsPerIntegration: parseInt(process.env['SAFETY_MAX_OPS_PER_INTEGRATION'] || '100'),
      maxConcurrentIntegrations: parseInt(process.env['SAFETY_MAX_CONCURRENT_INTEGRATIONS'] || '50'),
      maxTotalOperations: parseInt(process.env['SAFETY_MAX_TOTAL_OPERATIONS'] || '1000'),
      rateLimit: {
        requestsPerSecond: parseInt(process.env['SAFETY_RATE_LIMIT_RPS'] || '10'),
        burstLimit: parseInt(process.env['SAFETY_RATE_LIMIT_BURST'] || '50')
      }
    },
    maintenanceWindow: {
      enabled: process.env['SAFETY_MAINTENANCE_WINDOW_ENABLED'] === 'true',
      start: process.env['SAFETY_MAINTENANCE_WINDOW_START'] || '02:00',
      end: process.env['SAFETY_MAINTENANCE_WINDOW_END'] || '06:00',
      timezone: process.env['SAFETY_MAINTENANCE_WINDOW_TIMEZONE'] || 'UTC',
      days: (process.env['SAFETY_MAINTENANCE_WINDOW_DAYS'] || 'sunday').split(',')
    },
    confirmation: {
      required: process.env['SAFETY_CONFIRMATION_REQUIRED'] !== 'false',
      thresholds: {
        destructiveOps: parseInt(process.env['SAFETY_CONFIRMATION_DESTRUCTIVE_THRESHOLD'] || '5'),
        totalOps: parseInt(process.env['SAFETY_CONFIRMATION_TOTAL_THRESHOLD'] || '50'),
        highRiskIntegrations: parseInt(process.env['SAFETY_CONFIRMATION_RISK_THRESHOLD'] || '10')
      }
    },
    circuit: {
      enabled: process.env['SAFETY_CIRCUIT_BREAKER_ENABLED'] === 'true',
      failureThreshold: parseInt(process.env['SAFETY_CIRCUIT_BREAKER_THRESHOLD'] || '5'),
      recoveryTimeout: parseInt(process.env['SAFETY_CIRCUIT_BREAKER_RECOVERY'] || '60000'),
      halfOpenMaxCalls: parseInt(process.env['SAFETY_CIRCUIT_BREAKER_HALF_OPEN'] || '3')
    }
  };

  return new SafetyController(config);
}
