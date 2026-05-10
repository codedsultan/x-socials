/**
 * src/instrumentation.ts
 *
 * OpenTelemetry SDK setup. Import this at the very top of src/index.ts
 * BEFORE any other imports so instrumentation patches load first:
 *
 *   import './instrumentation';
 *   import express from 'express';
 *   ...
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { ConsoleSpanExporter, BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

const IGNORE_PATHS = ['/health', '/metrics', '/ready', '/live'];

// Prometheus scrape endpoint runs on a separate port (default 9464) so it's
// never mixed into your app traffic and doesn't need auth middleware.
const prometheusExporter = new PrometheusExporter(
    { port: 9464, endpoint: '/metrics' },
    () => console.log('📊 Prometheus scrape endpoint: http://localhost:9464/metrics'),
);

// const sdk = new NodeSDK({
//     // Swap ConsoleSpanExporter for an OTLP exporter when you have a collector:
//     //   import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
//     //   spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())]
//     spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
//     metricReader: prometheusExporter,
//     instrumentations: [
//         getNodeAutoInstrumentations({
//             '@opentelemetry/instrumentation-http': {
//                 enabled: true,
//                 // Filter probe/metrics paths from traces so they don't add noise
//                 ignoreIncomingRequestHook: (req) =>
//                     IGNORE_PATHS.includes(req.url ?? ''),
//             },
//             '@opentelemetry/instrumentation-express': {
//                 enabled: true,
//                 // ignoreLayers filters by layer *type* ('router', 'middleware', etc.),
//                 // not by path — path filtering belongs on the HTTP instrumentation above.
//             },
//             // Disable noisy fs instrumentation unless you specifically need it
//             '@opentelemetry/instrumentation-fs': {
//                 enabled: false,
//             },
//         }),
//     ],
// });

// const isProduction = !['development', 'test'].includes(process.env.NODE_ENV ?? '');

// if (isProduction) {
//     sdk.start();
//     console.log('🔍 OpenTelemetry SDK started');
// } else {
//     console.log('⚙️  OpenTelemetry SDK skipped in', process.env.NODE_ENV, 'mode');
// }

// process.on('SIGTERM', () => {
//     sdk.shutdown()
//         .then(() => console.log('OTel SDK shut down cleanly'))
//         .catch((err) => console.error('Error shutting down OTel SDK', err))
//         .finally(() => process.exit(0));
// });

// At the end of instrumentation.ts
const isProduction = !['development', 'test'].includes(process.env.NODE_ENV ?? '');

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
                '@opentelemetry/instrumentation-express': {
                    enabled: true,
                },
                '@opentelemetry/instrumentation-fs': {
                    enabled: false,
                },
            }),
        ],
    });

    sdk.start();
    console.log('🔍 OpenTelemetry SDK started');
} else {
    console.log('⚙️  OpenTelemetry SDK skipped in', process.env.NODE_ENV, 'mode');
}

// Proper shutdown handling
const shutdown = async () => {
    if (sdk) {
        await sdk.shutdown();
        console.log('OTel SDK shut down cleanly');
    }
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);