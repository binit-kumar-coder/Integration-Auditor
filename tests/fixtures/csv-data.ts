/**
 * Test fixtures for CSV data
 */

export const csvHeaders = {
  integrations: ['_ID', 'EMAIL', '_USERID', 'VERSION', 'NUMSTORES', 'LICENSEEDITION', 'UPDATEINPROGRESS', 'SETTINGS'],
  imports: ['INTEGRATIONID', 'EXTERNALID', 'IMPORTID', 'IMPORTCONNECTIONID'],
  exports: ['INTEGRATIONID', 'EXTERNALID', 'EXPORTID', 'EXPORTCONNECTIONID'],
  flows: ['INTEGRATIONID', 'EXTERNALID', 'FLOWID'],
  connections: ['INTEGRATIONID', 'IACONNECTIONID', 'EXTERNALID', 'CONNECTIONOFFLINE']
};

export const sampleIntegrationsCSV = `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-001","user1@example.com","user-001","1.51.0","2","premium","false","{""connectorEdition"":""premium"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{""netsuiteConnectionId"":""conn-123""}}"
"test-002","user2@example.com","user-002","1.51.0","1","starter","true","{""connectorEdition"":""starter"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{}}"
"test-003","user3@example.com","user-003","1.51.0","3","standard","false","{""connectorEdition"":""premium"",""general"":{},""storemap"":[],""sections"":[],""commonresources"":{}}"`

export const sampleImportsCSV = `"INTEGRATIONID","EXTERNALID","IMPORTID","IMPORTCONNECTIONID"
"test-001","customer-import","imp-001","conn-001"
"test-001","product-import","imp-002","conn-002"
"test-002","order-import","imp-003","conn-003"
"test-003","inventory-import","imp-004","conn-004"
"test-003","pricing-import","imp-005","conn-005"`;

export const sampleExportsCSV = `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"
"test-001","order-export","exp-001","conn-001"
"test-001","fulfillment-export","exp-002","conn-002"
"test-002","inventory-export","exp-003","conn-003"
"test-003","customer-export","exp-004","conn-004"`;

export const sampleFlowsCSV = `"INTEGRATIONID","EXTERNALID","FLOWID"
"test-001","order-sync-flow","flow-001"
"test-001","inventory-sync-flow","flow-002"
"test-002","customer-sync-flow","flow-003"
"test-003","product-sync-flow","flow-004"`;

export const sampleConnectionsCSV = `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"
"test-001","conn-001","netsuite-prod","false"
"test-001","conn-002","shopify-store-1","false"
"test-002","conn-003","netsuite-sandbox","true"
"test-003","conn-004","shopify-store-2","false"
"test-003","conn-005","shopify-store-3","true"`;

export const malformedCSVData = {
  integrations: `"_ID","EMAIL","_USERID","VERSION"
"test-001","user1@example.com","user-001"
"test-002","user2@example.com","user-002","1.51.0","extra-column"`,
  
  imports: `"INTEGRATIONID","EXTERNALID"
"test-001","customer-import"
"invalid-json-in-next-line"
"test-002"`,
  
  exports: `"INTEGRATIONID","EXTERNALID","EXPORTID","EXPORTCONNECTIONID"
"test-001","order-export","exp-001","conn-001"
"test-001","fulfillment-export","exp-002","conn-002"
"test-002","inventory-export","exp-003"`, // Missing column
  
  flows: `"INTEGRATIONID","EXTERNALID","FLOWID"
"test-001","order-sync-flow","flow-001"
"test-002","customer-sync-flow",""`, // Empty flow ID
  
  connections: `"INTEGRATIONID","IACONNECTIONID","EXTERNALID","CONNECTIONOFFLINE"
"test-001","conn-001","netsuite-prod","invalid-boolean"
"test-002","conn-002","shopify-store","yes"`
};

