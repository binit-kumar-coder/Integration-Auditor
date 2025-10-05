/**
 * Data-Driven Corruption Detector
 * ALL business logic loaded from JSON configuration files
 */

import { Engine, Rule } from 'json-rules-engine';
import * as fs from 'fs/promises';
import * as path from 'path';
import { IntegrationSnapshot } from '../types';
import { ConfigurationManager, ProductVersionConfig } from '../config/configuration-manager';

export interface BusinessConfig {
  editionRequirements: Record<string, {
    importsPerStore: number;
    exportsPerStore: number;
    flowsPerStore: number;
    description: string;
  }>;
  licenseValidation: {
    validEditions: string[];
    maxSettingsSize: number;
    caseSensitive: boolean;
  };
  requiredProperties: {
    topLevel: string[];
    settingsLevel: string[];
    commonresources: string[];
    sectionProperties: string[];
  };
  offlineConnectionRules: {
    detectOfflineWithActiveResources: boolean;
    crossReferenceFields: Record<string, string>;
    connectionOfflineValues: any[];
    severity: string;
  };
  updateProcessRules: {
    updateInProgressField: string;
    updateInProgressValues: any[];
    csvFieldName: string;
    severity: string;
  };
  tolerances: {
    resourceCountTolerance: number;
  };
}

export interface CorruptionEvent {
  type: string;
  params: {
    corruptionType: string;
    resourceType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    priority: number;
    fixAction: string;
    rollbackable: boolean;
    details?: any;
  };
  metadata?: {
    detectedAt: string;
    ruleId: string;
    businessLogic: any;
  };
}

export class DataDrivenCorruptionDetector {
  private engine: Engine;
  private businessConfig: ProductVersionConfig | null = null;
  private configManager: ConfigurationManager;
  private rulesLoaded = false;
  private currentProduct = '';
  private currentVersion = '';

  constructor() {
    this.engine = new Engine();
    this.configManager = new ConfigurationManager();
  }

  /**
   * Initialize with product and version
   */
  async initialize(
    product: string = 'shopify-netsuite',
    version: string = '1.51.0'
  ): Promise<void> {
    // Initialize configuration manager
    await this.configManager.initialize();
    
    // Load product-version specific configuration
    this.businessConfig = await this.configManager.loadConfiguration(product, version);
    this.currentProduct = product;
    this.currentVersion = version;
    
    console.log(`✅ Loaded configuration: ${product} v${version}`);
    
    // Register data-driven operators
    this.registerDataDrivenOperators();
    
    // Create rules from configuration
    this.createDataDrivenRules();
    
    this.rulesLoaded = true;
  }

  /**
   * Get available products and versions
   */
  async getAvailableConfigurations(): Promise<{
    products: string[];
    productVersions: { [product: string]: string[] };
    currentConfig: { product: string; version: string };
  }> {
    const configs = await this.configManager.listConfigurations();
    return {
      ...configs,
      currentConfig: {
        product: this.currentProduct,
        version: this.currentVersion
      }
    };
  }

  /**
   * Register operators that use business configuration data
   */
  private registerDataDrivenOperators(): void {
    if (!this.businessConfig) {
      throw new Error('Business config not loaded');
    }

    const config = this.businessConfig;
    
    // Debug: Log config structure
    console.log('✅ Config loaded for operators:', {
      hasOfflineRules: !!config.offlineConnectionRules,
      detectOffline: config.offlineConnectionRules?.detectOfflineWithActiveResources,
      hasEditionReqs: !!config.editionRequirements,
      editionCount: Object.keys(config.editionRequirements || {}).length
    });

    // Edition-based resource count validation - identifyDuplicateResources() logic
    this.engine.addOperator('hasIncorrectImportCount', (integration: any) => {
      return this.identifyDuplicateResources(integration, 'imports', config);
    });

    this.engine.addOperator('hasIncorrectExportCount', (integration: any) => {
      return this.identifyDuplicateResources(integration, 'exports', config);
    });

    this.engine.addOperator('hasIncorrectFlowCount', (integration: any) => {
      return this.identifyDuplicateResources(integration, 'flows', config);
    });

    // License validation using validateIAEditionAndLicense() logic
    this.engine.addOperator('hasLicenseEditionMismatch', (integration: any) => {
      return this.validateIAEditionAndLicense(integration, config);
    });

    // Missing properties validation using validateMissingProperties() logic
    this.engine.addOperator('hasMissingProperties', (integration: any) => {
      return this.validateMissingProperties(integration, config);
    });

    // Offline connection detection using getOfflineConnections() logic
    this.engine.addOperator('hasOfflineConnections', (integration: any) => {
      return this.getOfflineConnections(integration, config);
    });

    // Update process detection using inUpdateProcess() logic
    this.engine.addOperator('inUpdateProcess', (integration: any) => {
      return this.inUpdateProcess(integration, config);
    });
  }

