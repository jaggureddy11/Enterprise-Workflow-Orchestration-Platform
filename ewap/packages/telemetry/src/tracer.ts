// packages/telemetry/src/tracer.ts
// OpenTelemetry initialization per PRD §9.9

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

let sdk: NodeSDK | null = null;

/**
 * Initializes OpenTelemetry SDK. Must be called FIRST in every service's index.ts
 * before any other imports, per PRD §16.1 rule 8.
 */
export function initTelemetry(serviceName: string): void {
  if (sdk) return; // Already initialized

  sdk = new NodeSDK({
    serviceName,
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version ?? '1.0.0',
      'deployment.environment': process.env.NODE_ENV ?? 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318',
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis': { enabled: true },
        '@opentelemetry/instrumentation-http': { enabled: true },
      }),
    ],
  });

  sdk.start();
  console.log(`[Telemetry] OpenTelemetry initialized for service: ${serviceName}`);

  // Graceful shutdown
  const shutdown = async () => {
    if (sdk) {
      await sdk.shutdown();
      sdk = null;
    }
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export { trace, context, SpanStatusCode } from '@opentelemetry/api';
