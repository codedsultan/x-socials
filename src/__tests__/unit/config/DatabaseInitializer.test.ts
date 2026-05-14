// src/__tests__/unit/config/DatabaseInitializer.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDatabaseConfig } from '../../../interfaces/core/config';

// Mock logger first
vi.mock('../../../logger', () => ({
    default: {
        getInstance: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        })),
    },
}));

// Mock database.config with proper implementation
vi.mock('../../../config/database.config', async () => {
    const actual = await vi.importActual('../../../config/database.config');
    return {
        ...actual,
        buildDatabaseContainer: vi.fn().mockImplementation(async (_config, _options) => ({
            registry: {},
            resolver: {
                disconnectAll: vi.fn().mockResolvedValue(undefined),
                healthCheck: vi.fn().mockResolvedValue({ mongodb: true }),
                connectAll: vi.fn().mockResolvedValue(undefined),
                registerModelsAndMigrate: vi.fn().mockResolvedValue(undefined),
            },
            factory: { getRepository: vi.fn() },
        })),
        checkDatabaseHealth: vi.fn().mockResolvedValue({ mongodb: true }),
    };
});

import { DatabaseInitializer } from '../../../database/initializer';
import { buildDatabaseContainer } from '../../../config/database.config';

const fakeConfig: IDatabaseConfig = {
    mongodb: {
        uri: 'mongodb://localhost/test',
        dbName: 'test',
        socketTimeoutMS: 5000,
        serverSelectionTimeoutMS: 3000,
    },
    defaultDb: 'mongodb',
    dbMode: 'split',
};

describe('DatabaseInitializer', () => {
    let initializer: DatabaseInitializer;

    beforeEach(() => {
        vi.clearAllMocks();
        initializer = new DatabaseInitializer(fakeConfig);
    });

    it('isInitialized() is false before initialize()', () => {
        expect(initializer.isInitialized()).toBe(false);
    });

    it('initialize() calls buildDatabaseContainer with the injected config', async () => {
        await initializer.initialize();
        expect(buildDatabaseContainer).toHaveBeenCalledWith(fakeConfig, undefined);
        expect(initializer.isInitialized()).toBe(true);
    });

    it('initialize() is idempotent — second call is a no-op', async () => {
        await initializer.initialize();
        await initializer.initialize();
        expect(buildDatabaseContainer).toHaveBeenCalledTimes(1);
    });

    it('getContainer() throws before initialize()', () => {
        expect(() => initializer.getContainer()).toThrow('not initialized');
    });

    it('getContainer() returns the container after initialize()', async () => {
        await initializer.initialize();
        const container = initializer.getContainer();
        expect(container).toHaveProperty('registry');
        expect(container).toHaveProperty('resolver');
        expect(container).toHaveProperty('factory');
    });

    it('healthCheck() returns empty object before initialize()', async () => {
        const health = await initializer.healthCheck();
        expect(health).toEqual({});
    });

    it('healthCheck() returns adapter statuses after initialize()', async () => {
        await initializer.initialize();
        const health = await initializer.healthCheck();
        expect(health).toEqual({ mongodb: true });
    });

    it('shutdown() disconnects adapters and resets isInitialized to false', async () => {
        await initializer.initialize();
        const container = initializer.getContainer();
        const disconnectAllSpy = vi.mocked(container.resolver.disconnectAll);

        await initializer.shutdown();
        expect(disconnectAllSpy).toHaveBeenCalled();
        expect(initializer.isInitialized()).toBe(false);
    });

    it('shutdown() before initialize() is a safe no-op', async () => {
        await expect(initializer.shutdown()).resolves.toBeUndefined();
    });

    it('can be re-initialized after shutdown', async () => {
        await initializer.initialize();
        await initializer.shutdown();
        await initializer.initialize();
        expect(buildDatabaseContainer).toHaveBeenCalledTimes(2);
        expect(initializer.isInitialized()).toBe(true);
    });

    it('each instance is independent — no shared state', async () => {
        const other = new DatabaseInitializer(fakeConfig);
        await initializer.initialize();
        expect(other.isInitialized()).toBe(false);
    });
});