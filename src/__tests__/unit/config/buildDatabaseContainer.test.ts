import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDatabaseConfig } from '../../../interfaces/core/config';

vi.mock('../../../logger', () => ({
    default: { getInstance: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

// Mock the DB layer — we test the wiring logic, not adapter internals
vi.mock('../../../database/core/DbRegistry', () => ({
    DbRegistry: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
        this.enableSingleMode = vi.fn();
        this.disableSingleMode = vi.fn();
        this.getDbForModel = vi.fn().mockReturnValue('mongodb');
        this.getDefaultDb = vi.fn().mockReturnValue('mongodb');
        this.getMode = vi.fn().mockReturnValue('split');
    }),
}));

vi.mock('../../../database/core/DbResolver', () => ({
    DbResolver: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
        this.connectAll = vi.fn().mockResolvedValue(undefined);
        this.disconnectAll = vi.fn().mockResolvedValue(undefined);
        this.registerModelsAndMigrate = vi.fn().mockResolvedValue(undefined);
        this.getConfiguredTypes = vi.fn().mockReturnValue(['mongodb']);
        this.healthCheck = vi.fn().mockResolvedValue({ mongodb: true });
        this.getAdapterForModel = vi.fn();
        this.getAdapter = vi.fn();
    }),
}));

vi.mock('../../../factories/RepositoryFactory', () => ({
    RepositoryFactory: vi.fn().mockImplementation(function (this: Record<string, unknown>) {
        this.getRepository = vi.fn();
    }),
}));

import { buildDatabaseContainer } from '../../../config/database.config';
import { DbRegistry } from '../../../database/core/DbRegistry';
import { DbResolver } from '../../../database/core/DbResolver';
import { RepositoryFactory } from '../../../factories/RepositoryFactory';

const mongoOnlyConfig: IDatabaseConfig = {
    mongodb: { uri: 'mongodb://localhost/test', dbName: 'test', socketTimeoutMS: 5000, serverSelectionTimeoutMS: 3000 },
    defaultDb: 'mongodb',
    dbMode: 'split',
};

const singleModeConfig: IDatabaseConfig = {
    mongodb: { uri: 'mongodb://localhost/test', dbName: 'test', socketTimeoutMS: 5000, serverSelectionTimeoutMS: 3000 },
    defaultDb: 'mongodb',
    dbMode: 'single',
};

describe('buildDatabaseContainer', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns registry, resolver, and factory', async () => {
        const container = await buildDatabaseContainer(mongoOnlyConfig);
        expect(container).toHaveProperty('registry');
        expect(container).toHaveProperty('resolver');
        expect(container).toHaveProperty('factory');
    });

    it('constructs DbRegistry with the model mapping and defaultDb', async () => {
        await buildDatabaseContainer(mongoOnlyConfig);
        expect(DbRegistry).toHaveBeenCalledWith(expect.any(Object), 'mongodb');
    });

    // it('constructs DbResolver with the config and registry', async () => {
    //     await buildDatabaseContainer(mongoOnlyConfig);
    //     expect(DbResolver).toHaveBeenCalledWith(mongoOnlyConfig, expect.any(Object));
    // });
    it('constructs DbResolver with the config and registry', async () => {
        await buildDatabaseContainer(mongoOnlyConfig);
        expect(DbResolver).toHaveBeenCalledWith(
            mongoOnlyConfig,
            expect.any(Object),
            undefined  // options parameter
        );
    });

    it('calls connectAll on the resolver', async () => {
        const container = await buildDatabaseContainer(mongoOnlyConfig);
        const resolver = container.resolver as unknown as { connectAll: ReturnType<typeof vi.fn> };
        expect(resolver.connectAll).toHaveBeenCalled();
    });

    it('calls registerModelsAndMigrate on the resolver', async () => {
        const container = await buildDatabaseContainer(mongoOnlyConfig);
        const resolver = container.resolver as unknown as { registerModelsAndMigrate: ReturnType<typeof vi.fn> };
        expect(resolver.registerModelsAndMigrate).toHaveBeenCalled();
    });

    it('constructs RepositoryFactory with the resolver', async () => {
        await buildDatabaseContainer(mongoOnlyConfig);
        expect(RepositoryFactory).toHaveBeenCalledWith(expect.any(Object));
    });

    it('enables single mode when dbMode is "single"', async () => {
        const container = await buildDatabaseContainer(singleModeConfig);
        const registry = container.registry as unknown as { enableSingleMode: ReturnType<typeof vi.fn> };
        expect(registry.enableSingleMode).toHaveBeenCalledWith('mongodb');
    });

    it('does NOT enable single mode when dbMode is "split"', async () => {
        const container = await buildDatabaseContainer(mongoOnlyConfig);
        const registry = container.registry as unknown as { enableSingleMode: ReturnType<typeof vi.fn> };
        expect(registry.enableSingleMode).not.toHaveBeenCalled();
    });
});
