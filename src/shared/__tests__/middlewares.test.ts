import { describe, it, expect, vi } from 'vitest';
import { authenticate } from '../middlewares/authenticate';
import { validate } from '../middlewares/validate';
import { z } from 'zod';

// Stub ConfigService
vi.mock('../../config/config.service', () => ({
  default: {
    getServerConfig: () => ({
      JWT_SECRET: 'test-secret-at-least-32-characters-long!!',
    }),
  },
}));

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReq(overrides: Record<string, any> = {}) {
  return { headers: {}, ...overrides } as any;
}
function makeRes() {
  return {} as any;
}
function makeNext() {
  return vi.fn();
}

// ── authenticate ──────────────────────────────────────────────────────────────

describe('authenticate middleware', () => {
  it('calls next(ApiError 401) when no Authorization header', () => {
    const req = makeReq();
    const next = makeNext();
    authenticate(req, makeRes(), next);
    expect(next).toHaveBeenCalledOnce();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('calls next(ApiError 401) for non-Bearer scheme', () => {
    const req = makeReq({ headers: { authorization: 'Basic abc' } });
    const next = makeNext();
    authenticate(req, makeRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('calls next(ApiError 401) for an invalid JWT', () => {
    const req = makeReq({ headers: { authorization: 'Bearer not.a.real.jwt' } });
    const next = makeNext();
    authenticate(req, makeRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 401 });
  });

  it('populates req.currentUser and calls next() for a valid JWT', async () => {
    // Generate a real JWT with the test secret
    const jwt = await import('jsonwebtoken');
    const token = jwt.sign(
      { sub: 'user-123', email: 'a@b.com' },
      'test-secret-at-least-32-characters-long!!'
    );
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } });
    const next = makeNext();
    authenticate(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith(); // no error arg
    expect(req.currentUser).toMatchObject({ id: 'user-123', email: 'a@b.com' });
  });
});

// ── validate ──────────────────────────────────────────────────────────────────

describe('validate middleware', () => {
  const schema = z.object({ name: z.string().min(2), age: z.coerce.number().int().min(0) });
  const mw = validate(schema);

  it('calls next() with no error on valid body', () => {
    const req = makeReq({ body: { name: 'Alice', age: 30 } });
    const next = makeNext();
    mw(req, makeRes(), next);
    expect(next).toHaveBeenCalledWith();
  });

  it('replaces req.body with the parsed (coerced) value', () => {
    const req = makeReq({ body: { name: 'Alice', age: '30' } });
    const next = makeNext();
    mw(req, makeRes(), next);
    expect(req.body.age).toBe(30); // string → number coercion
  });

  it('calls next(ApiError 400) on invalid body', () => {
    const req = makeReq({ body: { name: 'A', age: 25 } }); // name too short
    const next = makeNext();
    mw(req, makeRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });

  it('validates query params when target=query', () => {
    const qMw = validate(z.object({ page: z.coerce.number().int().min(1) }), 'query');
    const req = makeReq({ query: { page: '-5' } });
    const next = makeNext();
    qMw(req, makeRes(), next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 400 });
  });
});
