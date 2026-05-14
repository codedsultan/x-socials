"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbResolver = void 0;
const MongooseAdapter_1 = require("../adapters/MongooseAdapter");
const KnexAdapter_1 = require("../adapters/KnexAdapter");
/**
 * DbResolver owns the live adapter instances and wires them up.
 *
 * It is a plain class — constructed once in the composition root,
 * injected wherever needed.
 */
class DbResolver {
    registry;
    adapters = new Map();
    constructor(configs, registry, options) {
        this.registry = registry;
        const migrationOptions = { skipMigrations: options?.skipMigrations ?? false };
        if (configs.mongodb)
            this.adapters.set('mongodb', new MongooseAdapter_1.MongooseAdapter(configs.mongodb));
        if (configs.postgres)
            this.adapters.set('postgres', new KnexAdapter_1.KnexAdapter(this.buildKnexConfig('postgres', configs.postgres), migrationOptions));
        if (configs.mysql)
            this.adapters.set('mysql', new KnexAdapter_1.KnexAdapter(this.buildKnexConfig('mysql', configs.mysql), migrationOptions));
        if (configs.sqlite)
            this.adapters.set('sqlite', new KnexAdapter_1.KnexAdapter(this.buildKnexConfig('sqlite', configs.sqlite), migrationOptions));
    }
    // ── lifecycle ──────────────────────────────────────────────────────────
    async connectAll() {
        await Promise.all([...this.adapters.values()].map(a => a.connect()));
    }
    async disconnectAll() {
        await Promise.all([...this.adapters.values()].map(a => a.disconnect()));
    }
    /**
     * Register all model schemas with their respective adapters,
     * then run migrations on SQL adapters.
     */
    async registerModelsAndMigrate(schemas) {
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
    getAdapterForModel(modelName) {
        const dbType = this.registry.getDbForModel(modelName);
        const adapter = this.adapters.get(dbType);
        if (!adapter) {
            throw new Error(`DbResolver: no adapter configured for "${dbType}" ` +
                `(required by model "${modelName}"). ` +
                `Check your DB_MODE and connection config.`);
        }
        return adapter;
    }
    getAdapter(dbType) {
        return this.adapters.get(dbType);
    }
    getConfiguredTypes() {
        return [...this.adapters.keys()];
    }
    async healthCheck() {
        const results = {};
        for (const [dbType, adapter] of this.adapters) {
            results[dbType] = await adapter.isConnected();
        }
        return results;
    }
    // ── knex config builder ────────────────────────────────────────────────
    buildKnexConfig(_type, cfg) {
        if ('filename' in cfg) {
            // SQLite
            return {
                client: cfg.client ?? 'sqlite3',
                connection: { filename: cfg.filename },
                useNullAsDefault: true,
                pool: { min: cfg.poolMin ?? 1, max: cfg.poolMax ?? 1 },
            };
        }
        // Postgres / MySQL
        const c = cfg;
        return {
            client: c.client ?? (_type === 'postgres' ? 'pg' : 'mysql2'),
            connection: {
                host: c.host,
                port: c.port,
                database: c.database,
                user: c.user,
                password: c.password,
                ssl: 'ssl' in c ? (c.ssl ? { rejectUnauthorized: false } : false) : undefined,
            },
            pool: { min: c.poolMin ?? 2, max: c.poolMax ?? 10 },
        };
    }
}
exports.DbResolver = DbResolver;
//# sourceMappingURL=DbResolver.js.map