// src/instrumentation.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const isProduction = process.env.NODE_ENV === 'production';
const enableTraces = process.env.OTEL_ENABLE_TRACES === 'true';

const prometheusPort = parseInt(process.env.PROMETHEUS_METRICS_PORT || '9464', 10);
const prometheusEndpoint = process.env.PROMETHEUS_METRICS_ENDPOINT || '/metrics';

const prometheusExporter = new PrometheusExporter(
    {
        port: prometheusPort,
        endpoint: prometheusEndpoint
    },
    () => console.log(`📊 Prometheus metrics: http://localhost:${prometheusPort}${prometheusEndpoint}`),
);

// Express instrumentation adds finish listeners per matched layer; only
// enable it when full distributed traces are actually wanted.
const sdk = new NodeSDK({
    metricReader: prometheusExporter,
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-http': {
                enabled: isProduction || enableTraces,
                ignoreIncomingRequestHook: (req) =>
                    ['/health', '/metrics', '/ready', '/live'].includes(req.url ?? ''),
                requestHook: (span, req) => {
                    span.setAttribute('http.method', req.method!);
                },
                requireParentforOutgoingSpans: true,
            },
            // Only enable Express layer tracing when full traces are requested.
            // Without this guard it adds 2+ finish listeners per request even
            // when traces are disabled, pushing ServerResponse past the default
            // 10-listener limit when combined with compression + morgan + monitoring.
            '@opentelemetry/instrumentation-express': {
                enabled: enableTraces,
            },
            '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
    ],
});

sdk.start();
console.log('🔍 OpenTelemetry SDK started');

export async function shutdownTelemetry(): Promise<void> {
    if (sdk) {
        await sdk.shutdown();
    }
}