import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import { requireAdminKey, buildCanonicalString, computeHmac } from '../authenticate';

// ── Helpers ───────────────────────────────────────────────────────────────────

const TEST_KEY = 'a'.repeat(64);   // 64-char hex string simulating a real key

function makeTimestamp(offsetSeconds = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSeconds);
}

function sign(key: string, method: string, path: string, timestamp: string, body = ''): string {
  const canonical = buildCanonicalString(method, path, timestamp, body);
  return computeHmac(key, canonical);
}

function makeRequest(overrides: Partial<{
  method:    string;
  path:      string;
  headers:   Record<string, string>;
  rawBody:   string;
}>): Request {
  const ts  = makeTimestamp();
  const sig = sign(TEST_KEY, overrides.method ?? 'GET', overrides.path ?? '/admin/stats', ts, overrides.rawBody ?? '');

  return {
    method:  overrides.method  ?? 'GET',
    path:    overrides.path    ?? '/admin/stats',
    rawBody: overrides.rawBody ?? '',
    headers: {
      'x-admin-timestamp': ts,
      'x-admin-signature': sig,
      ...overrides.headers,
    },
  } as unknown as Request;
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('requireAdminKey (HMAC middleware)', () => {

  beforeEach(() => {
    process.env['ADMIN_API_KEY']      = TEST_KEY;
    delete process.env['ADMIN_API_KEY_NEXT'];
  });

  afterEach(() => {
    delete process.env['ADMIN_API_KEY'];
    delete process.env['ADMIN_API_KEY_NEXT'];
  });

  it('accepts a correctly signed request', () => {
    const req  = makeRequest({});
    const next = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();   // no error argument
  });

  it('rejects when ADMIN_API_KEY is not configured', () => {
    delete process.env['ADMIN_API_KEY'];
    const req  = makeRequest({});
    const next = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 500 }));
  });

  it('rejects when X-Admin-Signature header is missing', () => {
    const req  = makeRequest({ headers: { 'x-admin-signature': '' } });
    const next = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects when X-Admin-Timestamp header is missing', () => {
    const req  = makeRequest({ headers: { 'x-admin-timestamp': '' } });
    const next = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects a request with a stale timestamp (> 5 minutes old)', () => {
    const staleTs = makeTimestamp(-6 * 60);  // 6 minutes ago
    const sig     = sign(TEST_KEY, 'GET', '/admin/stats', staleTs);
    const req     = makeRequest({ headers: { 'x-admin-timestamp': staleTs, 'x-admin-signature': sig } });
    const next    = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('accepts a request with a timestamp 4 minutes old (within window)', () => {
    const ts   = makeTimestamp(-4 * 60);
    const sig  = sign(TEST_KEY, 'GET', '/admin/stats', ts);
    const req  = makeRequest({ headers: { 'x-admin-timestamp': ts, 'x-admin-signature': sig } });
    const next = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('rejects a tampered signature', () => {
    const ts  = makeTimestamp();
    const req = makeRequest({
      headers: {
        'x-admin-timestamp': ts,
        'x-admin-signature': 'deadbeef'.repeat(8),   // wrong
      },
    });
    const next = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects when signature is correct but body was tampered', () => {
    const ts       = makeTimestamp();
    const origSig  = sign(TEST_KEY, 'DELETE', '/admin/posts/abc', ts, '');
    const req      = {
      method:  'DELETE',
      path:    '/admin/posts/abc',
      rawBody: 'injected body content',  // different from what was signed
      headers: { 'x-admin-timestamp': ts, 'x-admin-signature': origSig },
    } as unknown as Request;
    const next = makeNext();
    requireAdminKey(req, {} as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it('rejects a replayed request (same signature used twice)', () => {
    // Use a timestamp distinct from other tests to avoid Map pollution
    const ts  = makeTimestamp(10);
    const sig = sign(TEST_KEY, 'GET', '/admin/replay-test', ts);
    const req = {
      method: 'GET', path: '/admin/replay-test', rawBody: '',
      headers: { 'x-admin-timestamp': ts, 'x-admin-signature': sig },
    } as unknown as Request;

    // First call — succeeds
    const next1 = makeNext();
    requireAdminKey(req, {} as Response, next1);
    expect(next1).toHaveBeenCalledWith();

    // Second call — same timestamp+signature — replay rejected
    const next2 = makeNext();
    requireAdminKey(req, {} as Response, next2);
    expect(next2).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  describe('key rotation', () => {
    it('accepts a request signed with ADMIN_API_KEY_NEXT during rotation', () => {
      const newKey = 'b'.repeat(64);
      process.env['ADMIN_API_KEY_NEXT'] = newKey;

      const ts  = makeTimestamp();
      const sig = sign(newKey, 'GET', '/admin/stats', ts);
      const req = makeRequest({ headers: { 'x-admin-timestamp': ts, 'x-admin-signature': sig } });

      const next = makeNext();
      requireAdminKey(req, {} as Response, next);
      expect(next).toHaveBeenCalledWith();   // accepted via rotation key
    });

    it('still accepts the primary key during rotation window', () => {
      process.env['ADMIN_API_KEY_NEXT'] = 'b'.repeat(64);

      // Use a distinct path+timestamp so this request isn't in the replay cache
      const ts  = makeTimestamp(20);
      const sig = sign(TEST_KEY, 'GET', '/admin/rotation-primary-test', ts);
      const req = {
        method: 'GET', path: '/admin/rotation-primary-test', rawBody: '',
        headers: { 'x-admin-timestamp': ts, 'x-admin-signature': sig },
      } as unknown as Request;

      const next = makeNext();
      requireAdminKey(req, {} as Response, next);
      expect(next).toHaveBeenCalledWith();
    });

    it('rejects a request signed with an unrelated key even during rotation', () => {
      const unknownKey = 'c'.repeat(64);
      process.env['ADMIN_API_KEY_NEXT'] = 'b'.repeat(64);

      const ts  = makeTimestamp();
      const sig = sign(unknownKey, 'GET', '/admin/stats', ts);
      const req = makeRequest({ headers: { 'x-admin-timestamp': ts, 'x-admin-signature': sig } });

      const next = makeNext();
      requireAdminKey(req, {} as Response, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
    });
  });

  describe('canonical string covers method, path, timestamp, and body', () => {
    it('different method produces different signature', () => {
      const ts   = makeTimestamp();
      const sig1 = sign(TEST_KEY, 'GET',    '/admin/stats', ts);
      const sig2 = sign(TEST_KEY, 'DELETE', '/admin/stats', ts);
      expect(sig1).not.toBe(sig2);
    });

    it('different path produces different signature', () => {
      const ts   = makeTimestamp();
      const sig1 = sign(TEST_KEY, 'DELETE', '/admin/posts/abc', ts);
      const sig2 = sign(TEST_KEY, 'DELETE', '/admin/posts/xyz', ts);
      expect(sig1).not.toBe(sig2);
    });

    it('different body produces different signature', () => {
      const ts   = makeTimestamp();
      const sig1 = sign(TEST_KEY, 'POST', '/admin/analyse', ts, '{"id":"c1"}');
      const sig2 = sign(TEST_KEY, 'POST', '/admin/analyse', ts, '{"id":"c2"}');
      expect(sig1).not.toBe(sig2);
    });
  });

});
