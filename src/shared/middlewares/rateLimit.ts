import type { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';

interface BucketEntry {
  tokens: number;
  lastRefill: number;
}

const buckets = new Map<string, BucketEntry>();

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
      entry = { tokens: max, lastRefill: now };
      buckets.set(clientId, entry);
    }

    // Refill tokens proportionally to elapsed time
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
