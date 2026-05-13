import knex, { type Knex } from 'knex';
import type { IDatabaseAdapter, FindManyOptions } from '../../interfaces/db/IAdapter';
import type { ModelSchemaEntry } from '../../models/schemas';

interface TableDef {
    tableName: string;
    up: (table: Knex.CreateTableBuilder, db: Knex) => void;
}

export class KnexAdapter implements IDatabaseAdapter {
    private readonly db: Knex;
    /** model name → table definition */
    private readonly tableDefs: Map<string, TableDef> = new Map();

    constructor(config: Knex.Config) {
        this.db = knex(config);
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

    /**
     * schema arg is a ModelSchemaEntry — we use only the .sql fragment.
     * Calling registerModel with no .sql entry is a no-op (Mongo-only models).
     * NO DDL is executed here — call migrate() separately at boot.
     */
    registerModel(name: string, schema: unknown): void {
        const entry = schema as ModelSchemaEntry;
        if (!entry.sql) return; // Mongo-only model, skip
        this.tableDefs.set(name, entry.sql as TableDef);
    }

    /**
     * Run CREATE TABLE IF NOT EXISTS for every registered model.
     * Called once at startup after all models are registered.
     */
    async migrate(): Promise<void> {
        for (const [, def] of this.tableDefs) {
            const exists = await this.db.schema.hasTable(def.tableName);
            if (!exists) {
                await this.db.schema.createTable(def.tableName, (table: Knex.CreateTableBuilder) => {
                    def.up(table, this.db);
                });
            }
        }
    }

    private getTableName(model: string): string {
        const def = this.tableDefs.get(model);
        if (!def) throw new Error(`KnexAdapter: model "${model}" not registered`);
        return def.tableName;
    }

    // ── camelCase ↔ snake_case ────────────────────────────────────────────

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

    // ── CRUD ──────────────────────────────────────────────────────────────

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
        if (options?.skip)  query = query.offset(options.skip);
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

    /** Expose the raw knex instance for advanced use (migrations tooling etc.) */
    getKnex(): Knex {
        return this.db;
    }
}
