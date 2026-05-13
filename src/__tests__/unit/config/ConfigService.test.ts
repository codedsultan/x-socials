import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// All vi.mock calls are hoisted. The issue is config.service.ts's default export
// `= ConfigService.getInstance()` runs at module-load time. We must ensure the
// builder mocks are in place before config.service.ts is first imported.
// vi.mock hoisting guarantees that, but we also need the default export neutralised.

vi.mock('../../../logger', () => ({
    default: {
        getInstance: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
        _init: vi.fn(),
    },
}));

vi.mock('../../../config/builders/server.config.builder', () => ({
    ServerConfigBuilder: vi.fn().mockImplementation(function(this: unknown) {
        (this as { build: () => unknown }).build = vi.fn().mockReturnValue({
            PORT: 3000, NODE_ENV: 'test', SERVER_MAINTENANCE: false,
            API_BASE_URL: 'http://localhost:3000', ENABLE_SWAGGER: false, CORS_ENABLED: true,
        });
    }),
}));

vi.mock('../../../config/builders/database.config.builder', () => ({
    DatabaseConfigBuilder: vi.fn().mockImplementation(function(this: unknown) {
        (this as { build: () => unknown }).build = vi.fn().mockReturnValue({
            mongodb: { uri: 'mongodb://localhost/test', dbName: 'test', socketTimeoutMS: 5000, serverSelectionTimeoutMS: 3000 },
            defaultDb: 'mongodb',
            dbMode: 'split',
        });
    }),
}));

import { ConfigService } from '../../../config/config.service';

describe('ConfigService', () => {
    beforeEach(() => ConfigService.resetInstance());
    afterEach(() => ConfigService.resetInstance());

    it('getInstance() returns a singleton', () => {
        const a = ConfigService.getInstance();
        const b = ConfigService.getInstance();
        expect(a).toBe(b);
    });

    it('resetInstance() causes next getInstance() to rebuild', () => {
        const a = ConfigService.getInstance();
        ConfigService.resetInstance();
        const b = ConfigService.getInstance();
        expect(a).not.toBe(b);
    });

    it('getServerConfig() returns the mocked server config', () => {
        const cfg = ConfigService.getInstance().getServerConfig();
        expect(cfg.NODE_ENV).toBe('test');
        expect(cfg.PORT).toBe(3000);
    });

    it('getDatabaseConfig() (instance) returns db config with dbMode', () => {
        const cfg = ConfigService.getInstance().getDatabaseConfig();
        expect(cfg.defaultDb).toBe('mongodb');
        expect(cfg.mongodb).toBeDefined();
        expect(cfg.dbMode).toBe('split');
    });

    it('static getDatabaseConfig() delegates to singleton instance', () => {
        const cfg = ConfigService.getDatabaseConfig();
        expect(cfg.defaultDb).toBe('mongodb');
    });

    it('isProduction() is false for NODE_ENV=test', () => {
        expect(ConfigService.getInstance().isProduction()).toBe(false);
    });

    it('isTest() is true for NODE_ENV=test', () => {
        expect(ConfigService.getInstance().isTest()).toBe(true);
    });

    it('isDevelopment() is false for NODE_ENV=test', () => {
        expect(ConfigService.getInstance().isDevelopment()).toBe(false);
    });

    it('isServerMaintenance() is false when SERVER_MAINTENANCE=false', () => {
        expect(ConfigService.getInstance().isServerMaintenance()).toBe(false);
    });

    it('getDefaultDb() returns defaultDb from database config', () => {
        expect(ConfigService.getInstance().getDefaultDb()).toBe('mongodb');
    });

    it('getFullConfig() has both server and databases keys', () => {
        const full = ConfigService.getInstance().getFullConfig();
        expect(full).toHaveProperty('server');
        expect(full).toHaveProperty('databases');
    });
});
