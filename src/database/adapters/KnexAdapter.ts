import knex, { Knex } from 'knex';
import { IDatabaseAdapter } from '../../interfaces/db/IAdapter';

export class KnexAdapter implements IDatabaseAdapter {
    private db: Knex;
    private models: Map<string, string> = new Map(); // model name -> table name

    constructor(config: Knex.Config) {
        this.db = knex(config);
    }

    async connect(): Promise<void> {
        await this.db.raw('SELECT 1');
    }

    async disconnect(): Promise<void> {
        await this.db.destroy();
    }

    isConnected(): boolean {
        return !!(this.db && this.db.client?.pool);
    }

    registerModel(name: string, schema: any): void {
        // For SQL, schema defines table structure and constraints
        this.models.set(name, schema.tableName || name.toLowerCase());

        // Optional: auto-run migrations if schema has up/down methods
        if (schema.up) {
            this.db.schema.createTableIfNotExists(schema.tableName || name.toLowerCase(), (table) => {
                schema.up(table, this.db);
            }).catch(console.error);
        }
    }

    private getTableName(model: string): string {
        const table = this.models.get(model);
        if (!table) throw new Error(`Model ${model} not registered`);
        return table;
    }

    private toSnakeCase(obj: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)] = value;
        }
        return result;
    }

    private toCamelCase(obj: Record<string, any>): Record<string, any> {
        const result: Record<string, any> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
        }
        return result;
    }

    async findOne(model: string, filter: Record<string, any>): Promise<any> {
        const result = await this.db(this.getTableName(model))
            .where(this.toSnakeCase(filter))
            .first();
        return result ? this.toCamelCase(result) : null;
    }

    async findMany(model: string, filter: Record<string, any>, options?: any): Promise<any[]> {
        let query = this.db(this.getTableName(model)).where(this.toSnakeCase(filter));
        if (options?.limit) query = query.limit(options.limit);
        if (options?.skip) query = query.offset(options.skip);
        if (options?.sort) {
            Object.entries(options.sort).forEach(([key, order]) => {
                query = query.orderBy(key, order === 1 ? 'asc' : 'desc');
            });
        }
        const results = await query;
        return results.map(r => this.toCamelCase(r));
    }

    async create(model: string, data: Record<string, any>): Promise<any> {
        const [result] = await this.db(this.getTableName(model))
            .insert(this.toSnakeCase(data))
            .returning('*');
        return this.toCamelCase(result);
    }

    async update(model: string, id: string, data: Record<string, any>): Promise<any> {
        const [result] = await this.db(this.getTableName(model))
            .where({ id })
            .update(this.toSnakeCase(data))
            .returning('*');
        return result ? this.toCamelCase(result) : null;
    }

    async delete(model: string, id: string): Promise<boolean> {
        const count = await this.db(this.getTableName(model)).where({ id }).delete();
        return count > 0;
    }

    async withTransaction<T>(fn: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
        return this.db.transaction(fn);
    }
}