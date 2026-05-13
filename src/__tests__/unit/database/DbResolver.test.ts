import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DbRegistry } from '../../../database/core/DbRegistry';
import type { IDatabaseConfig } from '../../../interfaces/core/config';

// Mocks must use function/class syntax to be newable
vi.mock('../../../database/adapters/MongooseAdapter', () => {
    const MongooseAdapter = vi.fn().mockImplementation(function(this: Record<string, unknown>) {
        this.connect       = vi.fn().mockResolvedValue(undefined);
        this.disconnect    = vi.fn().mockResolvedValue(undefined);
        this.isConnected   = vi.fn().mockResolvedValue(true);
        this.registerModel = vi.fn();
        this.migrate       = vi.fn().mockResolvedValue(undefined);
        this.findOne = vi.fn(); this.findMany = vi.fn();
        this.create = vi.fn(); this.update = vi.fn();
        this.delete = vi.fn(); this.withTransaction = vi.fn();
    });
    return { MongooseAdapter };
});

vi.mock('../../../database/adapters/KnexAdapter', () => {
    const KnexAdapter = vi.fn().mockImplementation(function(this: Record<string, unknown>) {
        this.connect       = vi.fn().mockResolvedValue(undefined);
        this.disconnect    = vi.fn().mockResolvedValue(undefined);
        this.isConnected   = vi.fn().mockResolvedValue(true);
        this.registerModel = vi.fn();
        this.migrate       = vi.fn().mockResolvedValue(undefined);
        this.findOne = vi.fn(); this.findMany = vi.fn();
        this.create = vi.fn(); this.update = vi.fn();
        this.delete = vi.fn(); this.withTransaction = vi.fn();
    });
    return { KnexAdapter };
});

// Import DbResolver AFTER mocks are registered
import { DbResolver } from '../../../database/core/DbResolver';

const mongoOnly: IDatabaseConfig = {
    mongodb: { uri: 'mongodb://localhost/test', dbName: 'test', socketTimeoutMS: 5000, serverSelectionTimeoutMS: 3000 },
    defaultDb: 'mongodb',
};

const splitConfig: IDatabaseConfig = {
    mongodb:  { uri: 'mongodb://localhost/test', dbName: 'test', socketTimeoutMS: 5000, serverSelectionTimeoutMS: 3000 },
    postgres: { host: 'localhost', port: 5432, database: 'test', ssl: false, client: 'pg', poolMin: 1, poolMax: 5 },
    defaultDb: 'mongodb',
};

describe('DbResolver', () => {
    describe('single-DB mode (MongoDB only)', () => {
        let registry: DbRegistry;
        let resolver: DbResolver;

        beforeEach(() => {
            registry = new DbRegistry({ User: 'mongodb', Post: 'mongodb' }, 'mongodb');
            resolver = new DbResolver(mongoOnly, registry);
        });

        it('connectAll succeeds', async () => {
            await expect(resolver.connectAll()).resolves.toBeUndefined();
        });

        it('getConfiguredTypes includes mongodb', () => {
            expect(resolver.getConfiguredTypes()).toContain('mongodb');
        });

        it('getAdapterForModel returns the mongo adapter', () => {
            expect(resolver.getAdapterForModel('User')).toBeDefined();
        });

        it('healthCheck returns boolean per adapter', async () => {
            const health = await resolver.healthCheck();
            expect(typeof health['mongodb']).toBe('boolean');
        });
    });

    describe('split-DB mode (Mongo + Postgres)', () => {
        let registry: DbRegistry;
        let resolver: DbResolver;

        beforeEach(() => {
            registry = new DbRegistry({ User: 'postgres', Post: 'mongodb' }, 'mongodb');
            resolver = new DbResolver(splitConfig, registry);
        });

        it('connectAll connects both adapters', async () => {
            await expect(resolver.connectAll()).resolves.toBeUndefined();
        });

        it('routes User to postgres adapter', () => {
            expect(resolver.getAdapterForModel('User')).toBeDefined();
        });

        it('routes Post to mongodb adapter', () => {
            expect(resolver.getAdapterForModel('Post')).toBeDefined();
        });

        it('throws when requesting an unconfigured adapter', () => {
            const r = new DbRegistry({ Foo: 'mysql' }, 'mysql');
            const res = new DbResolver(mongoOnly, r); // mysql not in mongoOnly
            expect(() => res.getAdapterForModel('Foo')).toThrow(/no adapter configured/i);
        });

        it('registerModelsAndMigrate calls registerModel on the right adapter', async () => {
            const schemas = {
                User: { sql: { tableName: 'users', up: vi.fn() } },
                Post: { mongo: { title: String } },
            };
            await resolver.registerModelsAndMigrate(schemas);

            const pgAdapter = resolver.getAdapter('postgres');
            const mgAdapter = resolver.getAdapter('mongodb');

            expect(pgAdapter?.registerModel).toHaveBeenCalledWith('User', schemas['User']);
            expect(mgAdapter?.registerModel).toHaveBeenCalledWith('Post', schemas['Post']);
        });
    });
});
