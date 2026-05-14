/**
 * src/instrumentation.ts
 * 
 * OpenTelemetry SDK setup with configurable Prometheus port
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const isProduction = process.env.NODE_ENV === 'production';
const enableTraces = process.env.OTEL_ENABLE_TRACES === 'true';

// Get Prometheus port from environment (default: 9464)
const prometheusPort = parseInt(process.env.PROMETHEUS_METRICS_PORT || '9464', 10);
const prometheusEndpoint = process.env.PROMETHEUS_METRICS_ENDPOINT || '/metrics';

// Always enable metrics via Prometheus
const prometheusExporter = new PrometheusExporter(
    {
        port: prometheusPort,
        endpoint: prometheusEndpoint
    },
    () => console.log(`📊 Prometheus metrics: http://localhost:${prometheusPort}${prometheusEndpoint}`),
);

let sdk: NodeSDK | null = null;

// Only start traces if needed
if (isProduction || enableTraces) {
    sdk = new NodeSDK({
        // No trace exporter = no traces logged
        metricReader: prometheusExporter,
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {
                    enabled: true,
                    ignoreIncomingRequestHook: (req) =>
                        ['/health', '/metrics', '/ready', '/live'].includes(req.url ?? ''),
                },
                '@opentelemetry/instrumentation-express': {
                    enabled: isProduction || enableTraces
                },
                '@opentelemetry/instrumentation-fs': { enabled: false },
            }),
        ],
    });

    sdk.start();
    console.log('🔍 OpenTelemetry metrics enabled');
} else {
    // Still start for metrics only
    sdk = new NodeSDK({
        metricReader: prometheusExporter,
        instrumentations: [],
    });
    sdk.start();
    console.log('📊 Prometheus metrics enabled (no traces)');
}

export async function shutdownTelemetry(): Promise<void> {
    if (sdk) {
        await sdk.shutdown();
    }
}