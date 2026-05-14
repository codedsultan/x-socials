import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock logger
vi.mock('../../../logger', () => ({
    default: {
        getInstance: vi.fn(() => ({
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn()
        })),
        _init: vi.fn(),
    },
}));

// Mock dotenv config to not actually load files in tests
vi.mock('dotenv/config', () => ({}));

import { ConfigService } from '../../../config/config.service';

describe('ConfigService', () => {
    // Save original env
    const originalEnv = { ...process.env };

    beforeEach(() => {
        // Reset env to test defaults
        process.env.NODE_ENV = 'test';
        process.env.PORT = '3000';
        process.env.SERVER_MAINTENANCE = 'false';
        process.env.ENABLE_SWAGGER = 'false';
        process.env.CORS_ENABLED = 'true';
        process.env.API_BASE_URL = 'http://localhost:3000';
        process.env.DEFAULT_DB = 'mongodb';
        process.env.MONGO_URI = 'mongodb://localhost/test';
        process.env.MONGO_DB_NAME = 'test';

        ConfigService.resetInstance();
    });

    afterEach(() => {
        // Restore original env
        process.env = { ...originalEnv };
        ConfigService.resetInstance();
    });

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

    it('getServerConfig() returns the server config', () => {
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
        expect(ConfigService.isServerMaintenance()).toBe(false);
    });

    it('getDefaultDb() returns defaultDb from database config', () => {
        expect(ConfigService.getDefaultDb()).toBe('mongodb');
    });

    it('getFullConfig() has both server and databases keys', () => {
        const full = ConfigService.getInstance().getFullConfig();
        expect(full).toHaveProperty('server');
        expect(full).toHaveProperty('databases');
    });
});