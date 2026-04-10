/**
 * Redis-backed failure simulation state.
 * Shared across all pod replicas via Redis, with a short local cache
 * to avoid a Redis round-trip on every single request.
 */
import redis from './redis';

const REDIS_KEY = 'automarket:failure';
const CACHE_TTL_MS = 2000; // refresh from Redis at most every 2 s

export interface FailureState {
  failUntil: string;   // ISO date string
  reason: string;
  failureRate: number; // 0.0–1.0 probability of failing each vehicle search request
}

let _cache: { state: FailureState | null; fetchedAt: number } = {
  state: null,
  fetchedAt: 0,
};

export async function getFailureState(): Promise<FailureState | null> {
  const now = Date.now();
  if (now - _cache.fetchedAt < CACHE_TTL_MS) return _cache.state;

  try {
    const raw = await redis.get(REDIS_KEY);
    if (!raw) {
      _cache = { state: null, fetchedAt: now };
      return null;
    }
    const state = JSON.parse(raw) as FailureState;
    if (new Date(state.failUntil) <= new Date()) {
      _cache = { state: null, fetchedAt: now };
      return null;
    }
    _cache = { state, fetchedAt: now };
    return state;
  } catch {
    return _cache.state; // fall back to stale cache on Redis error
  }
}

export async function setFailureState(state: FailureState): Promise<void> {
  const ttlSeconds = Math.ceil((new Date(state.failUntil).getTime() - Date.now()) / 1000) + 5;
  await redis.setEx(REDIS_KEY, ttlSeconds, JSON.stringify(state));
  _cache = { state, fetchedAt: Date.now() };
}

export async function clearFailureState(): Promise<void> {
  await redis.del(REDIS_KEY);
  _cache = { state: null, fetchedAt: Date.now() };
}
