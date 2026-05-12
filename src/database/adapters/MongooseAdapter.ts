// src/adapters/MongooseAdapter.ts
import mongoose from 'mongoose';
import { IDatabaseAdapter } from '../../interfaces/db/IAdapter';


export class MongooseAdapter implements IDatabaseAdapter {
    private models: Map<string, mongoose.Model<any>> = new Map();
    private connected = false;

    constructor(private config: { uri: string; dbName?: string }) { }

    async connect(): Promise<void> {
        await mongoose.connect(this.config.uri, {
            dbName: this.config.dbName,
        });
        this.connected = true;
    }

    async disconnect(): Promise<void> {
        await mongoose.disconnect();
        this.connected = false;
    }

    isConnected(): boolean {
        return this.connected && mongoose.connection.readyState === 1;
    }

    registerModel(name: string, schema: any): void {
        const mongooseSchema = new mongoose.Schema(schema, { timestamps: true });
        const model = mongoose.model(name, mongooseSchema);
        this.models.set(name, model);
    }

    private getModel(name: string): mongoose.Model<any> {
        const model = this.models.get(name);
        if (!model) throw new Error(`Model ${name} not registered`);
        return model;
    }

    async findOne(model: string, filter: Record<string, any>): Promise<any> {
        return this.getModel(model).findOne(filter).lean();
    }

    async findMany(model: string, filter: Record<string, any>, options?: any): Promise<any[]> {
        let query = this.getModel(model).find(filter);
        if (options?.limit) query = query.limit(options.limit);
        if (options?.skip) query = query.skip(options.skip);
        if (options?.sort) query = query.sort(options.sort);
        if (options?.populate) query = query.populate(options.populate);
        return query.lean();
    }

    async create(model: string, data: Record<string, any>): Promise<any> {
        const Model = this.getModel(model);
        const saved = await Model.create(data);
        return saved.toObject();
    }

    async update(model: string, id: string, data: Record<string, any>): Promise<any> {
        return this.getModel(model)
            .findByIdAndUpdate(id, data, { new: true })
            .lean();
    }

    async delete(model: string, id: string): Promise<boolean> {
        const result = await this.getModel(model).findByIdAndDelete(id);
        return result !== null;
    }

    async withTransaction<T>(fn: (session: any) => Promise<T>): Promise<T> {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
            const result = await fn(session);
            await session.commitTransaction();
            return result;
        } catch (error) {
            await session.abortTransaction();
            throw error;
        } finally {
            session.endSession();
        }
    }
}

