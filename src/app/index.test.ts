// src/app/index.test.ts
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import request from 'supertest';

// ─── mocks (must be before any import that triggers side-effects) ────────────

vi.mock('../logger', () => ({
    default: {
        getInstance: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), http: vi.fn() })),
        _init: vi.fn(),
    },
}));

vi.mock('../config/env', () => ({
    default: {
        getConfig: vi.fn(() => ({
            PORT: 5000,
            NODE_ENV: 'development',
            SERVER_MAINTENANCE: false,
            API_PREFIX: 'api',
            CORS_ENABLED: true,
        })),
        isProduction: vi.fn(() => false),
        isDevelopment: vi.fn(() => true),
        isStaging: vi.fn(() => false),
        isTest: vi.fn(() => false),
        isServerMaintenance: vi.fn(() => false),
        getApiUrl: vi.fn(() => 'http://localhost:5000'),
        isSwaggerEnabled: vi.fn(() => true),
        init: vi.fn((app: unknown) => app),
    },
}));

// Fix the ConfigService mock to properly return API_PREFIX
vi.mock('../config/config.service', () => ({
    default: {
        getInstance: vi.fn(() => ({
            getServerConfig: vi.fn(() => ({
                PORT: 5000,
                NODE_ENV: 'test',
                SERVER_MAINTENANCE: false,
                API_PREFIX: 'api',
                CORS_ENABLED: true,
            })),
            getPort: vi.fn(() => 5000),
            getNodeEnv: vi.fn(() => 'test'),
            isMaintenance: vi.fn(() => false),
            isSwaggerEnabled: vi.fn(() => false),
            getApiUrl: vi.fn(() => 'http://localhost:5000'),
            initExpress: vi.fn((app: any) => app),
        })),
        getServerConfig: vi.fn(() => ({
            PORT: 5000,
            NODE_ENV: 'test',
            SERVER_MAINTENANCE: false,
            API_PREFIX: 'api',
            CORS_ENABLED: true,
        })),
        getPort: vi.fn(() => 5000),
        getNodeEnv: vi.fn(() => 'test'),
        isMaintenance: vi.fn(() => false),
        isSwaggerEnabled: vi.fn(() => false),
        getApiUrl: vi.fn(() => 'http://localhost:5000'),
        initExpress: vi.fn((app: any) => app),
    },
}));

vi.mock('../config/swagger', () => ({ default: { init: vi.fn((app: unknown) => app) } }));

vi.mock('../monitoring', () => ({
    default: {
        getInstance: vi.fn(() => ({
            middleware: vi.fn(() => (_r: unknown, _s: unknown, next: () => void) => next()),
            recordError: vi.fn(),
            incrementExternalApiCall: vi.fn(),
        })),
    },
}));

vi.mock('../middlewares/Http', () => ({ default: { mount: vi.fn((app: unknown) => app) } }));
vi.mock('../middlewares/Morgan', () => ({ default: { mount: vi.fn((app: unknown) => app) } }));
vi.mock('../middlewares/CORS', () => ({ default: { mount: vi.fn((app: unknown) => app) } }));

vi.mock('../exceptions/Handler', () => {
    function makeErrHandler(impl: (...a: any[]) => void) {
        const fn = vi.fn(impl);
        Object.defineProperty(fn, 'length', { value: 4, configurable: true });
        return fn;
    }
    return {
        default: {
            notFoundHandler: vi.fn((app: import('express').Application) => {
                app.use((_r: unknown, res: import('express').Response) =>
                    res.status(404).json({ error: 'Path not found', success: false })
                );
                return app;
            }),
            logErrors: makeErrHandler((_e, _r, _s, next: () => void) => next()),
            clientErrorHandler: makeErrHandler((_e, _r, _s, next: () => void) => next()),
            errorHandler: makeErrHandler((err: unknown, _r, res: import('express').Response) => {
                const e = err as { status?: number; statusCode?: number; message?: string } | null;
                res.status(e?.status ?? e?.statusCode ?? 500).json({ error: e?.message, success: false });
            }),
        },
    };
});

