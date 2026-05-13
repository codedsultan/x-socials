import type { DbType, ModelName } from '../../interfaces/core/db-types';
import type { IDatabaseAdapter } from '../../interfaces/db/IAdapter';
import type { IDatabaseConfig } from '../../interfaces/core/config';
import type { ModelSchemaEntry } from '../../models/schemas';
import { DbRegistry }      from './DbRegistry';
import { MongooseAdapter } from '../adapters/MongooseAdapter';
import { KnexAdapter }     from '../adapters/KnexAdapter';

/**
 * DbResolver owns the live adapter instances and wires them up.
 *
 * It is a plain class — constructed once in the composition root,
 * injected wherever needed.
 */
export class DbResolver {
    private readonly adapters: Map<DbType, IDatabaseAdapter> = new Map();

    constructor(
        configs: IDatabaseConfig,
        private readonly registry: DbRegistry
    ) {
        if (configs.mongodb)  this.adapters.set('mongodb',  new MongooseAdapter(configs.mongodb));
        if (configs.postgres) this.adapters.set('postgres', new KnexAdapter(this.buildKnexConfig('postgres', configs.postgres)));
        if (configs.mysql)    this.adapters.set('mysql',    new KnexAdapter(this.buildKnexConfig('mysql', configs.mysql)));
        if (configs.sqlite)   this.adapters.set('sqlite',   new KnexAdapter(this.buildKnexConfig('sqlite', configs.sqlite)));
    }

    // ── lifecycle ──────────────────────────────────────────────────────────

    async connectAll(): Promise<void> {
        await Promise.all([...this.adapters.values()].map(a => a.connect()));
    }

    async disconnectAll(): Promise<void> {
        await Promise.all([...this.adapters.values()].map(a => a.disconnect()));
    }

    /**
     * Register all model schemas with their respective adapters,
     * then run migrations on SQL adapters.
     */
    async registerModelsAndMigrate(schemas: Record<string, ModelSchemaEntry>): Promise<void> {
        // Register each model with its target adapter only
        for (const [modelName, schema] of Object.entries(schemas)) {
            const dbType = this.registry.getDbForModel(modelName);
            const adapter = this.adapters.get(dbType);
            adapter?.registerModel(modelName, schema);
        }

        // Run migrations on all SQL adapters
        for (const adapter of this.adapters.values()) {
            await adapter.migrate();
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
        // Postgres / MySQL
        const c = cfg as NonNullable<IDatabaseConfig['postgres']>;
        return {
            client: c.client ?? (_type === 'postgres' ? 'pg' : 'mysql2'),
            connection: {
                host:     c.host,
                port:     c.port,
                database: c.database,
                user:     c.user,
                password: c.password,
                ssl:      'ssl' in c ? (c.ssl ? { rejectUnauthorized: false } : false) : undefined,
            },
            pool: { min: c.poolMin ?? 2, max: c.poolMax ?? 10 },
        };
    }
}
