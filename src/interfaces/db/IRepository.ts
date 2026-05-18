export interface FindOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    populate?: string[];
    /** Opaque cursor — only return records after this position */
    after?: string;
    /** Opaque cursor — only return records before this position */
    before?: string;
    /** Which field drives the cursor (defaults to 'id') */
    cursorField?: string;
}

export interface IRepository<T = unknown> {
    findById(id: string): Promise<T | null>;
    findOne(filter: Partial<T>): Promise<T | null>;
    findMany(filter: Partial<T>, options?: FindOptions): Promise<T[]>;
    count(filter: Partial<T>): Promise<number>;
    create(data: Partial<T>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    exists(filter: Partial<T>): Promise<boolean>;
}
