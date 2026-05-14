// src/config/database.config.ts
import type { IDatabaseConfig } from '../interfaces/core/config';
import type { DbType } from '../interfaces/core/db-types';
import { DbRegistry } from '../database/core/DbRegistry';
import { DbResolver } from '../database/core/DbResolver';
import { RepositoryFactory } from '../factories/RepositoryFactory';
import { ModelSchemas } from '../models/schemas';
import Logger from '../logger';
import ConfigService from './config.service';

export interface DatabaseContainer {
    registry: DbRegistry;
    resolver: DbResolver;
    factory: RepositoryFactory;
}

/**
 * Build database container with proper separation of concerns:
 * - ALWAYS registers models (required for the app to work)
 * - Optionally runs migrations (can be skipped in production)
 */
export async function buildDatabaseContainer(
    dbConfig: IDatabaseConfig,
    options?: { skipMigrations?: boolean }
): Promise<DatabaseContainer> {
    const logger = Logger.getInstance();
    const defaultDb = dbConfig.defaultDb as DbType;
    const dbMode = dbConfig.dbMode || 'split';

    logger.info(`Database :: mode=${dbMode}, defaultDb=${defaultDb}`);

    // Get model mapping from ConfigService
    const modelMapping = ConfigService.getModelMapping();

    // Create registry with model mapping
    const registry = new DbRegistry(modelMapping, defaultDb);
    if (dbMode === 'single') {
        registry.enableSingleMode(defaultDb);
        logger.info(`Database :: single-DB mode enabled → all models → ${defaultDb}`);
    }

    // Create resolver with options
    const resolver = new DbResolver(dbConfig as any, registry, options);
    const configured = resolver.getConfiguredTypes();
    logger.info(`Database :: connecting to [${configured.join(', ')}]`);
    await resolver.connectAll();
    logger.info('Database :: all adapters connected');

    // CRITICAL: ALWAYS register models - this is required for the app to work!
    // Models must be registered in memory regardless of migration settings
    logger.info('Database :: registering models (required)...');
    await resolver.registerModels(ModelSchemas);
    logger.info('Database :: ✓ models registered successfully');

    // Optionally run migrations (can be skipped in production if run manually)
    if (!options?.skipMigrations) {
        logger.info('Database :: running migrations...');
        await resolver.runMigrations();
        logger.info('Database :: ✓ migrations complete');
    } else {
        logger.info('Database :: skipping migrations (models still registered)');
    }

    // Create factory
    const factory = new RepositoryFactory(resolver);

    return { registry, resolver, factory };
}

export async function checkDatabaseHealth(resolver: DbResolver): Promise<Record<string, boolean>> {
    return resolver.healthCheck();
}