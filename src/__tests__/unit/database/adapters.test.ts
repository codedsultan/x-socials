import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── MongooseAdapter ──────────────────────────────────────────────────────────
// vi.mock is hoisted — do NOT reference variables declared in this file.
// Use inline factory functions only.

vi.mock('mongoose', () => {
    // Must be inline — cannot reference outer variables due to hoisting
    const mockModel = {
        findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: '1', title: 'hello' }) }),
        find: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnThis(), skip: vi.fn().mockReturnThis(), sort: vi.fn().mockReturnThis(), populate: vi.fn().mockReturnThis(), lean: vi.fn().mockResolvedValue([]) }),
        create: vi.fn().mockResolvedValue({ toObject: vi.fn().mockReturnValue({ _id: '1' }) }),
        findByIdAndUpdate: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: '1' }) }),
        findByIdAndDelete: vi.fn().mockResolvedValue({ _id: '1' }),
    };

    // Schema must be a proper class (constructable) — use function syntax
    function Schema(_def: unknown, _opts?: unknown) { }
    Schema.prototype = {};

    return {
        default: {
            connect: vi.fn().mockResolvedValue(undefined),
            disconnect: vi.fn().mockResolvedValue(undefined),
            connection: { readyState: 1 },
            Schema,
            model: vi.fn().mockReturnValue(mockModel),
            models: {},
            startSession: vi.fn().mockResolvedValue({
                startTransaction: vi.fn(),
                commitTransaction: vi.fn().mockResolvedValue(undefined),
                abortTransaction: vi.fn().mockResolvedValue(undefined),
                endSession: vi.fn(),
            }),
        },
    };
});

vi.mock('knex', () => {
    const mockKnexInstance = {
        raw: vi.fn().mockResolvedValue(undefined),
        destroy: vi.fn().mockResolvedValue(undefined),
        schema: {
            hasTable: vi.fn().mockResolvedValue(false),
            createTable: vi.fn().mockImplementation(
                (_name: string, cb: (t: unknown) => void) => {
                    const b = {
                        uuid: vi.fn().mockReturnThis(), string: vi.fn().mockReturnThis(),
                        notNullable: vi.fn().mockReturnThis(), defaultTo: vi.fn().mockReturnThis(),
                        timestamp: vi.fn().mockReturnThis(), primary: vi.fn().mockReturnThis(),
                        unique: vi.fn().mockReturnThis(), nullable: vi.fn().mockReturnThis(),
                        boolean: vi.fn().mockReturnThis(), text: vi.fn().mockReturnThis(),
                    };
                    cb(b);
                    return Promise.resolve();
                }
            ),
        },
        client: { pool: {} },
    };
    return { default: vi.fn().mockReturnValue(mockKnexInstance) };
});

import { MongooseAdapter } from '../../../database/adapters/MongooseAdapter';
import { KnexAdapter } from '../../../database/adapters/KnexAdapter';

describe('MongooseAdapter', () => {
    let adapter: MongooseAdapter;

    beforeEach(async () => {
        const mongoose = (await import('mongoose')).default;
        vi.mocked(mongoose.model).mockClear();
        // Reset models cache to allow re-registration
        (mongoose.models as Record<string, unknown>) = {};
        adapter = new MongooseAdapter({ uri: 'mongodb://localhost/test', dbName: 'test' });
    });

    it('connect calls mongoose.connect with the right args', async () => {
        const mongoose = (await import('mongoose')).default;
        await adapter.connect();
        expect(mongoose.connect).toHaveBeenCalledWith('mongodb://localhost/test', { dbName: 'test' });
    });

    it('isConnected returns true when connected and readyState is 1', async () => {
        await adapter.connect();
        expect(await adapter.isConnected()).toBe(true);
    });

    it('registerModel is a no-op for SQL-only schemas (no .mongo key)', () => {
        expect(() => adapter.registerModel('User', { sql: { tableName: 'users', up: vi.fn() } })).not.toThrow();
    });

    it('registerModel registers Mongo schemas via mongoose.model()', async () => {
        const mongoose = (await import('mongoose')).default;
        adapter.registerModel('Post', { mongo: { title: { type: String } } });
        expect(mongoose.model).toHaveBeenCalledWith('Post', expect.anything());
    });

    it('findOne delegates to model.findOne().lean()', async () => {
        adapter.registerModel('Post', { mongo: { title: { type: String } } });
        const result = await adapter.findOne('Post', { title: 'hello' });
        // expect(result).toEqual({ _id: '1', title: 'hello' });
        expect(result).toEqual({ id: '1', title: 'hello' });
    });

    it('migrate is a no-op and resolves without error', async () => {
        await expect(adapter.migrate()).resolves.toBeUndefined();
    });

    it('disconnect calls mongoose.disconnect', async () => {
        const mongoose = (await import('mongoose')).default;
        await adapter.disconnect();
        expect(mongoose.disconnect).toHaveBeenCalled();
    });
});

describe('KnexAdapter', () => {
    let adapter: KnexAdapter;
    let mockKnexInstance: ReturnType<typeof vi.fn>;

    beforeEach(async () => {
        const knexModule = await import('knex');
        mockKnexInstance = vi.mocked(knexModule.default)({ client: 'pg' }) as unknown as ReturnType<typeof vi.fn>;
        // Reset call counts
        (mockKnexInstance as unknown as { schema: { createTable: ReturnType<typeof vi.fn>; hasTable: ReturnType<typeof vi.fn> } }).schema.createTable.mockClear();
        (mockKnexInstance as unknown as { schema: { createTable: ReturnType<typeof vi.fn>; hasTable: ReturnType<typeof vi.fn> } }).schema.hasTable.mockResolvedValue(false);
        adapter = new KnexAdapter({ client: 'pg', connection: {} });
    });

    it('connect runs SELECT 1 without throwing', async () => {
        await expect(adapter.connect()).resolves.toBeUndefined();
    });

    it('registerModel is a no-op for Mongo-only schemas (no .sql key)', () => {
        expect(() => adapter.registerModel('Post', { mongo: { title: String } })).not.toThrow();
    });

    it('migrate creates tables for SQL-registered models', async () => {
        adapter.registerModel('User', { sql: { tableName: 'users', up: vi.fn() } });
        await expect(adapter.migrate()).resolves.toBeUndefined();
    });

    it('isConnected returns true when SELECT 1 succeeds', async () => {
        expect(await adapter.isConnected()).toBe(true);
    });

    it('isConnected returns false when SELECT 1 throws', async () => {
        (mockKnexInstance as unknown as { raw: ReturnType<typeof vi.fn> }).raw.mockRejectedValueOnce(new Error('connection refused'));
        expect(await adapter.isConnected()).toBe(false);
    });
});
