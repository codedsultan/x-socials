/**
 * src/instrumentation.ts
 *
 * OpenTelemetry SDK setup. Imported at the very top of src/index.ts
 * BEFORE any other imports so instrumentation patches load first.
 *
 * Signal handlers (SIGTERM/SIGINT) are owned by ExpressApp._setupGracefulShutdown().
 * Do NOT register them here — duplicate handlers cause a shutdown race condition.
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

const IGNORE_PATHS = ['/health', '/metrics', '/ready', '/live'];

// Prometheus scrape endpoint on a dedicated port — never mixed with app traffic.
const prometheusExporter = new PrometheusExporter(
    { port: 9464, endpoint: '/metrics' },
    () => console.log('📊 Prometheus scrape endpoint: http://localhost:9464/metrics'),
);

const isProduction = !['development', 'test'].includes(process.env['NODE_ENV'] ?? '');

let sdk: NodeSDK | null = null;

if (isProduction) {
    sdk = new NodeSDK({
        spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
        metricReader: prometheusExporter,
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {
                    enabled: true,
                    ignoreIncomingRequestHook: (req) =>
                        IGNORE_PATHS.includes(req.url ?? ''),
                },
                '@opentelemetry/instrumentation-express': { enabled: true },
                // fs instrumentation is very noisy — disable unless needed
                '@opentelemetry/instrumentation-fs': { enabled: false },
            }),
        ],
    });

    sdk.start();
    console.log('🔍 OpenTelemetry SDK started');
} else {
    console.log(`⚙️  OpenTelemetry SDK skipped (${process.env['NODE_ENV'] ?? 'development'} mode)`);
}

/**
 * Exported so ExpressApp._close() can await a clean OTel shutdown before
 * closing the HTTP server and disconnecting adapters.
 */
export async function shutdownTelemetry(): Promise<void> {
    if (sdk) {
        await sdk.shutdown();
        console.log('OTel SDK shut down cleanly');
    }
}
