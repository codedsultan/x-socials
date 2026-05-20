import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { ApiError } from '../errors/ApiError';
import ConfigService from '../../config/config.service';
import type { ICurrentUser } from '../types/express';

interface JwtPayload {
  sub:   string;
  email: string;
  iat?:  number;
  exp?:  number;
}

// ─── User JWT authentication ───────────────────────────────────────────────────

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('No token provided'));
    }

    const token = header.slice(7).trim();
    if (!token) return next(ApiError.unauthorized('No token provided'));

    const secret = ConfigService.getServerConfig().JWT_SECRET;
    if (!secret) return next(ApiError.internal('JWT secret not configured'));

    const payload = jwt.verify(token, secret) as JwtPayload;

    (req as any).currentUser = {
      id:    payload.sub,
      email: payload.email,
    } satisfies ICurrentUser;

    // ── Suspension check ─────────────────────────────────────────────────────
    // DB lookup on every authenticated request. Takes effect immediately when
    // an admin suspends a user — no waiting for the JWT to expire.
    // The repoFactory is injected by the repository middleware (runs before routes).
    const repoFactory = (req as any).repoFactory;
    if (repoFactory) {
      const userRepo = repoFactory.getRepository('User');
      userRepo.findById(payload.sub).then((user: any) => {
        if (!user) return next(ApiError.unauthorized('Account not found'));
        if (user.suspended) {
          return next(ApiError.forbidden('Your account has been suspended'));
        }
        next();
      }).catch(next);
    } else {
      next();
    }
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) return next(ApiError.unauthorized('Token has expired'));
    if (err instanceof jwt.JsonWebTokenError)  return next(ApiError.unauthorized('Invalid token'));
    next(err);
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) return next();

  try {
    const token   = header.slice(7).trim();
    const secret  = ConfigService.getServerConfig().JWT_SECRET;
    if (!secret) return next();

    const payload = jwt.verify(token, secret) as JwtPayload;
    (req as any).currentUser = { id: payload.sub, email: payload.email };
  } catch {
    // silently ignore — treat as unauthenticated
  }

  next();
}

// ─── Admin shared-secret + HMAC guard ─────────────────────────────────────────

/**
 * requireAdminKey — protects /api/admin/* endpoints.
 *
 * This is a service-to-service guard. The Laravel admin panel is the only
 * legitimate caller. Human admin users are authenticated by Laravel's own
 * session system — the Node.js API never sees their credentials.
 *
 * ── What it checks ──────────────────────────────────────────────────────────
 *
 * 1. HMAC-SHA256 signature of the canonical request string
 *    Prevents: request forgery, body tampering, key-less replay
 *    Header: X-Admin-Signature: <hex>
 *
 * 2. Request timestamp within ±5 minutes
 *    Prevents: replay attacks (captured request reused after the window)
 *    Header: X-Admin-Timestamp: <Unix seconds as string>
 *
 * 3. Constant-time key comparison
 *    Prevents: timing attacks that probe the key byte-by-byte
 *
 * ── Canonical string ────────────────────────────────────────────────────────
 *
 * HMAC input: "<METHOD>\n<PATH>\n<TIMESTAMP>\n<BODY_SHA256>"
 * where BODY_SHA256 is the hex SHA256 of the raw request body (empty string
 * if the request has no body).
 *
 * ── Key setup ───────────────────────────────────────────────────────────────
 *
 * Node.js .env:   ADMIN_API_KEY=<openssl rand -hex 32>
 * Laravel .env:   XSOCIALS_ADMIN_KEY=<same value>
 *
 * ── Key rotation ────────────────────────────────────────────────────────────
 *
 * To rotate without downtime:
 *   1. Add the new key as ADMIN_API_KEY_NEXT in Node.js .env
 *   2. The middleware accepts signatures from EITHER key (transition window)
 *   3. Update Laravel to use the new key (redeploy Laravel)
 *   4. Remove ADMIN_API_KEY_NEXT from Node.js, set ADMIN_API_KEY = new value
 *   5. Redeploy Node.js — old key is now invalid
 */

/** Maximum age of a request timestamp before it is rejected (seconds). */
const TIMESTAMP_TOLERANCE_S = 5 * 60; // 5 minutes

/** In-memory replay guard — tracks used (timestamp, signature) pairs. */
const usedSignatures = new Map<string, number>();

/** Clean up expired entries from the replay guard every minute. */
setInterval(() => {
  const cutoff = Math.floor(Date.now() / 1000) - TIMESTAMP_TOLERANCE_S;
  for (const [sig, ts] of usedSignatures) {
    if (ts < cutoff) usedSignatures.delete(sig);
  }
}, 60_000).unref();

function buildCanonicalString(
  method:    string,
  path:      string,
  timestamp: string,
  rawBody:   string,
): string {
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  return `${method.toUpperCase()}\n${path}\n${timestamp}\n${bodyHash}`;
}

function computeHmac(secret: string, canonical: string): string {
  return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

/** Constant-time comparison — prevents timing attacks on key material. */
function safeEqual(a: string, b: string): boolean {
  // Pad to same length so timingSafeEqual doesn't throw on length mismatch
  const aBuf = Buffer.from(a.padEnd(64, '\0'));
  const bBuf = Buffer.from(b.padEnd(64, '\0'));
  return crypto.timingSafeEqual(aBuf, bBuf) && a.length === b.length;
}

export function requireAdminKey(req: Request, _res: Response, next: NextFunction): void {
  const primaryKey  = process.env['ADMIN_API_KEY'];
  const rotationKey = process.env['ADMIN_API_KEY_NEXT']; // optional — present during rotation

  if (!primaryKey) {
    return next(ApiError.internal('ADMIN_API_KEY is not configured'));
  }

  // ── 1. Read headers ──────────────────────────────────────────────────────
  const providedSig = req.headers['x-admin-signature'] as string | undefined;
  const timestamp   = req.headers['x-admin-timestamp']  as string | undefined;

  if (!providedSig || !timestamp) {
    return next(ApiError.forbidden('Missing X-Admin-Signature or X-Admin-Timestamp header'));
  }

  // ── 2. Validate timestamp (replay window) ─────────────────────────────────
  const ts  = parseInt(timestamp, 10);
  const now = Math.floor(Date.now() / 1000);

  if (isNaN(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_S) {
    return next(ApiError.forbidden('Request timestamp is outside the acceptable window'));
  }

  // ── 3. Build canonical string and compute expected signature ──────────────
  const rawBody  = (req as any).rawBody ?? '';   // populated by express.json verify callback
  const canonical = buildCanonicalString(req.method, req.path, timestamp, rawBody);

  const expectedPrimary  = computeHmac(primaryKey,  canonical);
  const expectedRotation = rotationKey ? computeHmac(rotationKey, canonical) : null;

  const validPrimary   = safeEqual(providedSig, expectedPrimary);
  const validRotation  = expectedRotation ? safeEqual(providedSig, expectedRotation) : false;

  if (!validPrimary && !validRotation) {
    return next(ApiError.forbidden('Invalid admin request signature'));
  }

  // ── 4. Replay protection — reject if this exact signature has been seen ───
  const replayKey = `${timestamp}:${providedSig}`;
  if (usedSignatures.has(replayKey)) {
    return next(ApiError.forbidden('Replayed request rejected'));
  }
  usedSignatures.set(replayKey, ts);

  next();
}

/** Exported for testing — allows callers to sign a request the same way. */
export { buildCanonicalString, computeHmac };
