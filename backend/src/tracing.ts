import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { resourceFromAttributes } from '@opentelemetry/resources';

// Só ativa tracing em produção (no GKE as credenciais são detectadas automaticamente)
if (process.env.NODE_ENV === 'production') {
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'automarket-backend',
      'service.version': '1.0.0',
      'deployment.environment': 'production',
    }),
    traceExporter: new TraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Desabilita instrumentações muito ruidosas que geram spans desnecessários
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
      }),
    ],
  });

  sdk.start();

  // Garante flush dos spans pendentes antes de encerrar o processo
  process.on('SIGTERM', () => {
    sdk.shutdown().catch((err) => console.error('OTel shutdown error', err));
  });
}
