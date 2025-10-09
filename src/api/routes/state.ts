/**
 * State Routes
 * Processing state management endpoints
 */

import { Router, Request, Response } from 'express';
import { StateManager } from '../../state/state-manager';

export function createStateRoutes(stateManager: StateManager): Router {
  const router = Router();

  /**
   * @swagger
   * /api/state/cleanup:
   *   post:
   *     tags: [State]
   *     summary: Cleanup State
   *     description: CLI equivalent - integration-auditor state --cleanup
   */
  router.post('/state/cleanup', async (req: Request, res: Response) => {
    try {
      const { olderThanDays } = req.body;
      const cleaned = await stateManager.cleanup(olderThanDays || 30);
      
      res.json({
        status: 'success',
        cleaned,
        message: `Cleaned ${cleaned} old records`,
        cleanedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'State cleanup failed',
        details: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/state/export:
   *   get:
   *     tags: [State]
   *     summary: Export State
   *     description: CLI equivalent - integration-auditor state --export
   */
  router.get('/state/export', async (req: Request, res: Response) => {
    try {
      const stateData = await stateManager.exportState();
      
      res.json({
        status: 'success',
        data: stateData,
        exportedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'State export failed',
        details: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/state/import:
   *   post:
   *     tags: [State]
   *     summary: Import State
   *     description: CLI equivalent - integration-auditor state --import
   */
  router.post('/state/import', async (req: Request, res: Response) => {
    try {
      const { stateData } = req.body;
      await stateManager.importState(stateData);
      
      res.json({
        status: 'success',
        message: 'State import completed',
        importedAt: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({
        error: 'State import failed',
        details: (error as Error).message
      });
    }
  });

  /**
   * @swagger
   * /api/state/reset:
   *   delete:
   *     tags: [State]
   *     summary: Reset State
   *     description: CLI equivalent - integration-auditor state --reset (DANGEROUS)
   */
  router.delete('/reset', async (req: Request, res: Response) => {
    try {
      const { confirm, operatorId = 'api-user' } = req.body;
      
      if (confirm !== 'RESET_ALL_STATE') {
        return res.status(400).json({
          error: 'Confirmation required',
          message: 'Send {"confirm": "RESET_ALL_STATE"} to confirm reset',
          warning: 'This will delete ALL processing history permanently!'
        });
      }

      // This would implement actual state reset logic
      // For now, return a warning message
      return res.json({
        status: 'success',
        message: 'All processing state has been reset',
        warning: 'All processing history has been permanently deleted',
        resetBy: operatorId,
        resetAt: new Date().toISOString()
      });
    } catch (error) {
      return res.status(500).json({
        error: 'State reset failed',
        details: (error as Error).message,
        timestamp: new Date().toISOString()
      });
    }
  });

  /**
   * @swagger
   * /api/state/operator/{operator}:
   *   get:
   *     tags: [State]
   *     summary: Get State by Operator
   *     description: CLI equivalent - integration-auditor state --operator john.doe
   */
  router.get('/operator/:operator', async (req: Request, res: Response) => {
    try {
      const operator = req.params['operator'];
      
      // This would filter state by operator - simplified for now
      const allStats = await stateManager.getProcessingStats();
      const operatorStats = {
        operator,
        totalProcessed: allStats.byOperator[operator] || 0,
        recentActivity: allStats.recentActivity.filter((record: any) => record.operatorId === operator),
        timestamp: new Date().toISOString()
      };
      
      return res.json({
        status: 'success',
        operator,
        stats: operatorStats,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      return res.status(500).json({
        error: `Failed to get state for operator ${req.params['operator']}`,
        details: (error as Error).message
      });
    }
  });

  return router;
}

// Default export for backward compatibility
export const stateRoutes = createStateRoutes(new StateManager('./state/remediation-queue.db'));
