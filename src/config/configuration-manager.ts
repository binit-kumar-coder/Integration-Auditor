/**
 * Configuration Manager for Multi-Product, Multi-Version Support
 * Manages business rules across different products and versions
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProductVersionConfig {
  product: string;
  version: string;
  name: string;
  description: string;
  editionRequirements: any;
  productSpecificRules?: any;
  versionSpecificRules?: any;
  licenseValidation: any;
  requiredProperties: any;
  offlineConnectionRules?: any;
  updateProcessRules?: any;
  tolerances: any;
  metadata: any;
}

export interface ConfigurationLocation {
  product: string;
  version: string;
  configPath: string;
  configType: 'product-specific' | 'version-specific' | 'global';
}

export class ConfigurationManager {
  private configsDir: string;
  private loadedConfigs = new Map<string, ProductVersionConfig>();
  private availableConfigurations: ConfigurationLocation[] = [];

  constructor(configsDir: string = './config') {
    this.configsDir = configsDir;
  }

  /**
   * Initialize configuration manager and discover available configurations
   */
  async initialize(): Promise<void> {
    await this.discoverConfigurations();
    console.log(`✅ Configuration Manager initialized with ${this.availableConfigurations.length} available configurations`);
  }

  /**
   * Load business rules for specific product and version
   */
  async loadConfiguration(product: string, version: string): Promise<ProductVersionConfig> {
    const cacheKey = `${product}:${version}`;
    
    if (this.loadedConfigs.has(cacheKey)) {
      return this.loadedConfigs.get(cacheKey)!;
    }

    // Try different configuration location patterns
    const possiblePaths = [
      // Product-specific versioned config
      path.join(this.configsDir, 'products', product, `${version}-business-rules.json`),
      // Version-specific product config
      path.join(this.configsDir, 'versions', version, `${product}-business-rules.json`),
      // Global versioned config (fallback)
      path.join(this.configsDir, `${product}-${version}-business-rules.json`),
      // Legacy single config (fallback)
      path.join(this.configsDir, 'business-rules.json')
    ];

    let config: ProductVersionConfig | null = null;
    let usedPath = '';

    for (const configPath of possiblePaths) {
      try {
        const configContent = await fs.readFile(configPath, 'utf-8');
        config = JSON.parse(configContent) as ProductVersionConfig;
        usedPath = configPath;
        break;
      } catch (error) {
        // Try next path
        continue;
      }
    }

    if (!config) {
      throw new Error(`No configuration found for product: ${product}, version: ${version}`);
    }

    // Validate configuration structure
    this.validateConfiguration(config);

    this.loadedConfigs.set(cacheKey, config);
    console.log(`✅ Loaded configuration: ${product} v${version} from ${usedPath}`);
    
    return config;
  }

  /**
   * Get latest version for a product
   */
  async getLatestVersion(product: string): Promise<string> {
    const productConfigs = this.availableConfigurations
      .filter(config => config.product === product)
      .map(config => config.version)
      .sort(this.compareVersions)
      .reverse();

    if (productConfigs.length === 0) {
      throw new Error(`No configurations found for product: ${product}`);
    }

    return productConfigs[0];
  }

  /**
   * List all available products
   */
  getAvailableProducts(): string[] {
    const products = new Set(this.availableConfigurations.map(config => config.product));
    return Array.from(products).sort();
  }

  /**
   * List all available versions for a product
   */
  getAvailableVersions(product: string): string[] {
    return this.availableConfigurations
      .filter(config => config.product === product)
      .map(config => config.version)
      .sort(this.compareVersions)
      .reverse();
  }

  /**
   * Get configuration summary
   */
  getConfigurationSummary(): {
    totalConfigurations: number;
    products: { [product: string]: string[] };
    configurationTypes: { [type: string]: number };
  } {
    const products: { [product: string]: string[] } = {};
    const configTypes: { [type: string]: number } = {};

    for (const config of this.availableConfigurations) {
      if (!products[config.product]) {
        products[config.product] = [];
      }
      products[config.product].push(config.version);
      
      configTypes[config.configType] = (configTypes[config.configType] || 0) + 1;
    }

    return {
      totalConfigurations: this.availableConfigurations.length,
      products,
      configurationTypes: configTypes
    };
  }

  /**
   * Discover all available configurations
   */
  private async discoverConfigurations(): Promise<void> {
    this.availableConfigurations = [];

    // Discover product-specific configurations
    await this.discoverProductConfigs();
    
    // Discover version-specific configurations
    await this.discoverVersionConfigs();
    
    // Discover global configurations
    await this.discoverGlobalConfigs();
  }

  /**
   * Discover product-specific configurations
   */
  private async discoverProductConfigs(): Promise<void> {
    const productsDir = path.join(this.configsDir, 'products');
    
    try {
      const products = await fs.readdir(productsDir);
      
      for (const product of products) {
        const productDir = path.join(productsDir, product);
        const stat = await fs.stat(productDir);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(productDir);
          
          for (const file of files) {
            if (file.endsWith('-business-rules.json')) {
              const version = file.replace('-business-rules.json', '');
              this.availableConfigurations.push({
                product,
                version,
                configPath: path.join(productDir, file),
                configType: 'product-specific'
              });
            }
          }
        }
      }
    } catch (error) {
      // Products directory doesn't exist or is empty
    }
  }

  /**
   * Discover version-specific configurations
   */
  private async discoverVersionConfigs(): Promise<void> {
    const versionsDir = path.join(this.configsDir, 'versions');
    
    try {
      const versions = await fs.readdir(versionsDir);
      
      for (const version of versions) {
        const versionDir = path.join(versionsDir, version);
        const stat = await fs.stat(versionDir);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(versionDir);
          
          for (const file of files) {
            if (file.endsWith('-business-rules.json')) {
              const product = file.replace('-business-rules.json', '');
              this.availableConfigurations.push({
                product,
                version,
                configPath: path.join(versionDir, file),
                configType: 'version-specific'
              });
            }
          }
        }
      }
    } catch (error) {
      // Versions directory doesn't exist or is empty
    }
  }

  /**
   * Discover global configurations
   */
  private async discoverGlobalConfigs(): Promise<void> {
    try {
      const files = await fs.readdir(this.configsDir);
      
      for (const file of files) {
        if (file === 'business-rules.json') {
          // This is a global/legacy config - try to determine product and version
          try {
            const configPath = path.join(this.configsDir, file);
            const content = await fs.readFile(configPath, 'utf-8');
            const config = JSON.parse(content);
            
            const product = config.product || 'default';
            const version = config.version || 'latest';
            
            this.availableConfigurations.push({
              product,
              version,
              configPath,
              configType: 'global'
            });
          } catch (error) {
            // Skip invalid config files
          }
        }
      }
    } catch (error) {
      // Config directory doesn't exist
    }
  }

  /**
   * Validate configuration structure
   */
  private validateConfiguration(config: ProductVersionConfig): void {
    const requiredFields = ['editionRequirements', 'licenseValidation', 'requiredProperties'];
    
    for (const field of requiredFields) {
      if (!config[field as keyof ProductVersionConfig]) {
        throw new Error(`Invalid configuration: missing required field '${field}'`);
      }
    }

    // Validate edition requirements structure
    if (!config.editionRequirements || typeof config.editionRequirements !== 'object') {
      throw new Error('Invalid configuration: editionRequirements must be an object');
    }

    // Validate that each edition has required structure
    for (const [edition, requirements] of Object.entries(config.editionRequirements)) {
      if (edition === 'description') continue;
      
      const req = requirements as any;
      if (!req.importsPerStore || !req.exportsPerStore || !req.flowsPerStore) {
        throw new Error(`Invalid configuration: edition '${edition}' missing required count properties`);
      }
    }
  }

  /**
   * Compare semantic versions
   */
  private compareVersions(a: string, b: string): number {
    const aParts = a.split('.').map(Number);
    const bParts = b.split('.').map(Number);
    
    for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
      const aPart = aParts[i] || 0;
      const bPart = bParts[i] || 0;
      
      if (aPart < bPart) return -1;
      if (aPart > bPart) return 1;
    }
    
    return 0;
  }

  /**
   * Create a new configuration template
   */
  async createConfigurationTemplate(
    product: string,
    version: string,
    baseProduct?: string,
    baseVersion?: string
  ): Promise<void> {
    let template: Partial<ProductVersionConfig> = {
      product,
      version,
      name: `${product} Integration Business Rules`,
      description: `Business validation rules for ${product} integration v${version}`,
      
      editionRequirements: {
        description: `Resource requirements for ${product} integration by edition`,
        starter: {
          importsPerStore: 10,
          exportsPerStore: 10,
          flowsPerStore: 10,
          description: `Starter edition baseline for ${product}`,
          requiredImports: [],
          requiredExports: [],
          requiredFlows: []
        }
      },
      
      licenseValidation: {
        validEditions: ["starter", "premium"],
        maxSettingsSize: 1048576,
        productFamily: product
      },
      
      requiredProperties: {
        topLevel: ["settings", "version"],
        settingsLevel: ["connectorEdition"],
        sectionProperties: ["id", "mode"]
      },
      
      tolerances: {
        resourceCountTolerance: 0
      },
      
      metadata: {
        businessOwner: `${product} Integration Team`,
        technicalOwner: "Integration Development Team",
        lastReviewed: new Date().toISOString().split('T')[0],
        changeApprovalRequired: true
      }
    };

    // If base configuration provided, inherit from it
    if (baseProduct && baseVersion) {
      try {
        const baseConfig = await this.loadConfiguration(baseProduct, baseVersion);
        template = {
          ...baseConfig,
          ...template,
          editionRequirements: {
            ...baseConfig.editionRequirements,
            ...template.editionRequirements
          }
        };
        template.description += ` (based on ${baseProduct} v${baseVersion})`;
      } catch (error) {
        console.warn(`Could not load base configuration ${baseProduct}:${baseVersion}, using template`);
      }
    }

    // Determine save location (prefer product-specific)
    const productDir = path.join(this.configsDir, 'products', product);
    await fs.mkdir(productDir, { recursive: true });
    
    const configPath = path.join(productDir, `${version}-business-rules.json`);
    await fs.writeFile(configPath, JSON.stringify(template, null, 2));
    
    console.log(`✅ Created configuration template: ${configPath}`);
  }

  /**
   * Migrate configuration from one version to another
   */
  async migrateConfiguration(
    fromProduct: string,
    fromVersion: string,
    toProduct: string,
    toVersion: string,
    migrationRules?: any
  ): Promise<void> {
    const sourceConfig = await this.loadConfiguration(fromProduct, fromVersion);
    
    const migratedConfig: ProductVersionConfig = {
      ...sourceConfig,
      product: toProduct,
      version: toVersion,
      name: `${toProduct} Integration Business Rules v${toVersion}`,
      description: `Migrated from ${fromProduct} v${fromVersion}`,
      metadata: {
        ...sourceConfig.metadata,
        migratedFrom: `${fromProduct}:${fromVersion}`,
        migratedAt: new Date().toISOString(),
        migrationRules: migrationRules || 'direct-copy'
      }
    };

    // Apply migration rules if provided
    if (migrationRules) {
      this.applyMigrationRules(migratedConfig, migrationRules);
    }

    // Save migrated configuration
    const targetDir = path.join(this.configsDir, 'products', toProduct);
    await fs.mkdir(targetDir, { recursive: true });
    
    const targetPath = path.join(targetDir, `${toVersion}-business-rules.json`);
    await fs.writeFile(targetPath, JSON.stringify(migratedConfig, null, 2));
    
    console.log(`✅ Migrated configuration: ${fromProduct}:${fromVersion} → ${toProduct}:${toVersion}`);
  }

  /**
   * List all available configurations
   */
  async listConfigurations(): Promise<{
    products: string[];
    productVersions: { [product: string]: string[] };
    totalConfigurations: number;
  }> {
    if (this.availableConfigurations.length === 0) {
      await this.discoverConfigurations();
    }

    const products = this.getAvailableProducts();
    const productVersions: { [product: string]: string[] } = {};
    
    for (const product of products) {
      productVersions[product] = this.getAvailableVersions(product);
    }

    return {
      products,
      productVersions,
      totalConfigurations: this.availableConfigurations.length
    };
  }

  /**
   * Validate configuration compatibility
   */
  async validateCompatibility(product: string, version: string): Promise<{
    valid: boolean;
    issues: string[];
    warnings: string[];
  }> {
    const config = await this.loadConfiguration(product, version);
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check version-specific compatibility
    if (config.versionSpecificRules?.compatibilityRequirements) {
      const compat = config.versionSpecificRules.compatibilityRequirements;
      
      if (compat.minNetSuiteVersion) {
        // In production, would check against actual NetSuite version
        warnings.push(`Requires NetSuite ${compat.minNetSuiteVersion} or higher`);
      }
      
      if (compat.requiresAILicense && !this.hasAILicense(config)) {
        issues.push('Configuration requires AI license but license validation does not include AI requirements');
      }
    }

    // Check for breaking changes
    if (config.versionSpecificRules?.breakingChanges?.length > 0) {
      warnings.push(`Version ${version} contains breaking changes: ${config.versionSpecificRules.breakingChanges.join(', ')}`);
    }

    return {
      valid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Apply migration rules to configuration
   */
  private applyMigrationRules(config: ProductVersionConfig, migrationRules: any): void {
    // Apply resource count changes
    if (migrationRules.resourceCountChanges) {
      for (const [edition, changes] of Object.entries(migrationRules.resourceCountChanges)) {
        const editionReq = config.editionRequirements[edition];
        if (editionReq) {
          Object.assign(editionReq, changes);
        }
      }
    }

    // Apply new required properties
    if (migrationRules.newRequiredProperties) {
      config.requiredProperties = {
        ...config.requiredProperties,
        ...migrationRules.newRequiredProperties
      };
    }

    // Update tolerances
    if (migrationRules.toleranceChanges) {
      config.tolerances = {
        ...config.tolerances,
        ...migrationRules.toleranceChanges
      };
    }
  }

  /**
   * Check if configuration has AI license requirements
   */
  private hasAILicense(config: ProductVersionConfig): boolean {
    return config.licenseValidation?.requiresAILicense === true;
  }

  /**
   * Get configuration path for product and version
   */
  getConfigurationPath(product: string, version: string): string | null {
    const config = this.availableConfigurations.find(
      c => c.product === product && c.version === version
    );
    return config?.configPath || null;
  }

  /**
   * Reload specific configuration (for runtime updates)
   */
  async reloadConfiguration(product: string, version: string): Promise<ProductVersionConfig> {
    const cacheKey = `${product}:${version}`;
    this.loadedConfigs.delete(cacheKey); // Clear cache
    return this.loadConfiguration(product, version);
  }

}
