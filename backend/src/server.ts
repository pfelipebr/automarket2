import './tracing'; // must be first — registers OTel instrumentation before any other import
import { createApp } from './app';
import { config } from './config';

async function start() {
  const app = await createApp({ logger: true });
  await app.listen({ port: config.port, host: '0.0.0.0' });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
