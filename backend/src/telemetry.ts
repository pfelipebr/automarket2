import { trace, SpanStatusCode, SpanKind, context, type Span, type Attributes } from '@opentelemetry/api';

export const tracer = trace.getTracer('automarket', '1.0.0');

/**
 * Executa fn dentro de um span nomeado.
 * Grava exceções e define o status automaticamente.
 */
export async function withSpan<T>(
  name: string,
  attributes: Attributes,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(
    name,
    { kind: SpanKind.INTERNAL, attributes },
    async (span) => {
      try {
        const result = await fn(span);
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (err) {
        span.recordException(err as Error);
        span.setStatus({ code: SpanStatusCode.ERROR, message: (err as Error).message });
        throw err;
      } finally {
        span.end();
      }
    },
  );
}

/** Adiciona atributos ao span ativo atual (se existir). */
export function setSpanAttrs(attrs: Attributes): void {
  const span = trace.getActiveSpan();
  if (span) span.setAttributes(attrs);
}
