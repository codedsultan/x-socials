import mongoose from 'mongoose';
import type { IDatabaseAdapter, FindManyOptions } from '../../interfaces/db/IAdapter';
import type { ModelSchemaEntry } from '../../models/schemas';

export class MongooseAdapter implements IDatabaseAdapter {
    private readonly models: Map<string, mongoose.Model<mongoose.Document>> = new Map();
    private connected = false;

    constructor(private readonly config: { uri: string; dbName?: string }) {}

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

    async isConnected(): Promise<boolean> {
        return this.connected && mongoose.connection.readyState === 1;
    }

    /**
     * schema arg is a ModelSchemaEntry — we use only the .mongo fragment.
     * Calling registerModel with no .mongo entry is a no-op (SQL-only models).
     */
    registerModel(name: string, schema: unknown): void {
        const entry = schema as ModelSchemaEntry;
        if (!entry.mongo) return; // SQL-only model, skip

        // Guard against OverwriteModelError on hot reloads / double registration
        if (mongoose.models[name]) {
            this.models.set(name, mongoose.models[name] as mongoose.Model<mongoose.Document>);
            return;
        }

        const mongooseSchema = new mongoose.Schema(
            entry.mongo as mongoose.SchemaDefinition,
            { timestamps: true }
        );
        const model = mongoose.model<mongoose.Document>(name, mongooseSchema);
        this.models.set(name, model);
    }

    /** No-op for Mongo — migrations are not applicable */
    async migrate(): Promise<void> {}

    private getModel(name: string): mongoose.Model<mongoose.Document> {
        const model = this.models.get(name);
        if (!model) throw new Error(`MongooseAdapter: model "${name}" not registered`);
        return model;
    }

    async findOne(model: string, filter: Record<string, unknown>): Promise<unknown> {
        return this.getModel(model).findOne(filter).lean();
    }

    async findMany(
        model: string,
        filter: Record<string, unknown>,
        options?: FindManyOptions
    ): Promise<unknown[]> {
        let query = this.getModel(model).find(filter);
        if (options?.limit)    query = query.limit(options.limit);
        if (options?.skip)     query = query.skip(options.skip);
        if (options?.sort)     query = query.sort(options.sort);
        if (options?.populate) query = query.populate(options.populate.join(' '));
        return query.lean();
    }

    async create(model: string, data: Record<string, unknown>): Promise<unknown> {
        const doc = await this.getModel(model).create(data);
        return doc.toObject();
    }

    async update(model: string, id: string, data: Record<string, unknown>): Promise<unknown> {
        return this.getModel(model)
            .findByIdAndUpdate(id, data, { new: true })
            .lean();
    }

    async delete(model: string, id: string): Promise<boolean> {
        const result = await this.getModel(model).findByIdAndDelete(id);
        return result !== null;
    }

    async withTransaction<T>(fn: (session: unknown) => Promise<T>): Promise<T> {
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
