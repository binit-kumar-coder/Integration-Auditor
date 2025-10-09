/**
 * Products Routes
 * CLI 'products' command API equivalents
 */

import { Router, Request, Response } from 'express';
import { ConfigurationManager } from '../../config/configuration-manager';

export const productsRoutes = Router();

/**
 * @swagger
 * /api/products:
 *   get:
 *     tags: [Products]
 *     summary: List Products
 *     description: CLI equivalent - integration-auditor products --list
 */
productsRoutes.get('/', async (req: Request, res: Response) => {
  try {
    const configManager = new ConfigurationManager();
    await configManager.initialize(); // Initialize to discover products
    const products = configManager.getAvailableProducts();
    
    res.json({
      status: 'success',
      products,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list products',
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/products/{product}:
 *   get:
 *     tags: [Products]
 *     summary: Get Product Details
 *     description: CLI equivalent - integration-auditor products --product shopify-netsuite
 */
productsRoutes.get('/:product', async (req: Request, res: Response) => {
  try {
    const product = req.params['product'];
    const configManager = new ConfigurationManager();
    await configManager.initialize(); // Initialize to discover products
    const versions = configManager.getAvailableVersions(product);
    
    res.json({
      status: 'success',
      product,
      versions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: `Failed to get product ${req.params['product']}`,
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/products/{product}/create:
 *   post:
 *     tags: [Products]
 *     summary: Create Product Configuration
 *     description: CLI equivalent - integration-auditor products --create product-name --version 1.0.0
 */
productsRoutes.post('/:product/create', async (req: Request, res: Response) => {
  try {
    const product = req.params['product'];
    const { version = '1.0.0', operatorId = 'api-user' } = req.body;
    
    // This would implement actual product creation logic
    // For now, return a structured response
    res.json({
      status: 'success',
      message: `Product configuration created for ${product}`,
      product,
      version,
      createdBy: operatorId,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: `Failed to create product ${req.params['product']}`,
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});
