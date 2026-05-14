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

let sdk: NodeSDK | null = null;

// Create SDK with optimized settings
if (isProduction || enableTraces) {
    sdk = new NodeSDK({
        metricReader: prometheusExporter,
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {
                    enabled: true,
                    // Ignore health check endpoints
                    ignoreIncomingRequestHook: (req) =>
                        ['/health', '/metrics', '/ready', '/live'].includes(req.url ?? ''),
                    // Add request hook to reduce overhead
                    requestHook: (span, req) => {
                        // Only add minimal attributes
                        span.setAttribute('http.method', req.method!);
                    },
                    // Disable detailed timing if not needed
                    requireParentforOutgoingSpans: true,
                },
                '@opentelemetry/instrumentation-express': {
                    enabled: isProduction || enableTraces,
                    // Disable automatic span creation for all routes (reduces listeners)
                    ignoreLayers: enableTraces ? [] : ['middleware', 'request_handler'],
                },
                '@opentelemetry/instrumentation-fs': { enabled: false },
            }),
        ],
    });
} else {
    // Metrics-only mode with minimal overhead
    sdk = new NodeSDK({
        metricReader: prometheusExporter,
        instrumentations: [
            getNodeAutoInstrumentations({
                '@opentelemetry/instrumentation-http': {
                    enabled: false // Disable HTTP instrumentation in dev
                },
                '@opentelemetry/instrumentation-express': { enabled: false },
            }),
        ],
    });
}

sdk.start();
console.log('🔍 OpenTelemetry SDK started');

export async function shutdownTelemetry(): Promise<void> {
    if (sdk) {
        await sdk.shutdown();
    }
}