/**
 * Test fixtures for integration snapshots
 */

import { IntegrationSnapshot } from '../../src/types';

export const validIntegrationSnapshot: IntegrationSnapshot = {
  id: 'test-integration-001',
  email: 'test@example.com',
  userId: 'user-123',
  version: '1.51.0',
  storeCount: 2,
  licenseEdition: 'premium',
  updateInProgress: false,
  settings: {
    connectorEdition: 'premium',
    general: {
      timezone: 'UTC'
    },
    storemap: [
      { storeId: 'store1', name: 'Store 1' },
      { storeId: 'store2', name: 'Store 2' }
    ],
    sections: [
      { id: 'section1', mode: 'active', shopInstallComplete: true },
      { id: 'section2', mode: 'active', shopInstallComplete: true }
    ],
    commonresources: {
      netsuiteConnectionId: 'conn-123',
      nsUtilImportAdaptorApiIdentifier: 'api-123',
      nsUtilImportAdaptorId: 'adaptor-123'
    }
  },
  imports: [
    { externalId: 'import-1', connectionId: 'conn-1', _id: 'imp-1', name: 'Import 1', type: 'import' },
    { externalId: 'import-2', connectionId: 'conn-2', _id: 'imp-2', name: 'Import 2', type: 'import' }
  ],
  exports: [
    { externalId: 'export-1', connectionId: 'conn-1', _id: 'exp-1', name: 'Export 1', type: 'export' },
    { externalId: 'export-2', connectionId: 'conn-2', _id: 'exp-2', name: 'Export 2', type: 'export' }
  ],
  flows: [
    { _id: 'flow-1', name: 'Flow 1', type: 'flow' },
    { _id: 'flow-2', name: 'Flow 2', type: 'flow' }
  ],
  connections: [
    { _id: 'conn-1', name: 'Connection 1', type: 'connection', offline: false },
    { _id: 'conn-2', name: 'Connection 2', type: 'connection', offline: false }
  ]
};

export const integrationWithMissingResources: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-integration-missing',
  licenseEdition: 'premium',
  storeCount: 2,
  // Premium with 2 stores should have 64 imports, 64 exports, 54 flows
  // But this one has too few
  imports: [
    { externalId: 'import-1', connectionId: 'conn-1', _id: 'imp-1', name: 'Import 1', type: 'import' }
  ],
  exports: [
    { externalId: 'export-1', connectionId: 'conn-1', _id: 'exp-1', name: 'Export 1', type: 'export' }
  ],
  flows: [
    { _id: 'flow-1', name: 'Flow 1', type: 'flow' }
  ]
};

export const integrationWithDuplicateResources: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-integration-duplicate',
  licenseEdition: 'starter',
  storeCount: 1,
  // Starter with 1 store should have 16 imports, 19 exports, 16 flows
  // But this one has too many
  imports: Array.from({ length: 25 }, (_, i) => ({
    externalId: `import-${i + 1}`,
    connectionId: `conn-${i % 3 + 1}`,
    _id: `imp-${i + 1}`,
    name: `Import ${i + 1}`,
    type: 'import' as const
  })),
  exports: Array.from({ length: 30 }, (_, i) => ({
    externalId: `export-${i + 1}`,
    connectionId: `conn-${i % 3 + 1}`,
    _id: `exp-${i + 1}`,
    name: `Export ${i + 1}`,
    type: 'export' as const
  })),
  flows: Array.from({ length: 25 }, (_, i) => ({
    _id: `flow-${i + 1}`,
    name: `Flow ${i + 1}`,
    type: 'flow' as const
  }))
};

export const integrationWithOfflineConnections: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-integration-offline',
  connections: [
    { _id: 'conn-1', name: 'Connection 1', type: 'connection', offline: true },
    { _id: 'conn-2', name: 'Connection 2', type: 'connection', offline: false },
    { _id: 'conn-3', name: 'Connection 3', type: 'connection', offline: true }
  ],
  imports: [
    { externalId: 'import-1', connectionId: 'conn-1', _id: 'imp-1', name: 'Import 1', type: 'import' },
    { externalId: 'import-2', connectionId: 'conn-3', _id: 'imp-2', name: 'Import 2', type: 'import' }
  ],
  exports: [
    { externalId: 'export-1', connectionId: 'conn-1', _id: 'exp-1', name: 'Export 1', type: 'export' }
  ]
};

