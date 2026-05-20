import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';

/**
 * Token-bucket rate limiter — in-memory, single-process.
 *
 * ⚠️  Production note: this store is process-local. In multi-process
 * deployments (PM2 cluster, multiple containers) each process has its own
 * bucket, so the effective limit is max × workers.
 *
 * To harden for production, replace `buckets` with a Redis client:
 *   const count = await redis.incr(`rl:${clientId}`);
 *   if (count === 1) await redis.expire(`rl:${clientId}`, windowMs / 1000);
 *   if (count > max) return next(ApiError.tooManyRequests());
 *
 * The interface for the middleware factory (rateLimit, authLimiter, etc.)
 * stays identical — only this file changes.
 */

interface BucketEntry {
  tokens:     number;
  lastRefill: number;
  lastSeen:   number; // for cleanup — evict stale entries every 10 minutes
}

const buckets   = new Map<string, BucketEntry>();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

// Periodically evict client entries that haven't been seen for > 10 minutes
// to prevent the map from growing unboundedly on long-running processes.
setInterval(() => {
  const now  = Date.now();
  const stale = now - CLEANUP_INTERVAL_MS;
  for (const [key, entry] of buckets) {
    if (entry.lastSeen < stale) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref(); // unref() so this timer doesn't prevent process exit

function getClientId(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0]!.trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

interface RateLimitOptions {
  /** Maximum requests per window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Error message */
  message?: string;
}

/**
 * Token-bucket rate limiter (in-memory).
 * Safe for single-process deployments. For multi-process/Redis, swap the store.
 */
export function rateLimit(options: RateLimitOptions) {
  const { max, windowMs, message = 'Too many requests, please try again later' } = options;

  return (req: Request, _res: Response, next: NextFunction): void => {
    const clientId = getClientId(req);
    const now = Date.now();

    let entry = buckets.get(clientId);

    if (!entry) {
      entry = { tokens: max, lastRefill: now, lastSeen: now };
      buckets.set(clientId, entry);
    }

    entry.lastSeen = now;

    // Refill tokens proportionally to elapsed time
    const elapsed = now - entry.lastRefill;
    const refill  = Math.floor((elapsed / windowMs) * max);
    if (refill > 0) {
      entry.tokens    = Math.min(max, entry.tokens + refill);
      entry.lastRefill = now;
    }

    if (entry.tokens <= 0) {
      return next(ApiError.tooManyRequests(message));
    }

    entry.tokens -= 1;
    next();
  };
}

// Pre-configured limiters for common scenarios
export const authLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000, // 10 attempts per 15 minutes
  message: 'Too many auth attempts, please try again later',
});

export const apiLimiter = rateLimit({
  max: 100,
  windowMs: 60 * 1000, // 100 requests per minute
});

export const writeLimiter = rateLimit({
  max: 30,
  windowMs: 60 * 1000, // 30 writes per minute
});