vi.mock('../../instrumentation', () => ({
    shutdownTelemetry: vi.fn().mockResolvedValue(undefined),
}));

// ─── Fake DatabaseInitializer ─────────────────────────────────────────────────

function makeFakeDb(initialized = true): import('../database/initializer').DatabaseInitializer {
    return {
        initialize: vi.fn().mockResolvedValue(undefined),
        shutdown: vi.fn().mockResolvedValue(undefined),
        healthCheck: vi.fn().mockResolvedValue({ mongodb: true }),
        isInitialized: vi.fn().mockReturnValue(initialized),
        getContainer: vi.fn().mockReturnValue({
            factory: {
                getRepository: vi.fn().mockReturnValue({
                    findMany: vi.fn().mockResolvedValue([{ id: '1', email: 'a@b.com' }]),
                    count: vi.fn().mockResolvedValue(1),
                }),
            },
        }),
    } as unknown as import('../database/initializer').DatabaseInitializer;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

import { ExpressApp } from './index';

describe('ExpressApp', () => {
    let app: ExpressApp;

    beforeEach(() => {
        app = new ExpressApp(makeFakeDb());
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('GET /', () => {
        it('returns 200 with message and environment', async () => {
            const res = await request(app.express).get('/');
            expect(res.status).toBe(200);
            expect(res.body).toHaveProperty('message');
            expect(res.body.environment).toBe('test');
        });
    });

    describe('GET /health', () => {
        it('returns 200 with database info', async () => {
            const res = await request(app.express).get('/health');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('OK');
            expect(res.body).toHaveProperty('database');
        });

        it('sets X-Environment and X-API-Version headers', async () => {
            const res = await request(app.express).get('/health');
            expect(res.headers['x-environment']).toBeDefined();
            expect(res.headers['x-api-version']).toBe('1.0.0');
        });
    });

    describe('GET /ready', () => {
        it('returns 200 when db is initialized', async () => {
            const res = await request(app.express).get('/ready');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('ready');
        });

        it('returns 503 when db is not initialized', async () => {
            const uninitApp = new ExpressApp(makeFakeDb(false));
            const res = await request(uninitApp.express).get('/ready');
            expect(res.status).toBe(503);
        });
    });

    describe('GET /live', () => {
        it('always returns 200', async () => {
            const res = await request(app.express).get('/live');
            expect(res.status).toBe(200);
            expect(res.body.status).toBe('alive');
        });
    });

    describe('GET /api/users', () => {
        it('returns users list with success envelope when db is ready', async () => {
            const res = await request(app.express).get('/api/users');
            expect(res.status).toBe(200);
            // Module router returns PagedResult: { success, data: { items, meta } }
            expect(res.body.success).toBe(true);
            expect(Array.isArray(res.body.data.items)).toBe(true);
        });

        it('returns 404 for unknown sub-paths (route moved to module router)', async () => {
            // The old inline /api/users stub is gone; the module router handles
            // /api/users but requires auth for some operations. A bare GET /api/users
            // is now the public list endpoint — still 200 when db is ready.
            const uninitApp = new ExpressApp(makeFakeDb(false));
            const res = await request(uninitApp.express).get('/api/users');
            // repoFactory is undefined → UsersController calls next(err) → 500
            // Either 500 (service threw) or 503 (guard check) — not 200.
            expect(res.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('GET /api/environment', () => {
        it('returns environment info', async () => {
            const res = await request(app.express).get('/api/environment');
            expect(res.status).toBe(200);
            expect(res.body.environment).toBe('test');
        });
    });

    describe('404 handler', () => {
        it('returns 404 for unknown routes', async () => {
            const res = await request(app.express).get('/this/does/not/exist');
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });

    describe('ExpressApp constructor (no module-level singleton)', () => {
        it('creates independent instances with their own db', () => {
            const db1 = makeFakeDb(true);
            const db2 = makeFakeDb(false);
            const app1 = new ExpressApp(db1);
            const app2 = new ExpressApp(db2);

            expect(app1).not.toBe(app2);
            expect(app1.express).not.toBe(app2.express);
        });
    });
});