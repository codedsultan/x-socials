export interface FindManyOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    populate?: string[];
}

export interface IDatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): Promise<boolean>;

    // Model registration — schema is adapter-specific (MongooseSchema or KnexTableDef)
    registerModel(name: string, schema: unknown): void;

    // Migration (SQL only — no-op on Mongo)
    migrate(): Promise<void>;

    // Generic CRUD
    findOne(model: string, filter: Record<string, unknown>): Promise<unknown>;
    findMany(model: string, filter: Record<string, unknown>, options?: FindManyOptions): Promise<unknown[]>;
    create(model: string, data: Record<string, unknown>): Promise<unknown>;
    update(model: string, id: string, data: Record<string, unknown>): Promise<unknown>;
    delete(model: string, id: string): Promise<boolean>;

    // Transactions — fn receives the adapter-native transaction handle
    withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T>;

    getClient(): unknown;  // Returns the underlying database client (Knex, Mongoose connection, etc.)

}
