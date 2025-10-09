/**
 * Health Routes
 * Basic health and status endpoints
 */

import { Router, Request, Response } from 'express';

export const healthRoutes = Router();

/**
 * @swagger
 * /health:
 *   get:
 *     tags: [Health & System]
 *     summary: Health Check
 *     description: Check if the Integration Auditor service is running and healthy
 *     responses:
 *       200:
 *         description: Service is healthy
 */
healthRoutes.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'integration-auditor-remediation',
    version: '1.0.0'
  });
});
