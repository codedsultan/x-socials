import type { IDatabaseConfig } from '../interfaces/core/config';
import type { DbType, ModelDbMapping } from '../interfaces/core/db-types';
import { DbRegistry }         from '../database/core/DbRegistry';
import { DbResolver }         from '../database/core/DbResolver';
import { RepositoryFactory }  from '../factories/RepositoryFactory';
import { ModelSchemas }       from '../models/schemas';
import Logger                 from '../logger';

/**
 * Model → database routing table.
 *
 * To move all models to one DB set DB_MODE=single in your environment.
 * To remap individual models change the entries here or drive from config.
 */
export const MODEL_DB_MAPPING: ModelDbMapping = {
    // SQL models
    User:  'postgres',
    Otp:   'postgres',
    Token: 'postgres',
    // Mongo models
    Post:    'mongodb',
    Comment: 'mongodb',
    Like:    'mongodb',
};

/**
 * DatabaseContainer holds the three core objects built during initialization.
 * It is returned from buildDatabaseContainer() and injected into the app.
 */
export interface DatabaseContainer {
    registry:   DbRegistry;
    resolver:   DbResolver;
    factory:    RepositoryFactory;
}

/**
 * Build and wire the entire database layer.
 *
 * Steps (in order):
 *   1. Determine default DB and single/split mode
 *   2. Build DbRegistry with routing table
 *   3. Build DbResolver — creates adapter instances
 *   4. Connect all adapters
 *   5. Register models + run migrations (single call, no duplication)
 *   6. Build RepositoryFactory
 *
 * Returns the wired container. Throws on connection or migration failure.
 */
export async function buildDatabaseContainer(
    dbConfig: IDatabaseConfig
): Promise<DatabaseContainer> {
    const logger = Logger.getInstance();

    const defaultDb = (dbConfig.defaultDb ?? 'mongodb') as DbType;
    const rawMode   = dbConfig.dbMode ?? process.env['DB_MODE'] ?? 'split';
    const dbMode    = (rawMode === 'single' ? 'single' : 'split') as 'split' | 'single';

    logger.info(`Database :: mode=${dbMode}, defaultDb=${defaultDb}`);

    // 1. Registry
    const registry = new DbRegistry(MODEL_DB_MAPPING, defaultDb);
    if (dbMode === 'single') {
        registry.enableSingleMode(defaultDb);
        logger.info(`Database :: single-DB mode enabled → all models → ${defaultDb}`);
    }

    // 2. Resolver (creates adapters from config)
    const resolver = new DbResolver(dbConfig, registry);

    // 3. Connect
    const configured = resolver.getConfiguredTypes();
    logger.info(`Database :: connecting to [${configured.join(', ')}]`);
    await resolver.connectAll();
    logger.info('Database :: all adapters connected');

    // 4. Register models + migrate (one call, no double registration)
    await resolver.registerModelsAndMigrate(ModelSchemas);
    logger.info('Database :: models registered and migrations complete');

    // 5. Factory
    const factory = new RepositoryFactory(resolver);

    return { registry, resolver, factory };
}

/**
 * Health check — delegates to resolver.
 */
export async function checkDatabaseHealth(
    resolver: DbResolver
): Promise<Record<string, boolean>> {
    return resolver.healthCheck();
}
