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
 * The interface stays identical — only this file changes.
 */

interface BucketEntry {
  tokens: number;
  lastRefill: number;
  lastSeen: number;
}

const buckets = new Map<string, BucketEntry>();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  const stale = now - CLEANUP_INTERVAL_MS;
  for (const [key, entry] of buckets) {
    if (entry.lastSeen < stale) buckets.delete(key);
  }
}, CLEANUP_INTERVAL_MS).unref();

function getClientId(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0]!.trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

interface RateLimitOptions {
  max: number;
  windowMs: number;
  message?: string;
}

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

    const elapsed = now - entry.lastRefill;
    const refill = Math.floor((elapsed / windowMs) * max);
    if (refill > 0) {
      entry.tokens = Math.min(max, entry.tokens + refill);
      entry.lastRefill = now;
    }

    if (entry.tokens <= 0) {
      return next(ApiError.tooManyRequests(message));
    }

    entry.tokens -= 1;
    next();
  };
}

export const authLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60 * 1000,
  message: 'Too many auth attempts, please try again later',
});

export const apiLimiter = rateLimit({
  max: 100,
  windowMs: 60 * 1000,
});

export const writeLimiter = rateLimit({
  max: 30,
  windowMs: 60 * 1000,
});