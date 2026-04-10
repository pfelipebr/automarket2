import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { ParentBasedSampler, AlwaysOnSampler, SamplingDecision } from '@opentelemetry/sdk-trace-base';
import type { Sampler, SamplingResult, Context, SpanKind, Attributes as SamplerAttributes, Link } from '@opentelemetry/api';

/** Descarta spans de health-check e readiness probes do K8s para não poluir o Cloud Trace. */
class DropHealthProbesSampler implements Sampler {
  shouldSample(
    _ctx: Context, _traceId: string, _name: string, _kind: SpanKind,
    attrs: SamplerAttributes, _links: Link[],
  ): SamplingResult {
    const url = (attrs?.['http.target'] ?? attrs?.['url.path'] ?? '') as string;
    if (url === '/health' || url === '/ready') {
      return { decision: SamplingDecision.NOT_RECORD };
    }
    return { decision: SamplingDecision.RECORD_AND_SAMPLED };
  }

  toString(): string { return 'DropHealthProbesSampler'; }
}

// Só ativa tracing em produção (no GKE as credenciais são detectadas automaticamente)
if (process.env.NODE_ENV === 'production') {
  // Loga erros do SDK/exporter no stdout para facilitar diagnóstico
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.ERROR);

  const sdk = new NodeSDK({
    sampler: new ParentBasedSampler({ root: new DropHealthProbesSampler() }),
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