export const integrationWithMissingProperties: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-integration-missing-props',
  settings: {
    connectorEdition: 'premium',
    // Missing required properties
    commonresources: {
      // Missing netsuiteConnectionId, nsUtilImportAdaptorApiIdentifier, nsUtilImportAdaptorId
    },
    sections: [
      { id: 'section1' }, // Missing mode, shopInstallComplete
      { mode: 'active', shopInstallComplete: true } // Missing id
    ]
  }
};

export const integrationWithLicenseMismatch: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-integration-license-mismatch',
  licenseEdition: 'premium',
  settings: {
    ...validIntegrationSnapshot.settings,
    connectorEdition: 'standard' // Mismatch with license edition
  }
};

export const integrationStuckInUpdate: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-integration-stuck-update',
  updateInProgress: true
};

export const integrationWithMultipleIssues: IntegrationSnapshot = {
  id: 'test-integration-multiple-issues',
  email: 'problematic@example.com',
  userId: 'user-problematic',
  version: '1.51.0',
  storeCount: 2,
  licenseEdition: 'premium',
  updateInProgress: true,
  settings: {
    connectorEdition: 'standard', // License mismatch
    // Missing required properties
    commonresources: {},
    sections: [
      { id: 'section1' } // Missing properties
    ]
  },
  // Wrong resource counts for premium edition
  imports: [
    { externalId: 'import-1', connectionId: 'conn-offline', _id: 'imp-1', name: 'Import 1', type: 'import' }
  ],
  exports: [
    { externalId: 'export-1', connectionId: 'conn-offline', _id: 'exp-1', name: 'Export 1', type: 'export' }
  ],
  flows: [
    { _id: 'flow-1', name: 'Flow 1', type: 'flow' }
  ],
  connections: [
    { _id: 'conn-offline', name: 'Offline Connection', type: 'connection', offline: true }
  ]
};

export const validStarterIntegration: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-starter-integration',
  licenseEdition: 'starter',
  storeCount: 1,
  settings: {
    ...validIntegrationSnapshot.settings,
    connectorEdition: 'starter'
  },
  // Correct counts for starter edition: 16 imports, 19 exports, 16 flows
  imports: Array.from({ length: 16 }, (_, i) => ({
    externalId: `starter-import-${i + 1}`,
    connectionId: 'conn-1',
    _id: `starter-imp-${i + 1}`,
    name: `Starter Import ${i + 1}`,
    type: 'import' as const
  })),
  exports: Array.from({ length: 19 }, (_, i) => ({
    externalId: `starter-export-${i + 1}`,
    connectionId: 'conn-1',
    _id: `starter-exp-${i + 1}`,
    name: `Starter Export ${i + 1}`,
    type: 'export' as const
  })),
  flows: Array.from({ length: 16 }, (_, i) => ({
    _id: `starter-flow-${i + 1}`,
    name: `Starter Flow ${i + 1}`,
    type: 'flow' as const
  }))
};

export const validShopifyMarketsIntegration: IntegrationSnapshot = {
  ...validIntegrationSnapshot,
  id: 'test-shopifymarkets-integration',
  licenseEdition: 'shopifymarkets',
  storeCount: 1,
  settings: {
    ...validIntegrationSnapshot.settings,
    connectorEdition: 'shopifymarkets'
  },
  // Correct counts for shopify markets edition: 34 imports, 32 exports, 27 flows
  imports: Array.from({ length: 34 }, (_, i) => ({
    externalId: `markets-import-${i + 1}`,
    connectionId: 'conn-1',
    _id: `markets-imp-${i + 1}`,
    name: `Markets Import ${i + 1}`,
    type: 'import' as const
  })),
  exports: Array.from({ length: 32 }, (_, i) => ({
    externalId: `markets-export-${i + 1}`,
    connectionId: 'conn-1',
    _id: `markets-exp-${i + 1}`,
    name: `Markets Export ${i + 1}`,
    type: 'export' as const
  })),
  flows: Array.from({ length: 27 }, (_, i) => ({
    _id: `markets-flow-${i + 1}`,
    name: `Markets Flow ${i + 1}`,
    type: 'flow' as const
  }))
};

export const integrationSnapshots = {
  valid: validIntegrationSnapshot,
  missingResources: integrationWithMissingResources,
  duplicateResources: integrationWithDuplicateResources,
  offlineConnections: integrationWithOfflineConnections,
  missingProperties: integrationWithMissingProperties,
  licenseMismatch: integrationWithLicenseMismatch,
  stuckInUpdate: integrationStuckInUpdate,
  multipleIssues: integrationWithMultipleIssues,
  validStarter: validStarterIntegration,
  validShopifyMarkets: validShopifyMarketsIntegration
};
