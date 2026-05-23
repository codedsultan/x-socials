import knex, { type Knex } from 'knex';
import path from 'path';
import type { IDatabaseAdapter, FindManyOptions } from '../../interfaces/db/IAdapter';
import type { ModelSchemaEntry } from '../../models/schemas';
import { generateSqlId } from '../../utils/uuid';

interface TableDef {
    tableName: string;
    up: (table: Knex.CreateTableBuilder, db: Knex) => void;
}

export interface KnexAdapterOptions {
    skipMigrations?: boolean;
    migrationsDir?: string;
}

/**
 * SQL clients that do not support RETURNING — need a post-insert SELECT.
 */
const NO_RETURNING_CLIENTS = new Set(['mysql', 'mysql2', 'sqlite3', 'better-sqlite3']);

/**
 * Models whose tables deliberately have no `updated_at` column.
 * These are write-once records — no mutable state after insert.
 * KnexAdapter.create() skips the updated_at injection for these models.
 * KnexAdapter.update() (called on these models) also skips it.
 */
const NO_UPDATED_AT_MODELS = new Set(['Token', 'Otp', 'Follow', 'Notification']);

export class KnexAdapter implements IDatabaseAdapter {
    private readonly db: Knex;
    private readonly tableDefs: Map<string, TableDef> = new Map();
    private readonly skipMigrations: boolean;
    private readonly migrationsDir: string;

    /** True when the underlying SQL client does not support RETURNING. */
    private readonly needsPostInsertSelect: boolean;

