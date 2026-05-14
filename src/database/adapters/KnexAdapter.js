"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnexAdapter = void 0;
// src/database/adapters/KnexAdapter.ts
const knex_1 = __importDefault(require("knex"));
const path_1 = __importDefault(require("path"));
class KnexAdapter {
    db;
    tableDefs = new Map();
    skipMigrations;
    migrationsDir;
    constructor(config, options = {}) {
        this.db = (0, knex_1.default)(config);
        this.skipMigrations = options.skipMigrations ?? false;
        this.migrationsDir = options.migrationsDir ?? path_1.default.join(__dirname, '../../../database/migrations');
        // Update the migrations directory path
        // this.migrationsDir = options.migrationsDir ?? (() => {
        //     const isStagingOrProd =
        //         process.env.NODE_ENV === 'production' ||
        //         process.env.NODE_ENV === 'staging';
        //     const basePath = isStagingOrProd
        //         ? path.join(process.cwd(), 'dist/database/migrations')
        //         : path.join(__dirname, '../../../database/migrations');
        //     return basePath;
        // })();
    }
    async connect() {
        await this.db.raw('SELECT 1');
    }
    async disconnect() {
        await this.db.destroy();
    }
    async isConnected() {
        try {
            await this.db.raw('SELECT 1');
            return true;
        }
        catch {
            return false;
        }
    }
    registerModel(name, schema) {
        const entry = schema;
        if (!entry.sql)
            return;
        this.tableDefs.set(name, entry.sql);
    }
    /**
     * Run pending migrations with environment-aware behavior
     */
    // async migrate(): Promise<void> {
    //     // Skip if explicitly disabled
    //     if (this.skipMigrations) {
    //         console.log('KnexAdapter :: migrations skipped (skipMigrations=true)');
    //         return;
    //     }
    //     const env = process.env['NODE_ENV'] ?? 'development';
    //     // Check if we're in a migration CLI context
    //     const isMigrationCommand = process.argv.some(arg =>
    //         arg.includes('migrate') ||
    //         arg.includes('run-migrations') ||
    //         arg.includes('rollback')
    //     );
    //     // Skip auto-migrations when running migration CLI
    //     if (isMigrationCommand) {
    //         console.log('KnexAdapter :: skipping auto-migration (migration CLI detected)');
    //         return;
    //     }
    //     // In production, prefer explicit migrations via CLI
    //     if (env === 'production' && !process.env['AUTO_MIGRATE']) {
    //         console.log('KnexAdapter :: auto-migration disabled in production. Set AUTO_MIGRATE=true to enable.');
    //         return;
    //     }
    //     if (env === 'test') {
    //         await this._devMigrate();
    //     } else {
    //         await this._knexMigrate();
    //     }
    // }
    // src/database/adapters/KnexAdapter.ts (migration methods only)
    /**
     * Run pending migrations with environment-aware behavior
     */
    async migrate() {
        if (this.skipMigrations) {
            console.log('KnexAdapter :: migrations skipped (skipMigrations=true)');
            return;
        }
        const env = process.env['NODE_ENV'] ?? 'development';
        const autoMigrate = process.env['AUTO_MIGRATE']?.toLowerCase();
        const isMigrationCommand = process.argv.some(arg => arg.includes('migrate') || arg.includes('run-migrations') || arg.includes('rollback'));
        if (isMigrationCommand) {
            console.log('KnexAdapter :: skipping auto-migration (migration CLI detected)');
            return;
        }
        // Single condition: migrate only if explicitly true, or (not false and in dev/test)
        const shouldMigrate = autoMigrate === 'true' ||
            (autoMigrate !== 'false' && (env === 'development' || env === 'test'));
        if (!shouldMigrate) {
            console.log(`KnexAdapter :: auto-migration disabled (AUTO_MIGRATE=${autoMigrate || 'not set'}, env=${env})`);
            return;
        }
        if (env === 'test') {
            await this._devMigrate();
        }
        else {
            await this._knexMigrate();
        }
    }
    /**
     * Run migrations programmatically
     */
    async runMigrations() {
        const [, migrations] = await this.db.migrate.latest({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
            loadExtensions: ['.ts', '.js'],
        });
        return migrations;
    }
    /**
     * Rollback last migration batch
     */
    async rollbackLastBatch() {
        const [, migrations] = await this.db.migrate.rollback({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
        });
        return migrations;
    }
    /**
     * Rollback all migrations
     */
    async rollbackAll() {
        const [, migrations] = await this.db.migrate.rollback({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
        }, true); // true = rollback all
        return migrations;
    }
    /**
     * Rollback multiple batches (by calling rollback repeatedly)
     */
    async rollbackBatches(count) {
        let allMigrations = [];
        for (let i = 0; i < count; i++) {
            const [, migrations] = await this.db.migrate.rollback({
                directory: this.migrationsDir,
                tableName: 'knex_migrations',
            });
            if (!migrations || migrations.length === 0)
                break;
            allMigrations.push(...migrations);
        }
        return allMigrations;
    }
    /**
     * Get migration status
     */
    async getMigrationStatus() {
        try {
            // Get completed migrations
            const completed = await this.db('knex_migrations')
                .select('name', 'batch', 'migration_time')
                .orderBy('batch', 'desc')
                .orderBy('migration_time', 'desc');
            // Get pending migrations
            const [pending] = await this.db.migrate.list({
                directory: this.migrationsDir,
            });
            return {
                completed: completed.length,
                pending: pending.length,
                lastRun: completed[0]?.name,
                pendingMigrations: pending.map((m) => m.file)
            };
        }
        catch (error) {
            // Table might not exist yet
            const [pending] = await this.db.migrate.list({
                directory: this.migrationsDir,
            });
            return {
                completed: 0,
                pending: pending.length,
                pendingMigrations: pending.map((m) => m.file)
            };
        }
    }
    async _knexMigrate() {
        console.log('KnexAdapter :: running versioned migrations...');
        const [, migrations] = await this.db.migrate.latest({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
            loadExtensions: ['.ts', '.js'],
        });
        if (migrations.length > 0) {
            console.log(`KnexAdapter :: ran ${migrations.length} migration(s):`, migrations);
        }
        else {
            console.log('KnexAdapter :: database already up to date');
        }
    }
    async _devMigrate() {
        console.log('KnexAdapter :: running test migrations...');
        for (const [, def] of this.tableDefs) {
            const exists = await this.db.schema.hasTable(def.tableName);
            if (!exists) {
                await this.db.schema.createTable(def.tableName, (table) => def.up(table, this.db));
            }
        }
    }
    // ── camelCase ↔ snake_case ────────────────────────────────────────────────
    toSnakeCase(obj) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)] = value;
        }
        return result;
    }
    toCamelCase(obj) {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = value;
        }
        return result;
    }
    // ── CRUD ──────────────────────────────────────────────────────────────────
    async findOne(model, filter) {
        const row = await this.db(this.getTableName(model))
            .where(this.toSnakeCase(filter))
            .first();
        return row ? this.toCamelCase(row) : null;
    }
    async findMany(model, filter, options) {
        let query = this.db(this.getTableName(model)).where(this.toSnakeCase(filter));
        if (options?.limit)
            query = query.limit(options.limit);
        if (options?.skip)
            query = query.offset(options.skip);
        if (options?.sort) {
            for (const [key, order] of Object.entries(options.sort)) {
                query = query.orderBy(key, order === 1 ? 'asc' : 'desc');
            }
        }
        const rows = await query;
        return rows.map(r => this.toCamelCase(r));
    }
    async create(model, data) {
        const rows = await this.db(this.getTableName(model))
            .insert(this.toSnakeCase(data))
            .returning('*');
        return this.toCamelCase(rows[0]);
    }
    async update(model, id, data) {
        const rows = await this.db(this.getTableName(model))
            .where({ id })
            .update(this.toSnakeCase(data))
            .returning('*');
        return rows[0] ? this.toCamelCase(rows[0]) : null;
    }
    async delete(model, id) {
        const count = await this.db(this.getTableName(model)).where({ id }).delete();
        return count > 0;
    }
    async withTransaction(fn) {
        return this.db.transaction(fn);
    }
    /** Expose the raw Knex instance — used by the migration CLI path. */
    getKnex() {
        return this.db;
    }
    getTableName(model) {
        const def = this.tableDefs.get(model);
        if (!def)
            throw new Error(`KnexAdapter: model "${model}" not registered`);
        return def.tableName;
    }
    /**
     * Get the underlying Knex instance
     */
    getClient() {
        return this.db;
    }
}
exports.KnexAdapter = KnexAdapter;
//# sourceMappingURL=KnexAdapter.js.map