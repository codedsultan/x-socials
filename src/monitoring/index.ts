/**
 * src/monitoring/monitoring.ts
 *
 * Application-level metrics built on the OpenTelemetry Metrics API.
 * All instruments are created once at construction time — never inside
 * per-request methods — so there's no risk of duplicate-registration errors.
 *
 * The SDK (instrumentation.ts) wires these up to Prometheus automatically;
 * no prom-client dependency needed.
 */

import { metrics, Histogram, Counter, UpDownCounter } from '@opentelemetry/api';
import Logger from '../logger';

const METER_NAME = 'x-socials';

class Monitoring {
    private static instance: Monitoring;

    // HTTP
    private readonly httpRequestDuration: Histogram;
    private readonly httpRequestTotal: Counter;
    private readonly activeConnections: UpDownCounter;

    // Errors
    private readonly errorTotal: Counter;

    // Business events
    private readonly userSignupsTotal: Counter;

    // Database
    private readonly dbQueryDuration: Histogram;

    // External APIs
    private readonly externalApiCallsTotal: Counter;

    private constructor() {
        const meter = metrics.getMeter(METER_NAME);

        this.httpRequestDuration = meter.createHistogram('http.server.duration', {
            description: 'Duration of HTTP requests in milliseconds',
            unit: 'ms',
        });

        this.httpRequestTotal = meter.createCounter('http.server.requests', {
            description: 'Total number of HTTP requests',
        });

        // UpDownCounter is the OTel equivalent of a Gauge for values that go up and down
        this.activeConnections = meter.createUpDownCounter('http.server.active_connections', {
            description: 'Number of active HTTP connections',
        });

        this.errorTotal = meter.createCounter('errors.total', {
            description: 'Total number of application errors',
        });

        this.userSignupsTotal = meter.createCounter('business.user_signups', {
            description: 'Total number of user signups',
        });

        this.dbQueryDuration = meter.createHistogram('db.query.duration', {
            description: 'Duration of database queries in milliseconds',
            unit: 'ms',
        });

        this.externalApiCallsTotal = meter.createCounter('external_api.calls', {
            description: 'Total number of outbound external API calls',
        });
    }

    public static getInstance(): Monitoring {
        if (!Monitoring.instance) {
            Monitoring.instance = new Monitoring();
        }
        return Monitoring.instance;
    }

    /**
     * Express middleware — call monitoring.middleware() in app setup.
     *
     * Note: @opentelemetry/instrumentation-http already tracks request duration
     * and active connections automatically. This middleware is only needed if you
     * want custom label shapes (e.g. route templates instead of raw paths).
     * Remove it if the auto-instrumentation covers your needs.
     */
    public middleware() {
        return (req: any, res: any, next: any) => {
            const startMs = Date.now();
            this.activeConnections.add(1);

            res.on('finish', () => {
                const duration = Date.now() - startMs;
                const attrs = {
                    'http.method': req.method,
                    'http.route': req.route?.path ?? req.path,
                    'http.status_code': res.statusCode,
                };

                this.httpRequestDuration.record(duration, attrs);
                this.httpRequestTotal.add(1, attrs);
                this.activeConnections.add(-1);
            });

            next();
        };
    }

    // ── Business events ──────────────────────────────────────────────────────

    public recordUserSignup(): void {
        this.userSignupsTotal.add(1);
    }

    // ── Infrastructure ───────────────────────────────────────────────────────

    public recordDatabaseQuery(durationMs: number, operation: string, collection: string): void {
        this.dbQueryDuration.record(durationMs, { operation, collection });
    }

    public incrementExternalApiCall(service: string): void {
        this.externalApiCallsTotal.add(1, { service });
    }

    public recordError(type: string, route: string): void {
        this.errorTotal.add(1, { 'error.type': type, 'http.route': route });
        Logger.getInstance().error(`[Monitoring] Error recorded`, { type, route });
    }
}

export default Monitoring;