"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MongooseAdapter = void 0;
// src/database/adapters/MongooseAdapter.ts
const mongoose_1 = __importDefault(require("mongoose"));
class MongooseAdapter {
    config;
    connection = null;
    models = new Map();
    connected = false;
    constructor(config) {
        this.config = config;
    }
    async connect() {
        // Suppress deprecation warnings - check if mongoose has the method
        if (mongoose_1.default && typeof mongoose_1.default.set === 'function') {
            mongoose_1.default.set('strictQuery', true);
        }
        await mongoose_1.default.connect(this.config.uri, {
            dbName: this.config.dbName,
        });
        this.connected = true;
        this.connection = mongoose_1.default;
    }
    async disconnect() {
        await mongoose_1.default.disconnect();
        this.connected = false;
        this.connection = null;
    }
    async isConnected() {
        return this.connected && mongoose_1.default.connection.readyState === 1;
    }
    /**
     * schema arg is a ModelSchemaEntry — we use only the .mongo fragment.
     * Calling registerModel with no .mongo entry is a no-op (SQL-only models).
     */
    registerModel(name, schema) {
        const entry = schema;
        if (!entry.mongo)
            return; // SQL-only model, skip
        // Guard against OverwriteModelError on hot reloads / double registration
        if (mongoose_1.default.models && mongoose_1.default.models[name]) {
            this.models.set(name, mongoose_1.default.models[name]);
            return;
        }
        // Create schema with options
        const mongooseSchema = new mongoose_1.default.Schema(entry.mongo, {
            timestamps: true,
            toJSON: { virtuals: true, getters: true },
            toObject: { virtuals: true, getters: true }
        });
        // Add virtual id field that maps to _id (only if Schema has virtual method)
        if (mongooseSchema && typeof mongooseSchema.virtual === 'function') {
            mongooseSchema.virtual('id').get(function () {
                return this._id ? this._id.toString() : null;
            });
        }
        const model = mongoose_1.default.model(name, mongooseSchema);
        this.models.set(name, model);
    }
    /** No-op for Mongo — migrations are not applicable */
    async migrate() { }
    getModel(name) {
        const model = this.models.get(name);
        if (!model)
            throw new Error(`MongooseAdapter: model "${name}" not registered`);
        return model;
    }
    async findOne(model, filter) {
        const doc = await this.getModel(model).findOne(filter).lean();
        if (!doc)
            return null;
        // Convert _id to id
        return {
            ...doc,
            id: doc._id?.toString(),
            _id: undefined
        };
    }
    async findMany(model, filter, options) {
        let query = this.getModel(model).find(filter);
        if (options?.limit)
            query = query.limit(options.limit);
        if (options?.skip)
            query = query.skip(options.skip);
        if (options?.sort)
            query = query.sort(options.sort);
        if (options?.populate)
            query = query.populate(options.populate.join(' '));
        const docs = await query.lean();
        // Convert _id to id for each document
        return docs.map(doc => ({
            ...doc,
            id: doc._id?.toString(),
            _id: undefined
        }));
    }
    async create(model, data) {
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
    async update(model, id, data) {
        // Remove id and _id from update data
        const { id: _, _id, ...updateData } = data;
        const doc = await this.getModel(model)
            .findByIdAndUpdate(id, updateData, {
            new: true,
            runValidators: true,
            returnDocument: 'after'
        })
            .lean();
        if (!doc)
            return null;
        // Return with id field
        return {
            ...doc,
            id: doc._id?.toString(),
            _id: undefined
        };
    }
    async delete(model, id) {
        const result = await this.getModel(model).findByIdAndDelete(id);
        return result !== null;
    }
    async withTransaction(fn) {
        const session = await mongoose_1.default.startSession();
        session.startTransaction();
        try {
            const result = await fn(session);
            await session.commitTransaction();
            return result;
        }
        catch (error) {
            await session.abortTransaction();
            throw error;
        }
        finally {
            session.endSession();
        }
    }
    /**
     * Get the underlying Mongoose connection
     */
    getClient() {
        return this.connection;
    }
}
exports.MongooseAdapter = MongooseAdapter;
//# sourceMappingURL=MongooseAdapter.js.map