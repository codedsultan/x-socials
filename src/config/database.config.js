"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDatabaseContainer = buildDatabaseContainer;
exports.checkDatabaseHealth = checkDatabaseHealth;
const DbRegistry_1 = require("../database/core/DbRegistry");
const DbResolver_1 = require("../database/core/DbResolver");
const RepositoryFactory_1 = require("../factories/RepositoryFactory");
const schemas_1 = require("../models/schemas");
const logger_1 = __importDefault(require("../logger"));
const config_service_1 = __importDefault(require("./config.service"));
/**
 * Build database container - NO CONFIG LOADING HERE
 * Just takes config and builds connections
 */
// export async function buildDatabaseContainer(
//     dbConfig: IDatabaseConfig
// ): Promise<DatabaseContainer> {
//     const logger = Logger.getInstance();
//     const defaultDb = dbConfig.defaultDb as DbType;
//     const dbMode = dbConfig.dbMode || 'split';
//     logger.info(`Database :: mode=${dbMode}, defaultDb=${defaultDb}`);
//     // Get model mapping from ConfigService
//     const modelMapping = ConfigService.getModelMapping();
//     // Create registry with model mapping
//     const registry = new DbRegistry(modelMapping, defaultDb);
//     if (dbMode === 'single') {
//         registry.enableSingleMode(defaultDb);
//         logger.info(`Database :: single-DB mode enabled → all models → ${defaultDb}`);
//     }
//     // Create resolver and connect
//     const resolver = new DbResolver(dbConfig as any, registry);
//     const configured = resolver.getConfiguredTypes();
//     logger.info(`Database :: connecting to [${configured.join(', ')}]`);
//     await resolver.connectAll();
//     logger.info('Database :: all adapters connected');
//     // Register models and migrate
//     await resolver.registerModelsAndMigrate(ModelSchemas);
//     logger.info('Database :: models registered and migrations complete');
//     // Create factory
//     const factory = new RepositoryFactory(resolver);
//     return { registry, resolver, factory };
// }
// src/config/database.config.ts
// src/config/database.config.ts
async function buildDatabaseContainer(dbConfig, options) {
    const logger = logger_1.default.getInstance();
    const defaultDb = dbConfig.defaultDb;
    const dbMode = dbConfig.dbMode || 'split';
    logger.info(`Database :: mode=${dbMode}, defaultDb=${defaultDb}`);
    // Get model mapping from ConfigService
    const modelMapping = config_service_1.default.getModelMapping();
    // Create registry with model mapping
    const registry = new DbRegistry_1.DbRegistry(modelMapping, defaultDb);
    if (dbMode === 'single') {
        registry.enableSingleMode(defaultDb);
        logger.info(`Database :: single-DB mode enabled → all models → ${defaultDb}`);
    }
    // Create resolver with options
    const resolver = new DbResolver_1.DbResolver(dbConfig, registry, options);
    const configured = resolver.getConfiguredTypes();
    logger.info(`Database :: connecting to [${configured.join(', ')}]`);
    await resolver.connectAll();
    logger.info('Database :: all adapters connected');
    // Only run migrations if not skipped
    if (!options?.skipMigrations) {
        await resolver.registerModelsAndMigrate(schemas_1.ModelSchemas);
        logger.info('Database :: models registered and migrations complete');
    }
    else {
        logger.info('Database :: skipping migrations');
    }
    // Create factory
    const factory = new RepositoryFactory_1.RepositoryFactory(resolver);
    return { registry, resolver, factory };
}
async function checkDatabaseHealth(resolver) {
    return resolver.healthCheck();
}
//# sourceMappingURL=database.config.js.map