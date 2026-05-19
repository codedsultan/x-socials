// src/database/core/DbResolver.ts
import type { DbType, ModelName } from '../../interfaces/core/db-types';
import type { IDatabaseAdapter } from '../../interfaces/db/IAdapter';
import type { IDatabaseConfig } from '../../interfaces/core/config';
import type { ModelSchemaEntry } from '../../models/schemas';
import { DbRegistry } from './DbRegistry';
import { MongooseAdapter } from '../adapters/MongooseAdapter';
import { KnexAdapter } from '../adapters/KnexAdapter';
import Logger from '../../logger';

/**
 * DbResolver owns the live adapter instances and wires them up.
 *
 * It is a plain class — constructed once in the composition root,
 * injected wherever needed.
 */
export class DbResolver {
    private readonly adapters: Map<DbType, IDatabaseAdapter> = new Map();
    private readonly logger = Logger.getInstance();

    constructor(
        configs: IDatabaseConfig,
        private readonly registry: DbRegistry,
        options?: { skipMigrations?: boolean }
    ) {
        const migrationOptions = { skipMigrations: options?.skipMigrations ?? false };

        if (configs.mongodb) this.adapters.set('mongodb', new MongooseAdapter(configs.mongodb));
        if (configs.postgres) this.adapters.set('postgres', new KnexAdapter(
            this.buildKnexConfig('postgres', configs.postgres),
            migrationOptions
        ));
        if (configs.mysql) this.adapters.set('mysql', new KnexAdapter(
            this.buildKnexConfig('mysql', configs.mysql),
            migrationOptions
        ));
        if (configs.sqlite) this.adapters.set('sqlite', new KnexAdapter(
            this.buildKnexConfig('sqlite', configs.sqlite),
            migrationOptions
        ));
    }

    // ── lifecycle ──────────────────────────────────────────────────────────

    async connectAll(): Promise<void> {
        await Promise.all([...this.adapters.values()].map(a => a.connect()));
    }

    async disconnectAll(): Promise<void> {
        await Promise.all([...this.adapters.values()].map(a => a.disconnect()));
    }

    /**
     * Register all model schemas with their respective adapters.
     * This MUST ALWAYS run - models need to be registered in memory.
     */
    async registerModels(schemas: Record<string, ModelSchemaEntry>): Promise<void> {
        this.logger.info(`[DbResolver] Registering models: ${Object.keys(schemas).join(', ')}`);

        for (const [modelName, schema] of Object.entries(schemas)) {
            const dbType = this.registry.getDbForModel(modelName);
            this.logger.info(`[DbResolver] Model "${modelName}" -> database: ${dbType}`);

            const adapter = this.adapters.get(dbType);
            if (!adapter) {
                throw new Error(
                    `No adapter configured for database type: ${dbType} (required by model: ${modelName}). ` +
                    `Configured adapters: ${[...this.adapters.keys()].join(', ')}`
                );
            }

            adapter.registerModel(modelName, schema);
            this.logger.info(`[DbResolver] ✓ Registered ${modelName} with ${dbType} adapter`);
        }

        this.logger.info(`[DbResolver] Successfully registered ${Object.keys(schemas).length} models`);

        // Log registration status for debugging
        this.logRegistrationStatus();
    }

    /**
     * Run migrations on all SQL adapters.
     * This can be skipped in production if migrations are run manually.
     */
    async runMigrations(): Promise<void> {
        this.logger.info(`[DbResolver] Running migrations on SQL adapters...`);

        let migrationCount = 0;
        for (const [dbType, adapter] of this.adapters) {
            if (adapter.constructor.name === 'KnexAdapter') {
                this.logger.info(`[DbResolver] Running migrations for ${dbType}`);
                await adapter.migrate();
                migrationCount++;
            }
        }

        this.logger.info(`[DbResolver] Migrations completed on ${migrationCount} database(s)`);
    }

    /**
     * Deprecated: Use registerModels() and runMigrations() separately.
     * Kept for backward compatibility.
     */
    async registerModelsAndMigrate(schemas: Record<string, ModelSchemaEntry>): Promise<void> {
        await this.registerModels(schemas);
        await this.runMigrations();
    }

