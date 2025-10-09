/**
 * API Routes - Enterprise Pattern
 * Centralized route management with proper separation of concerns
 */

import { Router } from 'express';
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

  // Mount route modules
  router.use('/', healthRoutes);
  router.use('/api/system', createSystemRoutes(stateManager));
  router.use('/api/config', configRoutes);
  router.use('/api/business-rules', businessRulesRoutes);
  router.use('/api/state', createStateRoutes(stateManager));
  router.use('/api/fix', createFixRoutes(stateManager));
  router.use('/api/audit', auditRoutes);
  router.use('/api/products', productsRoutes);
  router.use('/api/cli', cliRoutes);
  router.use('/api/files', filesRoutes);

  return router;
}
