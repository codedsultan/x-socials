/**
 * src/monitoring/monitoring.test.ts
 *
 * Strategy: we don't test Prometheus output (that's OTel's job). We test that
 * Monitoring calls the right instrument methods with the right arguments, and
 * that the middleware wires the request lifecycle correctly.
 *
 * OTel's NoopMeter is active by default when no SDK is running, so all
 * instrument calls are safe no-ops unless we inject spies.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Shared instrument spies ───────────────────────────────────────────────────
// We create one set of spies and have createHistogram / createCounter /
// createUpDownCounter return them so every Monitoring method can be observed.

const histogramRecord = vi.fn();
const counterAdd = vi.fn();
const upDownCounterAdd = vi.fn();

const mockHistogram = { record: histogramRecord };
const mockCounter = { add: counterAdd };
const mockUpDownCounter = { add: upDownCounterAdd };

// Create a mock logger instance that we can spy on
const mockLoggerInstance = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
};

// getMeter returns a meter whose factory methods hand back the mocks above.
// We need to set this up BEFORE Monitoring is imported so the constructor
// sees the mocked meter, not the real NoopMeter.
vi.mock('@opentelemetry/api', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@opentelemetry/api')>();
    return {
        ...actual,
        metrics: {
            ...actual.metrics,
            getMeter: vi.fn(() => ({
                createHistogram: vi.fn(() => mockHistogram),
                createCounter: vi.fn(() => mockCounter),
                createUpDownCounter: vi.fn(() => mockUpDownCounter),
            })),
        },
    };
});

// Mock Logger so recordError doesn't blow up without a real winston instance
vi.mock("../logger", () => ({
    default: {
        getInstance: vi.fn(() => mockLoggerInstance),
        _init: vi.fn(),
    }
}));

// Import AFTER mocks are in place
import Monitoring from './index';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reset the singleton between tests so each test gets a clean slate. */
function resetSingleton() {
    // @ts-expect-error — accessing private static for test isolation
    Monitoring.instance = undefined;
}

