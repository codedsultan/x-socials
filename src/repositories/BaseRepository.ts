import { IDatabaseAdapter } from "../interfaces/db/IAdapter";
import { FindOptions, IRepository } from "../interfaces/db/IRepository";


export class BaseRepository<T> implements IRepository<T> {
    constructor(
        protected adapter: IDatabaseAdapter,
        protected modelName: string
    ) { }

    async findById(id: string): Promise<T | null> {
        return this.adapter.findOne(this.modelName, { id });
    }

    async findOne(filter: Partial<T>): Promise<T | null> {
        return this.adapter.findOne(this.modelName, filter);
    }

    async findMany(filter: Partial<T>, options?: FindOptions): Promise<T[]> {
        return this.adapter.findMany(this.modelName, filter, options);
    }

    async create(data: Partial<T>): Promise<T> {
        return this.adapter.create(this.modelName, data);
    }

    async update(id: string, data: Partial<T>): Promise<T | null> {
        return this.adapter.update(this.modelName, id, data);
    }

    async delete(id: string): Promise<boolean> {
        return this.adapter.delete(this.modelName, id);
    }

    async exists(filter: Partial<T>): Promise<boolean> {
        const result = await this.adapter.findOne(this.modelName, filter);
        return result !== null;
    }
}