  /**
   * Create data-driven rules directly from business configuration
   */
  private createDataDrivenRules(): void {
    // Create rules that use the data-driven operators
    const dataDrivenRules = [
      {
        conditions: { all: [{ fact: 'integration', operator: 'hasIncorrectImportCount', value: true }] },
        event: { type: 'corruption-detected', params: { corruptionType: 'incorrect-import-count', resourceType: 'import', severity: 'medium', priority: 5, fixAction: 'adjust-import-count' }}
      },
      {
        conditions: { all: [{ fact: 'integration', operator: 'hasIncorrectExportCount', value: true }] },
        event: { type: 'corruption-detected', params: { corruptionType: 'incorrect-export-count', resourceType: 'export', severity: 'medium', priority: 5, fixAction: 'adjust-export-count' }}
      },
      {
        conditions: { all: [{ fact: 'integration', operator: 'hasIncorrectFlowCount', value: true }] },
        event: { type: 'corruption-detected', params: { corruptionType: 'incorrect-flow-count', resourceType: 'flow', severity: 'medium', priority: 5, fixAction: 'adjust-flow-count' }}
      },
      {
        conditions: { all: [{ fact: 'integration', operator: 'hasLicenseEditionMismatch', value: true }] },
        event: { type: 'corruption-detected', params: { corruptionType: 'license-edition-mismatch', resourceType: 'setting', severity: 'medium', priority: 4, fixAction: 'fix-license-mismatch' }}
      },
      {
        conditions: { all: [{ fact: 'integration', operator: 'hasMissingProperties', value: true }] },
        event: { type: 'corruption-detected', params: { corruptionType: 'missing-properties', resourceType: 'setting', severity: 'high', priority: 7, fixAction: 'add-missing-properties' }}
      },
      {
        conditions: { all: [{ fact: 'integration', operator: 'hasOfflineConnections', value: true }] },
        event: { type: 'corruption-detected', params: { corruptionType: 'offline-connections', resourceType: 'connection', severity: 'high', priority: 6, fixAction: 'reconnect-connections' }}
      },
      {
        conditions: { all: [{ fact: 'integration', operator: 'inUpdateProcess', value: true }] },
        event: { type: 'corruption-detected', params: { corruptionType: 'stuck-in-update-process', resourceType: 'setting', severity: 'high', priority: 3, fixAction: 'clear-update-flag' }}
      }
    ];

    // Add each rule to the engine
    for (const ruleConfig of dataDrivenRules) {
      const rule = new Rule(ruleConfig);
      this.engine.addRule(rule);
    }

    console.log(`✅ Created ${dataDrivenRules.length} data-driven rules from business configuration`);
  }

