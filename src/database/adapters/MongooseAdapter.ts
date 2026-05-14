// src/database/adapters/MongooseAdapter.ts
import mongoose from 'mongoose';
import type { IDatabaseAdapter, FindManyOptions } from '../../interfaces/db/IAdapter';
import type { ModelSchemaEntry } from '../../models/schemas';

export class MongooseAdapter implements IDatabaseAdapter {
    private connection: typeof mongoose | null = null;
    private readonly models: Map<string, mongoose.Model<mongoose.Document>> = new Map();
    private connected = false;

    constructor(private readonly config: { uri: string; dbName?: string }) { }

    async connect(): Promise<void> {
        // Suppress deprecation warnings - check if mongoose has the method
        if (mongoose && typeof mongoose.set === 'function') {
            mongoose.set('strictQuery', true);
        }

        await mongoose.connect(this.config.uri, {
            dbName: this.config.dbName,
        });
        this.connected = true;
        this.connection = mongoose;
    }

    async disconnect(): Promise<void> {
        await mongoose.disconnect();
        this.connected = false;
        this.connection = null;
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
        if (mongoose.models && mongoose.models[name]) {
            this.models.set(name, mongoose.models[name] as mongoose.Model<mongoose.Document>);
            return;
        }

        // Create schema with options
        const mongooseSchema = new mongoose.Schema(
            entry.mongo as mongoose.SchemaDefinition,
            {
                timestamps: true,
                toJSON: { virtuals: true, getters: true },
                toObject: { virtuals: true, getters: true }
            }
        );

        // Add virtual id field that maps to _id (only if Schema has virtual method)
        if (mongooseSchema && typeof mongooseSchema.virtual === 'function') {
            mongooseSchema.virtual('id').get(function (this: any) {
                return this._id ? this._id.toString() : null;
            });
        }

        const model = mongoose.model<mongoose.Document>(name, mongooseSchema);
        this.models.set(name, model);
    }

    /** No-op for Mongo — migrations are not applicable */
    async migrate(): Promise<void> { }

    private getModel(name: string): mongoose.Model<mongoose.Document> {
        const model = this.models.get(name);
        if (!model) throw new Error(`MongooseAdapter: model "${name}" not registered`);
        return model;
    }

    async findOne(model: string, filter: Record<string, unknown>): Promise<unknown> {
        const doc = await this.getModel(model).findOne(filter).lean();
        if (!doc) return null;

        // Convert _id to id
        return {
            ...doc,
            id: doc._id?.toString(),
            _id: undefined
        };
    }

    async findMany(
        model: string,
        filter: Record<string, unknown>,
        options?: FindManyOptions
    ): Promise<unknown[]> {
        let query = this.getModel(model).find(filter);
        if (options?.limit) query = query.limit(options.limit);
        if (options?.skip) query = query.skip(options.skip);
        if (options?.sort) query = query.sort(options.sort);
        if (options?.populate) query = query.populate(options.populate.join(' '));

        const docs = await query.lean();

        // Convert _id to id for each document
        return docs.map(doc => ({
            ...doc,
            id: doc._id?.toString(),
            _id: undefined
        }));
    }

    async create(model: string, data: Record<string, unknown>): Promise<unknown> {
        // Remove id if present (let MongoDB generate _id)
        const { id, ...createData } = data;

        const doc = await this.getModel(model).create(createData);
        const obj = doc.toObject();

        // Return with id field
        return {
            ...obj,
            id: obj._id?.toString(),
            _id: undefined
        };
    }

    async update(model: string, id: string, data: Record<string, unknown>): Promise<unknown> {
        // Remove id and _id from update data
        const { id: _, _id, ...updateData } = data;

        const doc = await this.getModel(model)
            .findByIdAndUpdate(id, updateData, {
                new: true,
                runValidators: true,
                returnDocument: 'after'
            })
            .lean();

        if (!doc) return null;

        // Return with id field
        return {
            ...doc,
            id: doc._id?.toString(),
            _id: undefined
        };
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

    /**
     * Get the underlying Mongoose connection
     */
    getClient(): typeof mongoose | null {
        return this.connection;
    }
}