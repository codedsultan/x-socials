export interface FindOptions {
    limit?: number;
    skip?: number;
    sort?: Record<string, 1 | -1>;
    populate?: string[];
}

export interface IRepository<T = unknown> {
    findById(id: string): Promise<T | null>;
    findOne(filter: Partial<T>): Promise<T | null>;
    findMany(filter: Partial<T>, options?: FindOptions): Promise<T[]>;
    create(data: Partial<T>): Promise<T>;
    update(id: string, data: Partial<T>): Promise<T | null>;
    delete(id: string): Promise<boolean>;
    exists(filter: Partial<T>): Promise<boolean>;
}