  /**
   * identifyDuplicateResources() - Core duplicate resource detection function
   * Purpose: Identifies integrations with incorrect number of resources based on their edition and store count
   * 
   * Edition-Based Resource Validation:
   * - Starter Edition: 19 exports, 16 imports, 16 flows
   * - Standard Edition: 4 exports, 5 imports, 4 flows (additional to starter)  
   * - Premium Edition: 9 exports, 11 imports, 7 flows (additional to standard)
   * - Shopify Markets Edition: 2 imports (additional to premium)
   * 
   * Detection Logic:
   * - Expected count = store count × required resources per edition
   * - Missing Resources: Actual count < expected count
   * - Duplicate Resources: Actual count > expected count
   */
  private identifyDuplicateResources(
    integration: any, 
    resourceType: 'imports' | 'exports' | 'flows', 
    config: any
  ): boolean {
    const edition = integration.licenseEdition?.toLowerCase().trim();
    const storeCount = integration.storeCount || 1;
    
    // Get actual resources
    const actualResources = integration[resourceType] || [];
    const actualCount = actualResources.length;
    
    // Get edition requirements
    const requirements = config.editionRequirements[edition];
    if (!requirements) {
      console.warn(`⚠️  Unknown edition: ${edition} for integration ${integration.id}`);
      return false;
    }
    
    // Calculate expected count based on edition and store count
    const perStoreKey = `${resourceType}PerStore` as keyof typeof requirements;
    const expectedPerStore = requirements[perStoreKey] as number;
    const expectedCount = storeCount * expectedPerStore;
    
    // Apply tolerance (exact match required if tolerance = 0)
    const tolerance = config.tolerances?.resourceCountTolerance || 0;
    const difference = Math.abs(actualCount - expectedCount);
    
    if (difference > tolerance) {
      // Log the detection for debugging
      const status = actualCount > expectedCount ? 'DUPLICATE' : 'MISSING';
      console.log(`🔍 ${status} ${resourceType}: ${integration.id} (${edition}) - Expected: ${expectedCount}, Actual: ${actualCount}, Diff: ${actualCount - expectedCount}`);
      return true;
    }
    
    return false;
  }

  /**
   * getOfflineConnections() - Identifies connections that are marked as offline but still have associated imports/exports
   * 
   * Purpose: Identifies connections that are marked as offline but still have associated imports/exports
   * 
   * Detection Logic:
   * - Filters connections where CONNECTIONOFFLINE === 'true'
   * - Cross-references with existing integrations to ensure they're still active
   * - Groups offline connections by integration and connection ID
   * - Associates related import/export external IDs
   */
  private getOfflineConnections(integration: any, config: any): boolean {
    try {
      if (!config?.offlineConnectionRules?.detectOfflineWithActiveResources) {
        return false;
      }
      
      const connections = integration.connections || [];
      
      // Filter connections where CONNECTIONOFFLINE === 'true'
      const offlineConnections = connections.filter((conn: any) => {
        const offline = conn.offline;
        return offline === true || offline === 'true' || offline === '1';
      });
      
      if (offlineConnections.length === 0) return false;
      
      // Cross-reference with existing integrations to ensure they're still active
      const offlineConnectionIds = offlineConnections.map((conn: any) => conn._id);
      
      // Associate related import/export external IDs
      const activeImports = (integration.imports || []).filter((imp: any) => 
        imp.connectionId && offlineConnectionIds.includes(imp.connectionId)
      );
      
      const activeExports = (integration.exports || []).filter((exp: any) => 
        exp.connectionId && offlineConnectionIds.includes(exp.connectionId)
      );
      
      // Return true if offline connections have associated imports/exports
      const hasActiveResources = activeImports.length > 0 || activeExports.length > 0;
      
      if (hasActiveResources) {
        console.log(`🔍 OFFLINE CONNECTION: ${integration.id} has ${offlineConnections.length} offline connections with ${activeImports.length} imports + ${activeExports.length} exports`);
      }
      
      return hasActiveResources;
    } catch (error) {
      console.error(`Error in getOfflineConnections:`, error);
      return false;
    }
  }

