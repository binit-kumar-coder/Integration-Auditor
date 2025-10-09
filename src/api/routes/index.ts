/**
 * API Routes - Enterprise Pattern
 * Centralized route management with proper separation of concerns
 */

import { Router, Request, Response } from 'express';
import { healthRoutes } from './health';
import { createSystemRoutes } from './system';
import { configRoutes } from './config';
import { businessRulesRoutes } from './business-rules';
import { createStateRoutes } from './state';
import { createFixRoutes } from './fix';
import { auditRoutes } from './audit';
import { productsRoutes } from './products';
import { cliRoutes } from './cli';
import { filesRoutes } from './files';
import { StateManager } from '../../state/state-manager';

export function createAPIRouter(stateManager: StateManager): Router {
  const router = Router();

  // Mount health routes at root level for /health endpoint
  router.use('/', healthRoutes);
  
  // Create dedicated health endpoint for /api/health
  router.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'integration-auditor-remediation',
      version: '1.0.0'
    });
  });
  
  // Mount all API routes under /api prefix (routes define their own sub-paths)
  router.use('/api', createSystemRoutes(stateManager)); // /api/system/*
  router.use('/api', configRoutes); // /api/config/*  
  router.use('/api', businessRulesRoutes); // /api/business-rules/*
  router.use('/api', createStateRoutes(stateManager)); // /api/state/*
  router.use('/api', createFixRoutes(stateManager)); // /api/fix/*
  router.use('/api', auditRoutes); // /api/audit/* and /api/corruption/*
  router.use('/api', productsRoutes); // /api/products/*
  router.use('/api', cliRoutes); // /api/cli/*
  router.use('/api', filesRoutes); // /api/files/*

  return router;
}