export const largeDatasetCSV = {
  integrations: () => {
    const header = csvHeaders.integrations.map(h => `"${h}"`).join(',');
    const rows = Array.from({ length: 1000 }, (_, i) => {
      const id = `large-test-${String(i + 1).padStart(4, '0')}`;
      const email = `user${i + 1}@example.com`;
      const userId = `user-${String(i + 1).padStart(4, '0')}`;
      const version = '1.51.0';
      const storeCount = Math.floor(Math.random() * 5) + 1;
      const editions = ['starter', 'standard', 'premium', 'shopifymarkets'];
      const edition = editions[Math.floor(Math.random() * editions.length)];
      const updateInProgress = Math.random() < 0.1 ? 'true' : 'false';
      const settings = JSON.stringify({
        connectorEdition: edition,
        general: {},
        storemap: [],
        sections: [],
        commonresources: {}
      }).replace(/"/g, '""');
      
      return `"${id}","${email}","${userId}","${version}","${storeCount}","${edition}","${updateInProgress}","${settings}"`;
    });
    
    return [header, ...rows].join('\n');
  },
  
  imports: (integrationIds: string[]) => {
    const header = csvHeaders.imports.map(h => `"${h}"`).join(',');
    const rows: string[] = [];
    
    integrationIds.forEach(integrationId => {
      const importCount = Math.floor(Math.random() * 50) + 10;
      for (let i = 0; i < importCount; i++) {
        const externalId = `import-${integrationId}-${i + 1}`;
        const importId = `imp-${integrationId}-${i + 1}`;
        const connectionId = `conn-${integrationId}-${(i % 3) + 1}`;
        rows.push(`"${integrationId}","${externalId}","${importId}","${connectionId}"`);
      }
    });
    
    return [header, ...rows].join('\n');
  },
  
  exports: (integrationIds: string[]) => {
    const header = csvHeaders.exports.map(h => `"${h}"`).join(',');
    const rows: string[] = [];
    
    integrationIds.forEach(integrationId => {
      const exportCount = Math.floor(Math.random() * 40) + 15;
      for (let i = 0; i < exportCount; i++) {
        const externalId = `export-${integrationId}-${i + 1}`;
        const exportId = `exp-${integrationId}-${i + 1}`;
        const connectionId = `conn-${integrationId}-${(i % 3) + 1}`;
        rows.push(`"${integrationId}","${externalId}","${exportId}","${connectionId}"`);
      }
    });
    
    return [header, ...rows].join('\n');
  },
  
  flows: (integrationIds: string[]) => {
    const header = csvHeaders.flows.map(h => `"${h}"`).join(',');
    const rows: string[] = [];
    
    integrationIds.forEach(integrationId => {
      const flowCount = Math.floor(Math.random() * 30) + 10;
      for (let i = 0; i < flowCount; i++) {
        const externalId = `flow-${integrationId}-${i + 1}`;
        const flowId = `flow-${integrationId}-${i + 1}`;
        rows.push(`"${integrationId}","${externalId}","${flowId}"`);
      }
    });
    
    return [header, ...rows].join('\n');
  },
  
  connections: (integrationIds: string[]) => {
    const header = csvHeaders.connections.map(h => `"${h}"`).join(',');
    const rows: string[] = [];
    
    integrationIds.forEach(integrationId => {
      const connectionCount = Math.floor(Math.random() * 5) + 2;
      for (let i = 0; i < connectionCount; i++) {
        const connectionId = `conn-${integrationId}-${i + 1}`;
        const externalId = `connection-${integrationId}-${i + 1}`;
        const offline = Math.random() < 0.2 ? 'true' : 'false';
        rows.push(`"${integrationId}","${connectionId}","${externalId}","${offline}"`);
      }
    });
    
    return [header, ...rows].join('\n');
  }
};

export const edgeCaseCSVData = {
  // CSV with Unicode characters
  unicodeCSV: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-unicode","用户@例子.com","user-unicode","1.51.0","1","starter","false","{""connectorEdition"":""starter"",""name"":""测试集成""}"`,

  // CSV with very long values
  longValuesCSV: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-long","${'very-long-email'.repeat(100)}@example.com","user-long","1.51.0","1","starter","false","${JSON.stringify({ connectorEdition: 'starter', longField: 'x'.repeat(10000) }).replace(/"/g, '""')}"`,

  // CSV with special characters
  specialCharsCSV: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"
"test-special","user+special@ex-ample.co.uk","user_special-123","1.51.0","1","starter","false","{""connectorEdition"":""starter"",""special"":""!@#$%^&*()""}"`,

  // Empty CSV
  emptyCSV: `"_ID","EMAIL","_USERID","VERSION","NUMSTORES","LICENSEEDITION","UPDATEINPROGRESS","SETTINGS"`,

  // CSV with only headers
  headersOnlyCSV: csvHeaders.integrations.map(h => `"${h}"`).join(','),

  // CSV with missing required columns
  missingColumnsCSV: `"_ID","EMAIL","VERSION"
"test-missing","user@example.com","1.51.0"`
};

export const csvTestData = {
  sample: {
    integrations: sampleIntegrationsCSV,
    imports: sampleImportsCSV,
    exports: sampleExportsCSV,
    flows: sampleFlowsCSV,
    connections: sampleConnectionsCSV
  },
  malformed: malformedCSVData,
  large: largeDatasetCSV,
  edgeCases: edgeCaseCSVData,
  headers: csvHeaders
};