/** Build a minimal mock req/res/next triple for middleware tests. */
function makeRequestTriple(overrides: { method?: string; path?: string; routePath?: string; statusCode?: number } = {}) {
    const finishListeners: (() => void)[] = [];

    const req = {
        method: overrides.method ?? 'GET',
        path: overrides.path ?? '/test',
        route: overrides.routePath ? { path: overrides.routePath } : undefined,
    };

    const res = {
        statusCode: overrides.statusCode ?? 200,
        on: vi.fn((event: string, cb: () => void) => {
            if (event === 'finish') finishListeners.push(cb);
        }),
        /** Simulate the response finishing */
        finish: () => finishListeners.forEach((cb) => cb()),
    };

    const next = vi.fn();

    return { req, res, next };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Monitoring', () => {
    beforeEach(() => {
        resetSingleton();
        vi.clearAllMocks();
        // Clear the mock logger instance calls
        mockLoggerInstance.info.mockClear();
        mockLoggerInstance.error.mockClear();
        mockLoggerInstance.warn.mockClear();
        mockLoggerInstance.debug.mockClear();
    });

    // ── Singleton ─────────────────────────────────────────────────────────────

    describe('getInstance()', () => {
        it('returns the same instance on repeated calls', () => {
            const a = Monitoring.getInstance();
            const b = Monitoring.getInstance();
            expect(a).toBe(b);
        });

        it('creates a new instance after singleton is reset', () => {
            const a = Monitoring.getInstance();
            resetSingleton();
            const b = Monitoring.getInstance();
            expect(a).not.toBe(b);
        });
    });

    // ── Middleware ────────────────────────────────────────────────────────────

    describe('middleware()', () => {
        it('calls next() immediately', () => {
            const { req, res, next } = makeRequestTriple();
            Monitoring.getInstance().middleware()(req, res, next);
            expect(next).toHaveBeenCalledOnce();
        });

        it('increments activeConnections when request starts', () => {
            const { req, res, next } = makeRequestTriple();
            Monitoring.getInstance().middleware()(req, res, next);
            expect(upDownCounterAdd).toHaveBeenCalledWith(1);
        });

        it('registers a finish listener on the response', () => {
            const { req, res, next } = makeRequestTriple();
            Monitoring.getInstance().middleware()(req, res, next);
            expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
        });

        it('records duration and request count on finish', () => {
            const { req, res, next } = makeRequestTriple({ method: 'POST', path: '/api/users', statusCode: 201 });
            Monitoring.getInstance().middleware()(req, res, next);
            res.finish();

            expect(histogramRecord).toHaveBeenCalledWith(
                expect.any(Number),
                expect.objectContaining({
                    'http.method': 'POST',
                    'http.route': '/api/users',
                    'http.status_code': 201,
                }),
            );

            expect(counterAdd).toHaveBeenCalledWith(
                1,
                expect.objectContaining({
                    'http.method': 'POST',
                    'http.route': '/api/users',
                    'http.status_code': 201,
                }),
            );
        });

        it('prefers req.route.path over req.path for the route label', () => {
            const { req, res, next } = makeRequestTriple({
                path: '/api/users/42',
                routePath: '/api/users/:id',
            });
            Monitoring.getInstance().middleware()(req, res, next);
            res.finish();

            expect(histogramRecord).toHaveBeenCalledWith(
                expect.any(Number),
                expect.objectContaining({ 'http.route': '/api/users/:id' }),
            );
        });

        it('decrements activeConnections on finish', () => {
            const { req, res, next } = makeRequestTriple();
            Monitoring.getInstance().middleware()(req, res, next);

            // Only the increment should have fired so far
            expect(upDownCounterAdd).toHaveBeenCalledTimes(1);
            expect(upDownCounterAdd).toHaveBeenLastCalledWith(1);

            res.finish();

            expect(upDownCounterAdd).toHaveBeenCalledTimes(2);
            expect(upDownCounterAdd).toHaveBeenLastCalledWith(-1);
        });

        it('records a non-negative duration', () => {
            const { req, res, next } = makeRequestTriple();
            Monitoring.getInstance().middleware()(req, res, next);
            res.finish();

            const recordedDuration = histogramRecord.mock.calls[0][0] as number;
            expect(recordedDuration).toBeGreaterThanOrEqual(0);
        });
    });

    // ── Business events ───────────────────────────────────────────────────────

    describe('recordUserSignup()', () => {
        it('increments the user signups counter by 1', () => {
            Monitoring.getInstance().recordUserSignup();
            expect(counterAdd).toHaveBeenCalledWith(1);
        });

        it('increments by 1 for each call', () => {
            const m = Monitoring.getInstance();
            m.recordUserSignup();
            m.recordUserSignup();
            // counterAdd is shared across all counters, so just verify calls >= 2
            expect(counterAdd.mock.calls.filter(([v]) => v === 1).length).toBeGreaterThanOrEqual(2);
        });
    });

    // ── Infrastructure ────────────────────────────────────────────────────────

    describe('recordDatabaseQuery()', () => {
        it('records duration with operation and collection labels', () => {
            Monitoring.getInstance().recordDatabaseQuery(42, 'find', 'users');
            expect(histogramRecord).toHaveBeenCalledWith(42, { operation: 'find', collection: 'users' });
        });

        it('passes through the exact duration value', () => {
            Monitoring.getInstance().recordDatabaseQuery(123.45, 'insertOne', 'posts');
            expect(histogramRecord).toHaveBeenCalledWith(123.45, expect.any(Object));
        });
    });

    describe('incrementExternalApiCall()', () => {
        it('increments the external API counter with service label', () => {
            Monitoring.getInstance().incrementExternalApiCall('twitter');
            expect(counterAdd).toHaveBeenCalledWith(1, { service: 'twitter' });
        });

        it('passes the service name through as-is', () => {
            Monitoring.getInstance().incrementExternalApiCall('openai-gpt4');
            expect(counterAdd).toHaveBeenCalledWith(1, { service: 'openai-gpt4' });
        });
    });

    describe('recordError()', () => {
        it('increments the error counter with type and route labels', () => {
            Monitoring.getInstance().recordError('ValidationError', '/api/users');
            expect(counterAdd).toHaveBeenCalledWith(1, {
                'error.type': 'ValidationError',
                'http.route': '/api/users',
            });
        });

        it('logs the error via Logger', () => {
            // Clear any previous calls
            mockLoggerInstance.error.mockClear();

            // Call recordError
            Monitoring.getInstance().recordError('DatabaseError', '/api/posts');

            // Verify logger.error was called with the expected arguments
            expect(mockLoggerInstance.error).toHaveBeenCalledTimes(1);
            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                '[Monitoring] Error recorded',
                { type: 'DatabaseError', route: '/api/posts' }
            );
        });

        it('logs different error types correctly', () => {
            mockLoggerInstance.error.mockClear();

            Monitoring.getInstance().recordError('AuthError', '/api/login');

            expect(mockLoggerInstance.error).toHaveBeenCalledWith(
                '[Monitoring] Error recorded',
                { type: 'AuthError', route: '/api/login' }
            );
        });
    });
});