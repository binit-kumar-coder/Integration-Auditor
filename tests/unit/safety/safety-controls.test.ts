/**
 * Unit tests for SafetyController
 */

import { SafetyController, createSafetyController, SafetyConfig } from '../../../src/safety/safety-controls';

describe('SafetyController', () => {
  let safetyController: SafetyController;
  let mockConfig: SafetyConfig;

  beforeEach(() => {
    mockConfig = {
      allowlist: {
        integrationIds: ['allowed-001', 'allowed-002', 'allowed-003'],
        accounts: ['safe@example.com', 'trusted@example.com'],
        enabled: true
      },
      limits: {
        maxOpsPerIntegration: 50,
        maxConcurrentIntegrations: 20,
        maxTotalOperations: 500,
        rateLimit: {
          requestsPerSecond: 10,
          burstLimit: 50
        }
      },
      maintenanceWindow: {
        enabled: true,
        start: '02:00',
        end: '06:00',
        timezone: 'UTC',
        days: ['sunday', 'monday']
      },
      confirmation: {
        required: true,
        thresholds: {
          destructiveOps: 5,
          totalOps: 50,
          highRiskIntegrations: 10
        }
      },
      circuit: {
        enabled: true,
        failureThreshold: 5,
        recoveryTimeout: 60000,
        halfOpenMaxCalls: 3
      }
    };

    safetyController = new SafetyController(mockConfig);
  });

  describe('initialization', () => {
    it('should create safety controller with configuration', () => {
      expect(safetyController).toBeDefined();
      expect(safetyController.getStatus()).toBeDefined();
    });

    it('should create safety controller from environment variables', () => {
      // Set environment variables
      process.env.SAFETY_ALLOWLIST_ENABLED = 'true';
      process.env.SAFETY_ALLOWLIST_INTEGRATIONS = 'int1,int2,int3';
      process.env.SAFETY_MAX_OPS_PER_INTEGRATION = '100';
      process.env.SAFETY_CIRCUIT_BREAKER_ENABLED = 'true';

      const envController = createSafetyController();
      
      expect(envController).toBeDefined();
      expect(envController.getStatus().limits.maxOpsPerIntegration).toBe(100);

      // Cleanup
      delete process.env.SAFETY_ALLOWLIST_ENABLED;
      delete process.env.SAFETY_ALLOWLIST_INTEGRATIONS;
      delete process.env.SAFETY_MAX_OPS_PER_INTEGRATION;
      delete process.env.SAFETY_CIRCUIT_BREAKER_ENABLED;
    });
  });

  describe('allowlist validation', () => {
    it('should allow integrations in allowlist', async () => {
      const integrationIds = ['allowed-001', 'allowed-002'];
      const plans = [
        { actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } },
        { actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }
      ];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block integrations not in allowlist', async () => {
      const integrationIds = ['allowed-001', 'not-allowed-001'];
      const plans = [
        { actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } },
        { actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }
      ];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContainEqual(expect.stringContaining('not in allowlist'));
      expect(result.blockers[0]).toContain('not-allowed-001');
    });

    it('should allow all integrations when allowlist is disabled', async () => {
      const disabledAllowlistConfig = { ...mockConfig };
      disabledAllowlistConfig.allowlist.enabled = false;
      const controller = new SafetyController(disabledAllowlistConfig);

      const integrationIds = ['any-integration-001', 'any-integration-002'];
      const plans = [
        { actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } },
        { actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }
      ];

      const result = await controller.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(true);
      expect(result.blockers).toHaveLength(0);
    });
  });

  describe('maintenance window validation', () => {
    beforeEach(() => {
      // Mock Date to control current time for testing
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow operations during maintenance window', async () => {
      // Set time to Sunday 03:00 UTC (within maintenance window)
      const sundayMorning = new Date('2024-01-07T03:00:00Z'); // Sunday
      jest.setSystemTime(sundayMorning);

      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(true);
      expect(result.blockers.some(b => b.includes('maintenance window'))).toBe(false);
    });

    it('should block operations outside maintenance window time', async () => {
      // Set time to Sunday 08:00 UTC (outside maintenance window)
      const sundayMorning = new Date('2024-01-07T08:00:00Z'); // Sunday
      jest.setSystemTime(sundayMorning);

      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContainEqual(expect.stringContaining('Outside maintenance window'));
    });

    it('should block operations outside maintenance window days', async () => {
      // Set time to Tuesday 03:00 UTC (outside maintenance window days)
      const tuesdayMorning = new Date('2024-01-09T03:00:00Z'); // Tuesday
      jest.setSystemTime(tuesdayMorning);

      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContainEqual(expect.stringContaining('Outside maintenance window'));
    });

    it('should allow operations when maintenance window is disabled', async () => {
      const disabledMaintenanceConfig = { ...mockConfig };
      disabledMaintenanceConfig.maintenanceWindow.enabled = false;
      const controller = new SafetyController(disabledMaintenanceConfig);

      // Set time outside normal maintenance window
      const tuesdayMorning = new Date('2024-01-09T08:00:00Z'); // Tuesday
      jest.setSystemTime(tuesdayMorning);

      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await controller.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(true);
      expect(result.blockers.some(b => b.includes('maintenance window'))).toBe(false);
    });
  });

  describe('operation limits validation', () => {
    it('should allow operations within limits', async () => {
      const integrationIds = ['allowed-001', 'allowed-002'];
      const plans = [
        { 
          actions: Array(30).fill({}), 
          summary: { 
            riskLevel: 'low' as const, 
            actionsByType: { create: 30 }, 
            estimatedDuration: 5000 
          } 
        },
        { 
          actions: Array(20).fill({}), 
          summary: { 
            riskLevel: 'low' as const, 
            actionsByType: { create: 20 }, 
            estimatedDuration: 3000 
          } 
        }
      ];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(true);
      expect(result.scope.totalOperations).toBe(50);
      expect(result.scope.totalIntegrations).toBe(2);
    });

    it('should block operations exceeding total operations limit', async () => {
      const integrationIds = Array.from({ length: 10 }, (_, i) => `allowed-00${i + 1}`);
      const plans = integrationIds.map(() => ({
        actions: Array(60).fill({}),
        summary: { 
          riskLevel: 'low' as const, 
          actionsByType: { create: 60 }, 
          estimatedDuration: 10000 
        }
      }));

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContainEqual(expect.stringContaining('Total operations'));
      expect(result.scope.totalOperations).toBe(600); // 10 * 60
    });

    it('should block operations exceeding operations per integration limit', async () => {
      const integrationIds = ['allowed-001'];
      const plans = [{
        actions: Array(60).fill({}), // Exceeds maxOpsPerIntegration (50)
        summary: { 
          riskLevel: 'low' as const, 
          actionsByType: { create: 60 }, 
          estimatedDuration: 15000 
        }
      }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContainEqual(expect.stringContaining('operations per integration'));
    });

    it('should block operations exceeding concurrent integrations limit', async () => {
      const integrationIds = Array.from({ length: 25 }, (_, i) => `allowed-${String(i + 1).padStart(3, '0')}`);
      const plans = integrationIds.map(() => ({
        actions: Array(10).fill({}),
        summary: { 
          riskLevel: 'low' as const, 
          actionsByType: { create: 10 }, 
          estimatedDuration: 2000 
        }
      }));

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContainEqual(expect.stringContaining('Concurrent integrations'));
      expect(result.scope.totalIntegrations).toBe(25);
    });

    it('should provide warnings when approaching limits', async () => {
      const integrationIds = ['allowed-001', 'allowed-002'];
      const plans = [
        { 
          actions: Array(45).fill({}), // Close to maxOpsPerIntegration (50)
          summary: { 
            riskLevel: 'low' as const, 
            actionsByType: { create: 45 }, 
            estimatedDuration: 8000 
          } 
        },
        { 
          actions: Array(400).fill({}), // Close to maxTotalOperations (500)
          summary: { 
            riskLevel: 'low' as const, 
            actionsByType: { create: 400 }, 
            estimatedDuration: 20000 
          } 
        }
      ];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings).toContainEqual(expect.stringContaining('Approaching'));
    });
  });

  describe('confirmation requirements', () => {
    it('should require confirmation for many destructive operations', async () => {
      const integrationIds = ['allowed-001'];
      const plans = [{
        actions: Array(10).fill({}),
        summary: { 
          riskLevel: 'low' as const, 
          actionsByType: { delete: 10 }, // Exceeds destructiveOps threshold (5)
          estimatedDuration: 5000 
        }
      }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.warnings).toContainEqual(expect.stringContaining('requires explicit confirmation'));
    });

    it('should require confirmation for many total operations', async () => {
      const integrationIds = Array.from({ length: 10 }, (_, i) => `allowed-00${i + 1}`);
      const plans = integrationIds.map(() => ({
        actions: Array(10).fill({}),
        summary: { 
          riskLevel: 'low' as const, 
          actionsByType: { create: 10 }, 
          estimatedDuration: 2000 
        }
      }));

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.warnings).toContainEqual(expect.stringContaining('requires explicit confirmation'));
      expect(result.scope.totalOperations).toBe(100); // Exceeds totalOps threshold (50)
    });

    it('should require confirmation for many high-risk integrations', async () => {
      const integrationIds = Array.from({ length: 15 }, (_, i) => `allowed-${String(i + 1).padStart(3, '0')}`);
      const plans = integrationIds.map(() => ({
        actions: Array(5).fill({}),
        summary: { 
          riskLevel: 'critical' as const, 
          actionsByType: { delete: 5 }, 
          estimatedDuration: 3000 
        }
      }));

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.warnings).toContainEqual(expect.stringContaining('requires explicit confirmation'));
      expect(result.scope.highRiskIntegrations).toBe(15); // Exceeds highRiskIntegrations threshold (10)
    });

    it('should not require confirmation when disabled', async () => {
      const noConfirmationConfig = { ...mockConfig };
      noConfirmationConfig.confirmation.required = false;
      const controller = new SafetyController(noConfirmationConfig);

      const integrationIds = ['allowed-001'];
      const plans = [{
        actions: Array(20).fill({}),
        summary: { 
          riskLevel: 'critical' as const, 
          actionsByType: { delete: 20 }, 
          estimatedDuration: 10000 
        }
      }];

      const result = await controller.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.warnings.some(w => w.includes('confirmation'))).toBe(false);
    });
  });

  describe('circuit breaker', () => {
    it('should allow operations when circuit breaker is closed', async () => {
      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(true);
      expect(result.blockers.some(b => b.includes('Circuit breaker'))).toBe(false);
    });

    it('should block operations when circuit breaker is open', async () => {
      // Trigger circuit breaker by recording failures
      for (let i = 0; i < 5; i++) {
        safetyController.recordExecutionResult(false);
      }

      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(false);
      expect(result.blockers).toContainEqual(expect.stringContaining('Circuit breaker is OPEN'));
    });

    it('should allow limited operations when circuit breaker is half-open', async () => {
      // First, open the circuit breaker
      for (let i = 0; i < 5; i++) {
        safetyController.recordExecutionResult(false);
      }

      // Wait for recovery timeout (we'll mock this by manipulating the circuit breaker state)
      jest.useFakeTimers();
      jest.advanceTimersByTime(61000); // Advance past recovery timeout

      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      // Should allow some operations in half-open state
      expect(result.allowed).toBe(true);

      jest.useRealTimers();
    });

    it('should allow operations when circuit breaker is disabled', async () => {
      const disabledCircuitConfig = { ...mockConfig };
      disabledCircuitConfig.circuit.enabled = false;
      const controller = new SafetyController(disabledCircuitConfig);

      const integrationIds = ['allowed-001'];
      const plans = [{ actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } }];

      const result = await controller.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.allowed).toBe(true);
      expect(result.blockers.some(b => b.includes('Circuit breaker'))).toBe(false);
    });
  });

  describe('scope analysis', () => {
    it('should analyze operation scope correctly', async () => {
      const integrationIds = ['allowed-001', 'allowed-002'];
      const plans = [
        {
          actions: Array(20).fill({}),
          summary: {
            riskLevel: 'medium' as const,
            actionsByType: { create: 15, delete: 5 },
            estimatedDuration: 5000
          }
        },
        {
          actions: Array(30).fill({}),
          summary: {
            riskLevel: 'high' as const,
            actionsByType: { patch: 25, reconnect: 5 },
            estimatedDuration: 8000
          }
        }
      ];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.scope.totalIntegrations).toBe(2);
      expect(result.scope.totalOperations).toBe(50);
      expect(result.scope.operationsByType.create).toBe(15);
      expect(result.scope.operationsByType.delete).toBe(5);
      expect(result.scope.operationsByType.patch).toBe(25);
      expect(result.scope.operationsByType.reconnect).toBe(5);
      expect(result.scope.highRiskIntegrations).toBe(1); // Only 'high' risk
      expect(result.scope.estimatedDuration).toBe(13000);
    });

    it('should count high and critical risk integrations correctly', async () => {
      const integrationIds = ['allowed-001', 'allowed-002', 'allowed-003'];
      const plans = [
        { actions: [], summary: { riskLevel: 'low', actionsByType: {}, estimatedDuration: 1000 } },
        { actions: [], summary: { riskLevel: 'high', actionsByType: {}, estimatedDuration: 2000 } },
        { actions: [], summary: { riskLevel: 'critical', actionsByType: {}, estimatedDuration: 3000 } }
      ];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.scope.highRiskIntegrations).toBe(2); // 'high' + 'critical'
    });
  });

  describe('recommendations generation', () => {
    it('should recommend batch size reduction for large operations', async () => {
      const integrationIds = Array.from({ length: 150 }, (_, i) => `allowed-${String(i + 1).padStart(3, '0')}`);
      const plans = integrationIds.map(() => ({
        actions: [{}],
        summary: { riskLevel: 'low' as const, actionsByType: { create: 1 }, estimatedDuration: 1000 }
      }));

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.recommendations).toContainEqual(expect.stringContaining('reducing batch size'));
    });

    it('should recommend dry run for high-risk operations', async () => {
      const integrationIds = ['allowed-001'];
      const plans = [{
        actions: [{}],
        summary: { riskLevel: 'critical' as const, actionsByType: { delete: 1 }, estimatedDuration: 1000 }
      }];

      const result = await safetyController.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.recommendations).toContainEqual(expect.stringContaining('--dry-run'));
    });

    it('should recommend maintenance window for large operations', async () => {
      const disabledMaintenanceConfig = { ...mockConfig };
      disabledMaintenanceConfig.maintenanceWindow.enabled = false;
      const controller = new SafetyController(disabledMaintenanceConfig);

      const integrationIds = Array.from({ length: 10 }, (_, i) => `allowed-00${i + 1}`);
      const plans = integrationIds.map(() => ({
        actions: Array(10).fill({}),
        summary: { riskLevel: 'low' as const, actionsByType: { create: 10 }, estimatedDuration: 2000 }
      }));

      const result = await controller.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.recommendations).toContainEqual(expect.stringContaining('maintenance window'));
    });

    it('should recommend allowlist for testing', async () => {
      const disabledAllowlistConfig = { ...mockConfig };
      disabledAllowlistConfig.allowlist.enabled = false;
      const controller = new SafetyController(disabledAllowlistConfig);

      const integrationIds = Array.from({ length: 15 }, (_, i) => `any-integration-${i + 1}`);
      const plans = integrationIds.map(() => ({
        actions: [{}],
        summary: { riskLevel: 'low' as const, actionsByType: { create: 1 }, estimatedDuration: 1000 }
      }));

      const result = await controller.performPreflightCheck(integrationIds, plans, 'operator-1');

      expect(result.recommendations).toContainEqual(expect.stringContaining('--allowlist'));
    });
  });

  describe('status reporting', () => {
    it('should provide current safety status', () => {
      const status = safetyController.getStatus();

      expect(status.circuitBreaker).toBeDefined();
      expect(status.circuitBreaker.state).toBe('CLOSED');
      expect(status.circuitBreaker.failures).toBe(0);

      expect(status.maintenanceWindow).toBeDefined();
      expect(status.maintenanceWindow.active).toBeDefined();
      expect(status.maintenanceWindow.nextWindow).toBeDefined();

      expect(status.limits).toEqual(mockConfig.limits);
    });

    it('should update circuit breaker status after recording results', () => {
      // Record some failures
      safetyController.recordExecutionResult(false);
      safetyController.recordExecutionResult(false);

      const status = safetyController.getStatus();

      expect(status.circuitBreaker.failures).toBe(2);
      expect(status.circuitBreaker.state).toBe('CLOSED'); // Still closed, below threshold
    });

    it('should show circuit breaker as open after threshold failures', () => {
      // Record failures to exceed threshold
      for (let i = 0; i < 5; i++) {
        safetyController.recordExecutionResult(false);
      }

      const status = safetyController.getStatus();

      expect(status.circuitBreaker.failures).toBe(5);
      expect(status.circuitBreaker.state).toBe('OPEN');
    });
  });

  describe('execution result recording', () => {
    it('should record successful executions', () => {
      safetyController.recordExecutionResult(true);
      safetyController.recordExecutionResult(true);

      const status = safetyController.getStatus();
      expect(status.circuitBreaker.failures).toBe(0);
      expect(status.circuitBreaker.state).toBe('CLOSED');
    });

    it('should record failed executions', () => {
      safetyController.recordExecutionResult(false);
      safetyController.recordExecutionResult(false);

      const status = safetyController.getStatus();
      expect(status.circuitBreaker.failures).toBe(2);
      expect(status.circuitBreaker.state).toBe('CLOSED');
    });

    it('should reset failures after successful executions in half-open state', () => {
      // Open the circuit breaker
      for (let i = 0; i < 5; i++) {
        safetyController.recordExecutionResult(false);
      }

      // Simulate recovery timeout
      jest.useFakeTimers();
      jest.advanceTimersByTime(61000);

      // Record successful executions in half-open state
      for (let i = 0; i < 3; i++) {
        safetyController.recordExecutionResult(true);
      }

      const status = safetyController.getStatus();
      expect(status.circuitBreaker.state).toBe('CLOSED');
      expect(status.circuitBreaker.failures).toBe(0);

      jest.useRealTimers();
    });
  });
});
