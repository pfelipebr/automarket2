import { createClient } from 'redis';
import { config } from './config';

const redis = createClient({ url: config.redisUrl });

redis.on('error', (err) => {
  console.warn('[Redis] connection error (non-fatal):', err.message);
});

redis.connect().catch((err) => {
  console.warn('[Redis] failed to connect (non-fatal):', err.message);
});

export default redis;