  /**
   * validateIAEditionAndLicense() - Ensures integration edition matches license edition and validates license validity
   * 
   * Purpose: Ensures integration edition matches license edition and validates license validity
   * 
   * Detection Logic:
   * - Compares integration.SETTINGS.connectorEdition with integration.LICENSEEDITION
   * - Validates against allowed license types: ['starter', 'standard', 'premium', 'shopifymarkets']
   * - Skips integrations with settings > 1MB (data storage limitations)
   * 
   * Corruption Types Detected:
   * - License Mismatch: Integration edition ≠ License edition
   * - Invalid Licenses: License edition not in valid list
   */
  private validateIAEditionAndLicense(integration: any, config: any): boolean {
    try {
      // Get license and connector editions
      const licenseEdition = integration.licenseEdition?.toLowerCase().trim();
      const connectorEdition = integration.settings?.connectorEdition?.toLowerCase().trim();
      
      // Validate against allowed license types: ['starter', 'standard', 'premium', 'shopifymarkets']
      const validLicenses = ['starter', 'standard', 'premium', 'shopifymarkets'];
      if (licenseEdition && !validLicenses.includes(licenseEdition)) {
        console.log(`🔍 INVALID LICENSE: ${integration.id} has invalid license '${licenseEdition}'`);
        return true; // Invalid license edition
      }
      
      // Skip integrations with settings > 1MB (data storage limitations)
      const settingsSize = JSON.stringify(integration.settings || {}).length;
      if (settingsSize > 1048576) { // 1MB
        console.log(`⚠️  SKIPPING: ${integration.id} - Settings too large (${settingsSize} bytes > 1MB)`);
        return false; // Skip large settings
      }
      
      // License Mismatch: Integration edition ≠ License edition
      if (licenseEdition && connectorEdition && licenseEdition !== connectorEdition) {
        console.log(`🔍 LICENSE MISMATCH: ${integration.id} - License: '${licenseEdition}' vs Connector: '${connectorEdition}'`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error in validateIAEditionAndLicense:`, error);
      return false;
    }
  }

  /**
   * validateMissingProperties() - Ensures integrations have all required configuration properties
   * 
   * Purpose: Ensures integrations have all required configuration properties
   * 
   * Required Properties Checked:
   * - SETTINGS, SETTINGS.commonresources, SETTINGS.general, SETTINGS.storemap, SETTINGS.sections
   * - SETTINGS.connectorEdition, VERSION, UPDATEINPROGRESS
   * - SETTINGS.commonresources.netsuiteConnectionId, nsUtilImportAdaptorApiIdentifier, nsUtilImportAdaptorId
   * 
   * Section-Level Validation: For each section in SETTINGS.sections, validates:
   * - shopInstallComplete, id, mode
   */
  private validateMissingProperties(integration: any, config: any): boolean {
    try {
      const requiredProperties = [
        'settings',
        'settings.commonresources',
        'settings.general', 
        'settings.storemap',
        'settings.sections',
        'settings.connectorEdition',
        'version',
        'settings.commonresources.netsuiteConnectionId',
        'settings.commonresources.nsUtilImportAdaptorApiIdentifier',
        'settings.commonresources.nsUtilImportAdaptorId'
      ];
      
      const missingProperties: string[] = [];
      
      // Check all required properties
      for (const prop of requiredProperties) {
        if (!this.getNestedValue(integration, prop)) {
          missingProperties.push(prop);
        }
      }
      
      // Check UPDATEINPROGRESS (special case)
      if (integration.updateInProgress === undefined && integration.UPDATEINPROGRESS === undefined) {
        missingProperties.push('UPDATEINPROGRESS');
      }
      
      // Section-Level Validation: For each section in SETTINGS.sections, validates shopInstallComplete, id, mode
      const sections = integration.settings?.sections;
      if (Array.isArray(sections)) {
        const sectionProperties = ['shopInstallComplete', 'id', 'mode'];
        for (let i = 0; i < sections.length; i++) {
          const section = sections[i];
          for (const prop of sectionProperties) {
            if (section[prop] === undefined || section[prop] === null) {
              missingProperties.push(`settings.sections[${i}].${prop}`);
            }
          }
        }
      }
      
      if (missingProperties.length > 0) {
        console.log(`🔍 MISSING PROPERTIES: ${integration.id} missing ${missingProperties.length} properties: ${missingProperties.slice(0, 3).join(', ')}${missingProperties.length > 3 ? '...' : ''}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error in validateMissingProperties:`, error);
      return false;
    }
  }

  /**
   * inUpdateProcess() - Identifies integrations currently locked in update process
   * 
   * Purpose: Identifies integrations currently locked in update process
   * 
   * Detection Logic:
   * - Filters integrations where UPDATEINPROGRESS === 'true'
   * - These integrations may be stuck in an update state
   */
  private inUpdateProcess(integration: any, config: any): boolean {
    try {
      const updateField = config.updateProcessRules?.updateInProgressField || 'updateInProgress';
      const csvField = config.updateProcessRules?.csvFieldName || 'UPDATEINPROGRESS';
      
      // Check processed field
      const processedValue = integration[updateField];
      if (processedValue === true || processedValue === 'true' || processedValue === '1') {
        console.log(`🔍 STUCK UPDATE: ${integration.id} - updateInProgress = ${processedValue}`);
        return true;
      }
      
      // Check raw CSV field - UPDATEINPROGRESS === 'true'
      const rawValue = integration[csvField];
      if (rawValue === true || rawValue === 'true' || rawValue === '1') {
        console.log(`🔍 STUCK UPDATE: ${integration.id} - UPDATEINPROGRESS = ${rawValue}`);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Error in inUpdateProcess:`, error);
      return false;
    }
  }

  /**
   * Get complete resource list for an edition (with inheritance)
   */
  private getCompleteResourceList(edition: string, resourceType: 'imports' | 'exports' | 'flows', editionRequirements: any): string[] {
    const requirements = editionRequirements[edition];
    if (!requirements) return [];
    
    let completeList: string[] = [];
    
    // If this edition inherits from another, get parent resources first
    if (requirements.inheritsFrom) {
      completeList = this.getCompleteResourceList(requirements.inheritsFrom, resourceType, editionRequirements);
    }
    
    // Add base required resources if available
    const requiredKey = `required${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`;
    if (requirements[requiredKey]) {
      completeList.push(...requirements[requiredKey]);
    }
    
    // Add additional resources if available
    const additionalKey = `additional${resourceType.charAt(0).toUpperCase() + resourceType.slice(1)}`;
    if (requirements[additionalKey]) {
      completeList.push(...requirements[additionalKey]);
    }
    
    return [...new Set(completeList)]; // Remove duplicates
  }

  /**
   * Detect corruption using data-driven business logic
   */
  async detectCorruption(
    integration: IntegrationSnapshot,
    _manifest: any // Manifest now used for reference only
  ): Promise<{
    integrationId: string;
    email: string;
    corruptionEvents: CorruptionEvent[];
    overallSeverity: 'low' | 'medium' | 'high' | 'critical';
    businessAnalysis: any;
  }> {
    if (!this.rulesLoaded || !this.businessConfig) {
      throw new Error('System not initialized. Call initialize() first.');
    }

    const facts = {
      integration: this.prepareIntegrationFacts(integration),
      businessConfig: this.businessConfig,
      timestamp: new Date().toISOString()
    };

    const { events } = await this.engine.run(facts);
    
    const corruptionEvents: CorruptionEvent[] = events
      .filter(event => event.type === 'corruption-detected')
      .map(event => ({
        type: event.type,
        params: {
          corruptionType: event.params?.['corruptionType'] || 'unknown',
          resourceType: event.params?.['resourceType'] || 'unknown',
          severity: event.params?.['severity'] || 'medium',
          priority: event.params?.['priority'] || 5,
          fixAction: event.params?.['fixAction'] || 'manual-intervention',
          rollbackable: event.params?.['rollbackable'] || true,
          details: this.generateCorruptionDetails(event, integration)
        },
        metadata: {
          detectedAt: new Date().toISOString(),
          ruleId: event.params?.['ruleName'] || 'data-driven-rule',
          businessLogic: this.getBusinessLogicForCorruption(event.params?.['corruptionType'])
        }
      }));

    return {
      integrationId: integration.id,
      email: integration.email,
      corruptionEvents,
      overallSeverity: this.calculateOverallSeverity(corruptionEvents),
      businessAnalysis: this.generateBusinessAnalysis(integration, corruptionEvents)
    };
  }

  /**
   * Generate detailed corruption analysis with business context
   */
  private generateCorruptionDetails(event: any, integration: IntegrationSnapshot): any {
    const type = event.params?.['corruptionType'];
    
    switch (type) {
      case 'incorrect-import-count':
      case 'incorrect-export-count': 
      case 'incorrect-flow-count':
        return this.generateResourceCountDetails(type, integration);
      
      case 'license-edition-mismatch':
        return {
          licenseEdition: integration.licenseEdition,
          connectorEdition: integration.settings?.connectorEdition,
          validEditions: this.businessConfig?.licenseValidation.validEditions
        };
      
      case 'missing-properties':
        return this.generateMissingPropertiesDetails(integration);
      
      case 'offline-connections':
        return this.generateOfflineConnectionDetails(integration);
        
      case 'stuck-in-update-process':
        return {
          updateInProgress: integration.updateInProgress,
          integrationId: integration.id,
          status: 'stuck'
        };
      
      default:
        return {};
    }
  }

  /**
   * Generate resource count details with business context
   * Enhanced to properly identify Missing vs Duplicate resources
   */
  private generateResourceCountDetails(type: string, integration: IntegrationSnapshot): any {
    const edition = integration.licenseEdition?.toLowerCase().trim();
    const requirements = this.businessConfig?.editionRequirements[edition];
    
    if (!requirements) return {};
    
    const resourceType = type.replace('incorrect-', '').replace('-count', '');
    const perStoreKey = `${resourceType}sPerStore` as keyof typeof requirements;
    const expectedPerStore = requirements[perStoreKey];
    const expected = integration.storeCount * (expectedPerStore as number);
    
    let actual = 0;
    let actualResources: any[] = [];
    switch (resourceType) {
      case 'import': 
        actual = integration.imports.length; 
        actualResources = integration.imports;
        break;
      case 'export': 
        actual = integration.exports.length; 
        actualResources = integration.exports;
        break;
      case 'flow': 
        actual = integration.flows.length; 
        actualResources = integration.flows;
        break;
    }
    
    const difference = actual - expected;
    const status = actual > expected ? 'DUPLICATE_RESOURCES' : actual < expected ? 'MISSING_RESOURCES' : 'EXACT_MATCH';
    
    // Get edition breakdown for context
    const editionBreakdown = this.getEditionResourceBreakdown(edition);
    
    return {
      edition,
      storeCount: integration.storeCount,
      expectedPerStore,
      expectedTotal: expected,
      actualCount: actual,
      difference,
      status,
      resourceType,
      detectionFunction: 'identifyDuplicateResources()',
      businessRule: `${edition.toUpperCase()} edition requires ${expectedPerStore} ${resourceType}s per store`,
      editionBreakdown,
      affectedResources: actualResources.slice(0, 5).map(r => ({
        id: r._id || r.id,
        name: r.name || r.externalId,
        type: r.type
      })),
      remediationNeeded: difference !== 0 ? (difference > 0 ? `Remove ${difference} excess ${resourceType}s` : `Add ${Math.abs(difference)} missing ${resourceType}s`) : 'No action needed'
    };
  }

  /**
   * Get edition resource breakdown for context
   */
  private getEditionResourceBreakdown(edition: string): any {
    const editionMap: Record<string, any> = {
      'starter': { exports: 19, imports: 16, flows: 16, description: 'Baseline edition' },
      'standard': { exports: 23, imports: 21, flows: 20, description: 'Starter + 4 exports, 5 imports, 4 flows' },
      'premium': { exports: 32, imports: 32, flows: 27, description: 'Standard + 9 exports, 11 imports, 7 flows' },
      'shopifymarkets': { exports: 32, imports: 34, flows: 27, description: 'Premium + 2 imports' },
      'markets': { exports: 32, imports: 34, flows: 27, description: 'Alias for shopifymarkets' }
    };
    
    return editionMap[edition] || { description: 'Unknown edition' };
  }

  /**
   * Generate missing properties details
   */
  private generateMissingPropertiesDetails(integration: IntegrationSnapshot): any {
    const missing: string[] = [];
    const config = this.businessConfig!;
    
    // Check all required properties
    for (const prop of config.requiredProperties.topLevel) {
      if (!this.getNestedValue(integration, prop)) {
        missing.push(prop);
      }
    }
    
    for (const prop of config.requiredProperties.settingsLevel) {
      if (!this.getNestedValue(integration, `settings.${prop}`)) {
        missing.push(`settings.${prop}`);
      }
    }
    
    for (const prop of config.requiredProperties.commonresources) {
      if (!this.getNestedValue(integration, `settings.commonresources.${prop}`)) {
        missing.push(`settings.commonresources.${prop}`);
      }
    }
    
    return {
      missingProperties: missing,
      totalMissing: missing.length,
      criticalMissing: missing.filter(prop => prop.includes('commonresources')),
      businessImpact: missing.length > 5 ? 'high' : missing.length > 2 ? 'medium' : 'low'
    };
  }

  /**
   * Generate offline connection details
   */
  private generateOfflineConnectionDetails(integration: IntegrationSnapshot): any {
    const connections = integration.connections || [];
    const offlineConnections = connections.filter(conn => 
      this.businessConfig?.offlineConnectionRules.connectionOfflineValues.includes(conn.offline)
    );
    
    const offlineConnectionIds = offlineConnections.map(conn => conn._id);
    
    const affectedImports = integration.imports.filter(imp => 
      imp.connectionId && offlineConnectionIds.includes(imp.connectionId)
    );
    
    const affectedExports = integration.exports.filter(exp => 
      exp.connectionId && offlineConnectionIds.includes(exp.connectionId)
    );
    
    return {
      offlineConnections: offlineConnections.map(conn => ({
        id: conn._id,
        name: conn.name,
        type: conn.type
      })),
      affectedImports: affectedImports.length,
      affectedExports: affectedExports.length,
      totalAffectedResources: affectedImports.length + affectedExports.length,
      businessImpact: 'Data flow disruption for affected imports/exports'
    };
  }

  /**
   * Generate business analysis
   */
  private generateBusinessAnalysis(integration: IntegrationSnapshot, events: CorruptionEvent[]): any {
    const analysis = {
      integrationProfile: {
        id: integration.id,
        email: integration.email,
        edition: integration.licenseEdition,
        storeCount: integration.storeCount,
        resourceCounts: {
          imports: integration.imports.length,
          exports: integration.exports.length,
          flows: integration.flows.length,
          connections: integration.connections.length
        }
      },
      corruptionSummary: {
        totalEvents: events.length,
        severityDistribution: events.reduce((acc: any, event) => {
          acc[event.params.severity] = (acc[event.params.severity] || 0) + 1;
          return acc;
        }, {}),
        functionBreakdown: events.reduce((acc: any, event) => {
          const type = event.params.corruptionType;
          if (type.includes('count')) acc.resourceCount = (acc.resourceCount || 0) + 1;
          else if (type.includes('license')) acc.license = (acc.license || 0) + 1;
          else if (type.includes('properties')) acc.properties = (acc.properties || 0) + 1;
          else if (type.includes('offline')) acc.offline = (acc.offline || 0) + 1;
          else if (type.includes('update')) acc.update = (acc.update || 0) + 1;
          return acc;
        }, {})
      },
      businessImpact: this.assessBusinessImpact(events),
      recommendedActions: this.generateRecommendations(events)
    };
    
    return analysis;
  }

  /**
   * Assess business impact
   */
  private assessBusinessImpact(events: CorruptionEvent[]): any {
    const impact = {
      dataFlow: events.filter(e => e.params.corruptionType.includes('count')).length,
      configuration: events.filter(e => e.params.corruptionType.includes('properties') || e.params.corruptionType.includes('license')).length,
      operations: events.filter(e => e.params.corruptionType.includes('offline') || e.params.corruptionType.includes('update')).length,
      overall: 'low'
    };
    
    if (impact.operations > 0) impact.overall = 'critical';
    else if (impact.dataFlow > 10) impact.overall = 'high';
    else if (impact.configuration > 5) impact.overall = 'medium';
    
    return impact;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(events: CorruptionEvent[]): string[] {
    const recommendations: string[] = [];
    
    const hasResourceIssues = events.some(e => e.params.corruptionType.includes('count'));
    const hasConfigIssues = events.some(e => e.params.corruptionType.includes('properties'));
    const hasOperationalIssues = events.some(e => e.params.corruptionType.includes('offline') || e.params.corruptionType.includes('update'));
    
    if (hasOperationalIssues) {
      recommendations.push('IMMEDIATE: Address operational issues (offline connections, stuck updates)');
    }
    
    if (hasResourceIssues) {
      recommendations.push('PLANNED: Execute resource count adjustments during maintenance window');
    }
    
    if (hasConfigIssues) {
      recommendations.push('ONGOING: Fix configuration properties and license mismatches');
    }
    
    return recommendations;
  }

  /**
   * Calculate overall severity
   */
  private calculateOverallSeverity(events: CorruptionEvent[]): 'low' | 'medium' | 'high' | 'critical' {
    if (events.length === 0) return 'low';
    
    const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
    const maxSeverity = Math.max(...events.map(event => severityLevels[event.params.severity]));
    
    const severityMap = { 1: 'low' as const, 2: 'medium' as const, 3: 'high' as const, 4: 'critical' as const };
    return severityMap[maxSeverity as keyof typeof severityMap];
  }

  /**
   * Get business logic explanation for corruption type
   */
  private getBusinessLogicForCorruption(corruptionType: string): any {
    switch (corruptionType) {
      case 'incorrect-import-count':
      case 'incorrect-export-count':
      case 'incorrect-flow-count':
        return {
          source: 'config/business-rules.json',
          section: 'editionRequirements',
          logic: 'expectedCount = storeCount × editionRequirement',
          modifiable: 'Business users can modify edition requirements'
        };
      
      default:
        return {
          source: 'config/business-rules.json',
          modifiable: 'Business users can modify validation rules'
        };
    }
  }

  /**
   * Prepare integration facts
   */
  private prepareIntegrationFacts(integration: IntegrationSnapshot): any {
    return {
      id: integration.id,
      email: integration.email,
      licenseEdition: integration.licenseEdition,
      storeCount: integration.storeCount,
      updateInProgress: integration.updateInProgress,
      settings: integration.settings,
      imports: integration.imports,
      exports: integration.exports,
      flows: integration.flows,
      connections: integration.connections
    };
  }

  /**
   * Get nested value helper
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Get business configuration (for external access)
   */
  getBusinessConfig(): ProductVersionConfig | null {
    return this.businessConfig;
  }

  /**
   * Switch to different product/version configuration
   */
  async switchConfiguration(product: string, version: string): Promise<void> {
    await this.initialize(product, version);
    console.log(`✅ Switched to configuration: ${product} v${version}`);
  }

  /**
   * Reload business configuration (for runtime updates)
   */
  async reloadBusinessConfig(product?: string, version?: string): Promise<void> {
    const targetProduct = product || this.currentProduct;
    const targetVersion = version || this.currentVersion;
    
    await this.switchConfiguration(targetProduct, targetVersion);
    console.log(`✅ Business configuration reloaded: ${targetProduct} v${targetVersion}`);
  }
}
