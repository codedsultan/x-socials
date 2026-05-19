export interface FindManyOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    populate?: string[];
    /** Cursor-based: only return docs/rows where cursorField > this opaque token */
    after?: string;
    /** Cursor-based: only return docs/rows where cursorField < this opaque token */
    before?: string;
    /** Which field drives cursor comparisons (defaults to 'id') */
    cursorField?: string;
}

export interface IDatabaseAdapter {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): Promise<boolean>;

    registerModel(name: string, schema: unknown): void;
    migrate(): Promise<void>;

    findOne(model: string, filter: Record<string, unknown>): Promise<unknown>;
    findMany(model: string, filter: Record<string, unknown>, options?: FindManyOptions): Promise<unknown[]>;

    /**
     * Return the total number of documents/rows matching filter.
     * Used by offset pagination to compute `total` and `totalPages`.
     */
    count(model: string, filter: Record<string, unknown>): Promise<number>;

    create(model: string, data: Record<string, unknown>): Promise<unknown>;
    update(model: string, id: string, data: Record<string, unknown>): Promise<unknown>;
    delete(model: string, id: string): Promise<boolean>;

    withTransaction<T>(fn: (trx: unknown) => Promise<T>): Promise<T>;
    getClient(): unknown;
}
