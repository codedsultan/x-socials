import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { ExpressApp } from '../../app/index';

// ─── shared mocks ─────────────────────────────────────────────────────────────

vi.mock('../../logger', () => ({
    default: {
        getInstance: vi.fn(() => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), http: vi.fn() })),
        _init: vi.fn(),
    },
}));

vi.mock('../../config/env', () => ({
    default: {
        getConfig: vi.fn(() => ({
            PORT: 5001, NODE_ENV: 'test',
            SERVER_MAINTENANCE: false, API_PREFIX: 'api', CORS_ENABLED: true,
        })),
        isProduction: vi.fn(() => false), isDevelopment: vi.fn(() => false),
        isStaging: vi.fn(() => false), isTest: vi.fn(() => true),
        isServerMaintenance: vi.fn(() => false),
        getApiUrl: vi.fn(() => 'http://localhost:5001'),
        isSwaggerEnabled: vi.fn(() => false),
        init: vi.fn((app: unknown) => app),
    },
}));

vi.mock('../../monitoring', () => ({
    default: {
        getInstance: vi.fn(() => ({
            middleware: vi.fn(() => (_r: unknown, _s: unknown, next: () => void) => next()),
            recordError: vi.fn(), incrementExternalApiCall: vi.fn(),
        })),
    },
}));

vi.mock('../../config/swagger', () => ({ default: { init: vi.fn((app: unknown) => app) } }));
vi.mock('../../middlewares/Http',   () => ({ default: { mount: vi.fn((app: unknown) => app) } }));
vi.mock('../../middlewares/Morgan', () => ({ default: { mount: vi.fn((app: unknown) => app) } }));
vi.mock('../../middlewares/CORS',   () => ({ default: { mount: vi.fn((app: unknown) => app) } }));
vi.mock('../../exceptions/Handler', () => {
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
            logErrors:          makeErrHandler((_e, _r, _s, next: () => void) => next()),
            clientErrorHandler: makeErrHandler((_e, _r, _s, next: () => void) => next()),
            errorHandler:       makeErrHandler((err: unknown, _r, res: import('express').Response) => {
                const e = err as { status?: number; statusCode?: number; message?: string } | null;
                res.status(e?.status ?? e?.statusCode ?? 500).json({ error: e?.message, success: false });
            }),
        },
    };
});

// ─── Fake DB with stubbed users ────────────────────────────────────────────────

function makeFakeDb(): import('../../database/initializer').DatabaseInitializer {
    return {
        initialize:    vi.fn().mockResolvedValue(undefined),
        shutdown:      vi.fn().mockResolvedValue(undefined),
        healthCheck:   vi.fn().mockResolvedValue({ mongodb: true }),
        isInitialized: vi.fn().mockReturnValue(true),
        getContainer:  vi.fn().mockReturnValue({
            factory: {
                getRepository: vi.fn().mockReturnValue({
                    findMany: vi.fn().mockResolvedValue([
                        { id: 'u1', email: 'alice@example.com' },
                        { id: 'u2', email: 'bob@example.com' },
                    ]),
                }),
            },
        }),
    } as unknown as import('../../database/initializer').DatabaseInitializer;
}

describe('API Integration Tests', () => {
    const app = new ExpressApp(makeFakeDb()).express;

    it('handles sequential requests without state leakage', async () => {
        const [r1, r2, r3] = await Promise.all([
            request(app).get('/'),
            request(app).get('/health'),
            request(app).get('/live'),
        ]);
        expect(r1.status).toBe(200);
        expect(r2.status).toBe(200);
        expect(r3.status).toBe(200);
    });

    it('all JSON responses have content-type header', async () => {
        const res = await request(app).get('/');
        expect(res.headers['content-type']).toContain('application/json');
    });

    it('sets custom headers on every response', async () => {
        const res = await request(app).get('/health');
        expect(res.headers['x-environment']).toBeDefined();
        expect(res.headers['x-api-version']).toBe('1.0.0');
    });

    it('returns 404 for unknown routes', async () => {
        const res = await request(app).get('/totally/unknown/route');
        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
    });

    it('GET /api/users returns actual repository data', async () => {
        const res = await request(app).get('/api/users');
        expect(res.status).toBe(200);
        expect(res.body.users).toHaveLength(2);
        expect(res.body.users[0].email).toBe('alice@example.com');
    });

    it('GET /ready returns 200 when db is initialized', async () => {
        const res = await request(app).get('/ready');
        expect(res.status).toBe(200);
    });
});
