/**
 * Business Rules Routes
 * Business rules management endpoints
 */

import { Router, Request, Response } from 'express';
import * as fs from 'fs/promises';

export const businessRulesRoutes = Router();

/**
 * @swagger
 * /api/business-rules:
 *   get:
 *     tags: [Business Rules]
 *     summary: Get Business Rules
 *     description: CLI equivalent - integration-auditor business-rules
 */
businessRulesRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const businessRules = JSON.parse(await fs.readFile('./config/business-rules.json', 'utf-8'));
    res.json({
      status: 'success',
      businessRules,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to load business rules',
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/business-rules/edition/{edition}:
 *   get:
 *     tags: [Business Rules]
 *     summary: Get Rules by Edition
 *     description: CLI equivalent - integration-auditor business-rules --edition premium
 */
businessRulesRoutes.get('/edition/:edition', async (req: Request, res: Response) => {
  try {
    const edition = req.params['edition'];
    const businessRules = JSON.parse(await fs.readFile('./config/business-rules.json', 'utf-8'));
    const editionRules = businessRules.editionRequirements[edition];
    
    if (!editionRules) {
      return res.status(404).json({
        error: `Edition ${edition} not found`,
        availableEditions: Object.keys(businessRules.editionRequirements)
      });
    }

    return res.json({
      status: 'success',
      edition,
      rules: editionRules,
      licenseValidation: businessRules.licenseValidation,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to get rules for edition ${req.params['edition']}`,
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/business-rules/product/{product}:
 *   get:
 *     tags: [Business Rules]
 *     summary: Get Rules by Product
 *     description: CLI equivalent - integration-auditor business-rules --product shopify-netsuite
 */
businessRulesRoutes.get('/product/:product', async (req: Request, res: Response) => {
  try {
    const product = req.params['product'];
    const businessRules = JSON.parse(await fs.readFile('./config/business-rules.json', 'utf-8'));
    
    return res.json({
      status: 'success',
      product,
      businessRules,
      configuration: {
        editionRequirements: businessRules.editionRequirements,
        licenseValidation: businessRules.licenseValidation,
        requiredProperties: businessRules.requiredProperties
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to get rules for product ${req.params['product']}`,
      details: (error as Error).message
    });
  }
});

/**
 * @swagger
 * /api/business-rules/product/{product}/version/{version}:
 *   get:
 *     tags: [Business Rules]
 *     summary: Get Rules by Product and Version
 *     description: CLI equivalent - integration-auditor business-rules --product X --version Y
 */
businessRulesRoutes.get('/product/:product/version/:version', async (req: Request, res: Response) => {
  try {
    const product = req.params['product'];
    const version = req.params['version'];
    
    // Load product-specific configuration if available
    let configPath = './config/business-rules.json';
    try {
      const productConfigPath = `./config/products/${product}/${version}-business-rules.json`;
      await fs.access(productConfigPath);
      configPath = productConfigPath;
    } catch {
      // Fall back to default config
    }
    
    const businessRules = JSON.parse(await fs.readFile(configPath, 'utf-8'));
    
    return res.json({
      status: 'success',
      product,
      version,
      businessRules,
      configPath,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({
      error: `Failed to get rules for product ${req.params['product']} version ${req.params['version']}`,
      details: (error as Error).message
    });
  }
});
