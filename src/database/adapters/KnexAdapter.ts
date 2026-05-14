// src/database/adapters/KnexAdapter.ts
import knex, { type Knex } from 'knex';
import path from 'path';
import type { IDatabaseAdapter, FindManyOptions } from '../../interfaces/db/IAdapter';
import type { ModelSchemaEntry } from '../../models/schemas';

interface TableDef {
    tableName: string;
    up: (table: Knex.CreateTableBuilder, db: Knex) => void;
}

export interface KnexAdapterOptions {
    skipMigrations?: boolean;
    migrationsDir?: string;
}

export class KnexAdapter implements IDatabaseAdapter {
    private readonly db: Knex;
    private readonly tableDefs: Map<string, TableDef> = new Map();
    private readonly skipMigrations: boolean;
    private readonly migrationsDir: string;

    constructor(config: Knex.Config, options: KnexAdapterOptions = {}) {
        this.db = knex(config);
        this.skipMigrations = options.skipMigrations ?? false;
        // this.migrationsDir = options.migrationsDir ?? path.join(__dirname, '../../../database/migrations');
        // Update the migrations directory path
        this.migrationsDir = options.migrationsDir ?? (() => {
            const isStagingOrProd =
                process.env.NODE_ENV === 'production' ||
                process.env.NODE_ENV === 'staging';
            const basePath = isStagingOrProd
                ? path.join(process.cwd(), 'dist/database/migrations')
                : path.join(__dirname, '../../../database/migrations');
            return basePath;
        })();
    }

    async connect(): Promise<void> {
        await this.db.raw('SELECT 1');
    }

    async disconnect(): Promise<void> {
        await this.db.destroy();
    }

    async isConnected(): Promise<boolean> {
        try {
            await this.db.raw('SELECT 1');
            return true;
        } catch {
            return false;
        }
    }

    registerModel(name: string, schema: unknown): void {
        const entry = schema as ModelSchemaEntry;
        if (!entry.sql) return;
        this.tableDefs.set(name, entry.sql as TableDef);
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
    async migrate(): Promise<void> {
        if (this.skipMigrations) {
            console.log('KnexAdapter :: migrations skipped (skipMigrations=true)');
            return;
        }

        const env = process.env['NODE_ENV'] ?? 'development';
        const autoMigrate = process.env['AUTO_MIGRATE']?.toLowerCase();

        const isMigrationCommand = process.argv.some(arg =>
            arg.includes('migrate') || arg.includes('run-migrations') || arg.includes('rollback')
        );

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
        } else {
            await this._knexMigrate();
        }
    }
    /**
     * Run migrations programmatically
     */
    async runMigrations(): Promise<string[]> {
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
    async rollbackLastBatch(): Promise<string[]> {
        const [, migrations] = await this.db.migrate.rollback({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
        });
        return migrations;
    }

    /**
     * Rollback all migrations
     */
    async rollbackAll(): Promise<string[]> {
        const [, migrations] = await this.db.migrate.rollback({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
        }, true); // true = rollback all
        return migrations;
    }

    /**
     * Rollback multiple batches (by calling rollback repeatedly)
     */
    async rollbackBatches(count: number): Promise<string[]> {
        let allMigrations: string[] = [];
        for (let i = 0; i < count; i++) {
            const [, migrations] = await this.db.migrate.rollback({
                directory: this.migrationsDir,
                tableName: 'knex_migrations',
            });
            if (!migrations || migrations.length === 0) break;
            allMigrations.push(...migrations);
        }
        return allMigrations;
    }

    /**
     * Get migration status
     */
    async getMigrationStatus(): Promise<{
        pending: number;
        completed: number;
        lastRun?: string;
        pendingMigrations?: string[];
    }> {
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
                pendingMigrations: pending.map((m: any) => m.file)
            };
        } catch (error) {
            // Table might not exist yet
            const [pending] = await this.db.migrate.list({
                directory: this.migrationsDir,
            });
            return {
                completed: 0,
                pending: pending.length,
                pendingMigrations: pending.map((m: any) => m.file)
            };
        }
    }

    private async _knexMigrate(): Promise<void> {
        console.log('KnexAdapter :: running versioned migrations...');
        const [, migrations] = await this.db.migrate.latest({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
            loadExtensions: ['.ts', '.js'],
        });

        if (migrations.length > 0) {
            console.log(`KnexAdapter :: ran ${migrations.length} migration(s):`, migrations);
        } else {
            console.log('KnexAdapter :: database already up to date');
        }
    }

    private async _devMigrate(): Promise<void> {
        console.log('KnexAdapter :: running test migrations...');
        for (const [, def] of this.tableDefs) {
            const exists = await this.db.schema.hasTable(def.tableName);
            if (!exists) {
                await this.db.schema.createTable(
                    def.tableName,
                    (table: Knex.CreateTableBuilder) => def.up(table, this.db)
                );
            }
        }
    }

    // ── camelCase ↔ snake_case ────────────────────────────────────────────────

    private toSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)] = value;
        }
        return result;
    }

    private toCamelCase(obj: Record<string, unknown>): Record<string, unknown> {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/_([a-z])/g, (_, l) => l.toUpperCase())] = value;
        }
        return result;
    }

    // ── CRUD ──────────────────────────────────────────────────────────────────

    async findOne(model: string, filter: Record<string, unknown>): Promise<unknown> {
        const row = await this.db(this.getTableName(model))
            .where(this.toSnakeCase(filter))
            .first();
        return row ? this.toCamelCase(row as Record<string, unknown>) : null;
    }

    async findMany(
        model: string,
        filter: Record<string, unknown>,
        options?: FindManyOptions
    ): Promise<unknown[]> {
        let query = this.db(this.getTableName(model)).where(this.toSnakeCase(filter));
        if (options?.limit) query = query.limit(options.limit);
        if (options?.skip) query = query.offset(options.skip);
        if (options?.sort) {
            for (const [key, order] of Object.entries(options.sort)) {
                query = query.orderBy(key, order === 1 ? 'asc' : 'desc');
            }
        }
        const rows = await query;
        return (rows as Record<string, unknown>[]).map(r => this.toCamelCase(r));
    }

    async create(model: string, data: Record<string, unknown>): Promise<unknown> {
        const rows = await this.db(this.getTableName(model))
            .insert(this.toSnakeCase(data))
            .returning('*');
        return this.toCamelCase(rows[0] as Record<string, unknown>);
    }

    async update(model: string, id: string, data: Record<string, unknown>): Promise<unknown> {
        const rows = await this.db(this.getTableName(model))
            .where({ id })
            .update(this.toSnakeCase(data))
            .returning('*');
        return rows[0] ? this.toCamelCase(rows[0] as Record<string, unknown>) : null;
    }

    async delete(model: string, id: string): Promise<boolean> {
        const count = await this.db(this.getTableName(model)).where({ id }).delete();
        return count > 0;
    }

    async withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T> {
        return this.db.transaction(fn as (trx: Knex.Transaction) => Promise<T>);
    }

    /** Expose the raw Knex instance — used by the migration CLI path. */
    getKnex(): Knex {
        return this.db;
    }

    private getTableName(model: string): string {
        const def = this.tableDefs.get(model);
        if (!def) throw new Error(`KnexAdapter: model "${model}" not registered`);
        return def.tableName;
    }

    /**
     * Get the underlying Knex instance
     */
    getClient(): Knex {
        return this.db;
    }
}
