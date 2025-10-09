/**
 * System Routes
 * System status and version endpoints
 */

import { Router, Request, Response } from 'express';
import { StateManager } from '../../state/state-manager';

export function createSystemRoutes(stateManager: StateManager): Router {
  const router = Router();

  /**
   * @swagger
   * /api/system/status:
   *   get:
   *     tags: [Health & System]
   *     summary: System Status
   *     description: CLI equivalent - integration-auditor status
   */
  router.get('/system/status', async (req: Request, res: Response) => {
    try {
      const stats = await stateManager.getProcessingStats();
      res.json({
        status: 'healthy',
        version: '1.0.0',
        architecture: 'Data-Driven (JSON Configuration)',
        nodeVersion: process.version,
        uptime: process.uptime(),
        components: {
          corruptionDetector: 'operational',
          remediationEngine: 'operational',
          stateManager: 'operational',
          csvProcessor: 'operational'
        },
        configuration: {
          businessRules: './config/business-rules.json',
          remediationLogic: './config/remediation-logic.json',
          persistentState: './state/processing-state.db'
        },
        processingStats: stats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get system status',
        details: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/system/version:
   *   get:
   *     tags: [Health & System]
   *     summary: Version Information
   */
  router.get('/system/version', (req: Request, res: Response) => {
    res.json({
      version: '1.0.0',
      name: 'Integration Auditor',
      architecture: 'Data-Driven',
      nodeVersion: process.version,
      buildDate: new Date().toISOString()
    });
  });

  return router;
}

// Default export for backward compatibility
export const systemRoutes = createSystemRoutes(new StateManager('./state/remediation-queue.db'));