    /**
     * Debug helper to log which models are registered with each adapter
     */
    private logRegistrationStatus(): void {
        if (process.env.NODE_ENV === 'production') return;

        for (const [dbType, adapter] of this.adapters) {
            if (adapter.constructor.name === 'KnexAdapter') {
                const knexAdapter = adapter as any;
                const registeredModels = knexAdapter.tableDefs ? [...knexAdapter.tableDefs.keys()] : [];
                this.logger.info(`[DbResolver] ${dbType} adapter has models: ${registeredModels.join(', ') || 'none'}`);
            } else if (adapter.constructor.name === 'MongooseAdapter') {
                const mongooseAdapter = adapter as any;
                const registeredModels = mongooseAdapter.models ? Object.keys(mongooseAdapter.models) : [];
                this.logger.info(`[DbResolver] ${dbType} adapter has models: ${registeredModels.join(', ') || 'none'}`);
            }
        }
    }

    // ── resolution ─────────────────────────────────────────────────────────

    getAdapterForModel(modelName: ModelName | string): IDatabaseAdapter {
        const dbType = this.registry.getDbForModel(modelName);
        const adapter = this.adapters.get(dbType);
        if (!adapter) {
            throw new Error(
                `DbResolver: no adapter configured for "${dbType}" ` +
                `(required by model "${modelName}"). ` +
                `Check your DB_MODE and connection config.`
            );
        }
        return adapter;
    }

    getAdapter(dbType: DbType): IDatabaseAdapter | undefined {
        return this.adapters.get(dbType);
    }

    getConfiguredTypes(): DbType[] {
        return [...this.adapters.keys()];
    }

    async healthCheck(): Promise<Record<string, boolean>> {
        const results: Record<string, boolean> = {};
        for (const [dbType, adapter] of this.adapters) {
            results[dbType] = await adapter.isConnected();
        }
        return results;
    }

    // ── knex config builder ────────────────────────────────────────────────

    private buildKnexConfig(
        _type: 'postgres' | 'mysql' | 'sqlite',
        cfg: NonNullable<IDatabaseConfig['postgres'] | IDatabaseConfig['mysql'] | IDatabaseConfig['sqlite']>
    ): import('knex').Knex.Config {
        if ('filename' in cfg) {
            // SQLite
            return {
                client: cfg.client ?? 'better-sqlite3',
                connection: { filename: cfg.filename },
                useNullAsDefault: true,
                pool: { min: cfg.poolMin ?? 1, max: cfg.poolMax ?? 1 },
            };
        }

        const c = cfg as NonNullable<IDatabaseConfig['postgres']>;
        const isMySQL = _type === 'mysql';

        return {
            client: c.client ?? (_type === 'postgres' ? 'pg' : 'mysql2'),
            connection: {
                host: c.host,
                port: c.port,
                database: c.database,
                user: c.user,
                password: c.password,
                ssl: 'ssl' in c ? (c.ssl ? { rejectUnauthorized: false } : false) : undefined,
                // MySQL keep-alive — prevents silent drops when the server's
                // wait_timeout closes idle connections (default is 8 hours but
                // many managed DBs set it to 60–120 s).
                ...(isMySQL ? {
                    enableKeepAlive: true,
                    keepAliveInitialDelay: 10_000, // ms — first keep-alive ping
                } : {}),
            },
            pool: {
                min: c.poolMin ?? 2,
                max: c.poolMax ?? 10,
                // Destroy connections that have been idle longer than
                // MySQL's wait_timeout (conservatively 55 s < typical 60 s minimum).
                // This ensures Knex retires the connection before the server drops it.
                ...(isMySQL ? { idleTimeoutMillis: 55_000 } : {}),
                // Validate the connection is still alive before handing it to a query.
                // For MySQL, a lightweight SELECT 1 confirms the socket is healthy.
                afterCreate: isMySQL
                    ? (conn: any, done: (err: Error | null, conn: any) => void) => {
                        conn.query('SELECT 1', (err: Error | null) => done(err, conn));
                    }
                    : undefined,
            },
            // Fail fast if the pool is exhausted — 30 s is generous.
            acquireConnectionTimeout: 30_000,
        };
    }
}