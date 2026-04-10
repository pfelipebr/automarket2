import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';

// Só ativa tracing em produção (no GKE as credenciais são detectadas automaticamente)
if (process.env.NODE_ENV === 'production') {
  // Loga erros do SDK/exporter no stdout para facilitar diagnóstico
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'automarket-backend',
      'service.version': '1.0.0',
      'deployment.environment': 'production',
    }),
    traceExporter: new TraceExporter({
      // Passa o projectId explicitamente para evitar falha de auto-detecção
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
    }),
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
  console.log('[OTel] Tracing iniciado → Google Cloud Trace (projeto: ' + process.env.GOOGLE_CLOUD_PROJECT + ')');

  // Garante flush dos spans pendentes antes de encerrar o processo
  process.on('SIGTERM', () => {
    sdk.shutdown().catch((err) => console.error('[OTel] shutdown error', err));
  });
}
