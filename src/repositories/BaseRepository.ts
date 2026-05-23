import type { IDatabaseAdapter } from '../interfaces/db/IAdapter';
import type { FindOptions, IRepository } from '../interfaces/db/IRepository';

export class BaseRepository<T> implements IRepository<T> {
    constructor(
        protected readonly adapter: IDatabaseAdapter,
        protected readonly modelName: string
    ) {}

    async findById(id: string): Promise<T | null> {
        return this.adapter.findOne(this.modelName, { id }) as Promise<T | null>;
    }

    async findOne(filter: Partial<T>): Promise<T | null> {
        return this.adapter.findOne(
            this.modelName,
            filter as Record<string, unknown>
        ) as Promise<T | null>;
    }

    async findMany(filter: Partial<T>, options?: FindOptions): Promise<T[]> {
        return this.adapter.findMany(
            this.modelName,
            filter as Record<string, unknown>,
            options
        ) as Promise<T[]>;
    }

    async create(data: Partial<T>): Promise<T> {
        return this.adapter.create(
            this.modelName,
            data as Record<string, unknown>
        ) as Promise<T>;
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        return this.adapter.update(
            this.modelName,
            id,
            data as Record<string, unknown>
        ) as Promise<T | null>;
    }

    async delete(id: string): Promise<boolean> {
        return this.adapter.delete(this.modelName, id);
    }

    async count(filter: Partial<T> = {} as Partial<T>): Promise<number> {
        return this.adapter.count(this.modelName, filter as Record<string, unknown>);
    }

    async exists(filter: Partial<T>): Promise<boolean> {
        const result = await this.adapter.findOne(
            this.modelName,
            filter as Record<string, unknown>
        );
        return result !== null;
    }
}
