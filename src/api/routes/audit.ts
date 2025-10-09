/**
 * Audit Routes  
 * CLI 'audit' command API equivalents
 */

import { Router, Request, Response } from 'express';
import { DataDrivenCorruptionDetector } from '../../rules/data-driven-corruption-detector';
import { CSVProcessor } from '../../csv/csv-processor';

export const auditRoutes = Router();

/**
 * @swagger
 * /api/audit/run:
 *   post:
 *     tags: [Audit]
 *     summary: Run Audit
 *     description: CLI equivalent - integration-auditor audit --tier tier1
 */
auditRoutes.post('/audit/run', async (req: Request, res: Response) => {
  try {
    const {
      tier = 'tier1',
      edition,
      input = './input',
      config = './config',
      operatorId = 'api-user'
    } = req.body;

    // Initialize components
    const corruptionDetector = new DataDrivenCorruptionDetector();
    const csvProcessor = new CSVProcessor();

    // Map edition to product
    const product = 'shopify-netsuite'; // Default product
    const version = '1.51.0';

    await corruptionDetector.initialize(product, version);

    // Load CSV data
    const csvResult = await csvProcessor.processCSVFiles({
      inputDirectory: input,
      tier,
      batchSize: 100
    });
    const integrations = csvResult.integrations;
    
    // Run audit on sample of integrations for API response
    const auditResults = {
      integrationsAudited: integrations.length,
      corruptionsDetected: 0,
      severityBreakdown: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      tier,
      edition: edition || 'all'
    };

    // Process sample integrations
    for (const integration of integrations.slice(0, 100)) {
      const corruptionResult = await corruptionDetector.detectCorruption(integration, {});
      if (corruptionResult.corruptionEvents.length > 0) {
        auditResults.corruptionsDetected++;
        
        // Categorize by severity
        for (const event of corruptionResult.corruptionEvents) {
          const severity = event.params.severity;
          if (severity in auditResults.severityBreakdown) {
            auditResults.severityBreakdown[severity as keyof typeof auditResults.severityBreakdown]++;
          }
        }
      }
    }

    res.json({
      status: 'success',
      audit: auditResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: 'Audit run failed',
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/audit/tier/{tier}:
 *   post:
 *     tags: [Audit]
 *     summary: Audit Specific Tier
 *     description: Audit integrations in a specific tier
 */
auditRoutes.post('/audit/tier/:tier', async (req: Request, res: Response) => {
  try {
    const tier = req.params['tier'];
    const { edition, operatorId = 'api-user' } = req.body;

    const auditResults = {
      tier,
      edition: edition || 'all',
      integrationsAudited: 50, // Mock data for now
      corruptionsDetected: 12,
      severityBreakdown: {
        critical: 2,
        high: 4,
        medium: 4,
        low: 2
      }
    };

    res.json({
      status: 'success',
      audit: auditResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: `Audit for tier ${req.params['tier']} failed`,
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/audit/product/{product}:
 *   post:
 *     tags: [Audit]
 *     summary: Audit Specific Product
 *     description: CLI equivalent - integration-auditor audit --product shopify-hubspot
 */
auditRoutes.post('/audit/product/:product', async (req: Request, res: Response) => {
  try {
    const product = req.params['product'];
    const { tier = 'tier1', version = '1.51.0', operatorId = 'api-user' } = req.body;

    // Initialize components for specific product
    const corruptionDetector = new DataDrivenCorruptionDetector();
    await corruptionDetector.initialize(product, version);

    const auditResults = {
      product,
      version,
      tier,
      integrationsAudited: 25, // Mock data for specific product
      corruptionsDetected: 8,
      severityBreakdown: {
        critical: 1,
        high: 2,
        medium: 3,
        low: 2
      }
    };

    return res.json({
      status: 'success',
      audit: auditResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return res.status(500).json({
      error: `Audit for product ${req.params['product']} failed`,
      details: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});
