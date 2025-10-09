/**
 * Configuration Routes
 * Configuration management endpoints
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';

export const configRoutes = Router();

/**
 * @swagger
 * /api/config:
 *   get:
 *     tags: [Configuration]
 *     summary: Get Configuration
 *     description: CLI equivalent - integration-auditor config --show
 */
configRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const businessRules = JSON.parse(await fs.readFile('./config/business-rules.json', 'utf-8'));
    const remediationLogic = JSON.parse(await fs.readFile('./config/remediation-logic.json', 'utf-8'));
    
    res.json({
      status: 'success',
      config: {
        businessRules,
        remediationLogic,
        loadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load configuration',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/config/validate:
 *   post:
 *     tags: [Configuration]
 *     summary: Validate Configuration
 *     description: CLI equivalent - integration-auditor config --validate
 */
configRoutes.post('/validate', async (req: Request, res: Response) => {
  try {
    const { configType, config } = req.body;
    
    // Basic validation - in production this would use JSON Schema
    const isValid = configType && config && typeof config === 'object';
    
    res.json({
      status: 'success',
      valid: isValid,
      configType,
      validatedAt: new Date().toISOString(),
      message: isValid ? 'Configuration is valid' : 'Configuration validation failed'
    });
  } catch (error) {
    res.status(500).json({
      error: 'Configuration validation failed',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/config/path/{path}:
 *   get:
 *     tags: [Configuration]
 *     summary: Get Configuration from Custom Path
 *     description: CLI equivalent - integration-auditor config --config-path ./custom/path
 */
configRoutes.get('/custom-path', async (req: Request, res: Response) => {
  try {
    const configPath = req.query['path'] as string || './config';
    const businessRulesPath = `${configPath}/business-rules.json`;
    const remediationLogicPath = `${configPath}/remediation-logic.json`;
    
    const businessRules = JSON.parse(await fs.readFile(businessRulesPath, 'utf-8'));
    const remediationLogic = JSON.parse(await fs.readFile(remediationLogicPath, 'utf-8'));
    
    return res.json({
      status: 'success',
      configPath,
      config: {
        businessRules,
        remediationLogic,
        loadedFrom: configPath,
        loadedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to load configuration from path ${req.query['path']}`,
      details: (error as Error).message
    });
  }
});