    constructor(config: Knex.Config, options: KnexAdapterOptions = {}) {
        this.db = knex(config);
        this.skipMigrations = options.skipMigrations ?? false;
        this.migrationsDir = options.migrationsDir ?? path.join(__dirname, '../../../database/migrations');
        this.needsPostInsertSelect = NO_RETURNING_CLIENTS.has(
            String(config.client ?? '')
        );
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

    async runMigrations(): Promise<string[]> {
        const [, migrations] = await this.db.migrate.latest({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
            loadExtensions: ['.ts', '.js'],
        });
        return migrations;
    }

    async rollbackLastBatch(): Promise<string[]> {
        const [, migrations] = await this.db.migrate.rollback({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
        });
        return migrations;
    }

    async rollbackAll(): Promise<string[]> {
        const [, migrations] = await this.db.migrate.rollback({
            directory: this.migrationsDir,
            tableName: 'knex_migrations',
        }, true);
        return migrations;
    }

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

    async getMigrationStatus(): Promise<{
        pending: number;
        completed: number;
        lastRun?: string;
        pendingMigrations?: string[];
    }> {
        try {
            const completed = await this.db('knex_migrations')
                .select('name', 'batch', 'migration_time')
                .orderBy('batch', 'desc')
                .orderBy('migration_time', 'desc');

            const [pending] = await this.db.migrate.list({
                directory: this.migrationsDir,
            });

            return {
                completed: completed.length,
                pending: pending.length,
                lastRun: completed[0]?.name,
                pendingMigrations: pending.map((m: any) => m.file),
            };
        } catch {
            const [pending] = await this.db.migrate.list({
                directory: this.migrationsDir,
            });
            return {
                completed: 0,
                pending: pending.length,
                pendingMigrations: pending.map((m: any) => m.file),
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
            const snakeKey = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
            // _id is MongoDB's PK convention; SQL tables use 'id'
            result[snakeKey === '_id' ? 'id' : snakeKey] = value;
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
        // let query = this.db(this.getTableName(model)).where(this.toSnakeCase(filter));
        let query = this.db(this.getTableName(model));

        const snakeFilter = this.toSnakeCase(filter);
        for (const [col, val] of Object.entries(snakeFilter)) {
            if (Array.isArray(val)) {
                query = query.whereIn(col, val as any[]);
            } else {
                query = query.where(col, val as any);
            }
        }

        // Keyset / cursor support — WHERE id > :after  or  WHERE id < :before
        const cursorCol = options?.cursorField
            ? options.cursorField.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)
            : 'id';

        if (options?.after) {
            query = query.where(cursorCol, '>', options.after);
        } else if (options?.before) {
            query = query.where(cursorCol, '<', options.before);
        }

        if (options?.limit) query = query.limit(options.limit);
        if (options?.skip) query = query.offset(options.skip);
        if (options?.sort) {
            for (const [key, order] of Object.entries(options.sort)) {
                const col = key.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
                query = query.orderBy(col, order === 1 ? 'asc' : 'desc');
            }
        }
        const rows = await query;
        return (rows as Record<string, unknown>[]).map(r => this.toCamelCase(r));
    }

    // async count(model: string, filter: Record<string, unknown>): Promise<number> {
    //     const row = await this.db(this.getTableName(model))
    //         .where(this.toSnakeCase(filter))
    //         .count('* as n')
    //         .first();
    //     return Number((row as any)?.n ?? 0);
    // }

    async count(model: string, filter: Record<string, unknown>): Promise<number> {
        let query = this.db(this.getTableName(model));
        const snakeFilter = this.toSnakeCase(filter);
        for (const [col, val] of Object.entries(snakeFilter)) {
            if (Array.isArray(val)) {
                query = (query as any).whereIn(col, val);
            } else {
                query = (query as any).where(col, val);
            }
        }
        const row = await (query as any).count('* as n').first();
        return Number((row as any)?.n ?? 0);
    }

    /**
     * Insert a row.
     *
     * Behaviour by client:
     * - PostgreSQL — uses RETURNING * (single round-trip).
     * - MySQL / SQLite — does not support RETURNING. We generate the ID
     *   ourselves (UUID v7) before the insert, then SELECT the row back.
     *   This keeps the interface identical for all callers.
     */
    async create(model: string, data: Record<string, unknown>): Promise<unknown> {
        const table = this.getTableName(model);
        const now = new Date();
        const hasUpdatedAt = !NO_UPDATED_AT_MODELS.has(model);

        // Always supply id (application-generated UUID v7) — removes dependency
        // on any database-level default which varies across PostgreSQL / MySQL / SQLite.
        const base: Record<string, unknown> = {
            id: generateSqlId(),
            created_at: now,
            ...(hasUpdatedAt ? { updated_at: now } : {}),
            ...data,            // caller data wins — allows explicit id override in tests
        };

        const payload = this.toSnakeCase(base);

        if (this.needsPostInsertSelect) {
            // MySQL / SQLite: INSERT then SELECT
            await this.db(table).insert(payload);
            const row = await this.db(table).where({ id: payload['id'] }).first();
            return this.toCamelCase(row as Record<string, unknown>);
        }

        // PostgreSQL: single round-trip with RETURNING
        const rows = await this.db(table).insert(payload).returning('*');
        return this.toCamelCase(rows[0] as Record<string, unknown>);
    }

    /**
     * Update a row by id.
     *
     * Always injects updated_at so the timestamp is maintained regardless of
     * whether a database trigger exists. Works on PostgreSQL, MySQL, and SQLite.
     *
     * Special keys:
     *   - `<field>Increment` (e.g. `likesCountIncrement: 1`) → emits a raw
     *     atomic SQL expression `likes_count = likes_count + 1`. This keeps
     *     counter increments safe under concurrent writes without transactions.
     */
    async update(model: string, id: string, data: Record<string, unknown>): Promise<unknown> {
        const table = this.getTableName(model);
        const hasUpdatedAt = !NO_UPDATED_AT_MODELS.has(model);

        // Separate raw increment directives from plain fields
        const incrementFields: Record<string, number> = {};
        const plainFields: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(data)) {
            if (key.endsWith('Increment') && typeof value === 'number') {
                // e.g. likesCountIncrement → likes_count
                const column = key
                    .slice(0, -'Increment'.length)
                    .replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);
                incrementFields[column] = value;
            } else {
                plainFields[key] = value;
            }
        }

        // Build the final update payload
        const payload: Record<string, unknown> = {
            ...this.toSnakeCase({
                ...plainFields,
                ...(hasUpdatedAt ? { updated_at: new Date() } : {}),
            }),
        };

        // Merge raw expressions for atomic counter increments
        for (const [column, delta] of Object.entries(incrementFields)) {
            payload[column] = this.db.raw(`?? + ?`, [column, delta]);
        }

        if (this.needsPostInsertSelect) {
            const count = await this.db(table).where({ id }).update(payload);
            if (count === 0) return null;
            const row = await this.db(table).where({ id }).first();
            return row ? this.toCamelCase(row as Record<string, unknown>) : null;
        }

        const rows = await this.db(table).where({ id }).update(payload).returning('*');
        return rows[0] ? this.toCamelCase(rows[0] as Record<string, unknown>) : null;
    }

    async delete(model: string, id: string): Promise<boolean> {
        const count = await this.db(this.getTableName(model)).where({ id }).delete();
        return count > 0;
    }

    async withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T> {
        return this.db.transaction(fn as (trx: Knex.Transaction) => Promise<T>);
    }

    getKnex(): Knex {
        return this.db;
    }

    getClient(): Knex {
        return this.db;
    }

    private getTableName(model: string): string {
        const def = this.tableDefs.get(model);
        if (!def) throw new Error(`KnexAdapter: model "${model}" not registered`);
        return def.tableName;
    }
}