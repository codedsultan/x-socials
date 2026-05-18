import { describe, it, expect, vi } from 'vitest';
import { isValidUid, isUidV7 } from '../../../utils/uuid';

// ── fake Knex builder ─────────────────────────────────────────────────────────

function makeQueryBuilder(returnValue: any) {
  const qb: any = {};
  qb.where = vi.fn().mockReturnValue(qb);
  qb.insert = vi.fn().mockReturnValue(qb);
  qb.update = vi.fn().mockReturnValue(qb);
  qb.delete = vi.fn().mockResolvedValue(1);
  qb.returning = vi.fn().mockResolvedValue([returnValue]);
  qb.first = vi.fn().mockResolvedValue(returnValue);
  qb.limit = vi.fn().mockReturnValue(qb);
  qb.offset = vi.fn().mockReturnValue(qb);
  qb.orderBy = vi.fn().mockReturnValue(qb);
  // make qb itself awaitable for .insert() on no-returning path
  qb.then = (resolve: any) => Promise.resolve(undefined).then(resolve);
  return qb;
}

function makeKnex(pgMode: boolean, row: Record<string, unknown>) {
  const qb = makeQueryBuilder(row);
  const db: any = vi.fn().mockReturnValue(qb);
  db.raw = vi.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] });
  db.schema = {
    hasTable: vi.fn().mockResolvedValue(false),
    createTable: vi.fn().mockResolvedValue(undefined),
  };
  db.migrate = { latest: vi.fn(), list: vi.fn() };
  db.destroy = vi.fn().mockResolvedValue(undefined);
  db.transaction = vi.fn();
  db.client = { config: { client: pgMode ? 'pg' : 'mysql2' } };
  return { db, qb };
}

// We test KnexAdapter behaviour through its public interface by mocking knex.
// Because KnexAdapter calls knex() in its constructor, we mock the module.

vi.mock('knex', () => {
  return { default: vi.fn() };
});

import knex from 'knex';

async function makeAdapter(pgMode: boolean, row: Record<string, unknown>) {
  const { db, qb } = makeKnex(pgMode, row);
  (knex as any).mockReturnValue(db);

  // Dynamic import so the mock takes effect
  const { KnexAdapter } = await import('../../../database/adapters/KnexAdapter');
  const adapter = new KnexAdapter(
    { client: pgMode ? 'pg' : 'mysql2', connection: {} as any },
    { skipMigrations: true }
  );

  // Register a fake model so getTableName() resolves
  adapter.registerModel('User', {
    sql: {
      tableName: 'users',
      up: () => {},
    },
  });

  return { adapter, db, qb };
}

// ── uuid tests ────────────────────────────────────────────────────────────────

describe('generateSqlId (uuid util)', () => {
  it('produces a valid UUID v7', async () => {
    const { generateSqlId } = await import('../../../utils/uuid');
    const id = generateSqlId();
    expect(isValidUid(id)).toBe(true);
    expect(isUidV7(id)).toBe(true);
  });

  it('produces unique values on successive calls', async () => {
    const { generateSqlId } = await import('../../../utils/uuid');
    const ids = new Set(Array.from({ length: 100 }, () => generateSqlId()));
    expect(ids.size).toBe(100);
  });

  it('produces lexicographically ascending values (time-ordered)', async () => {
    const { generateSqlId } = await import('../../../utils/uuid');
    const ids = Array.from({ length: 5 }, () => generateSqlId());
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });
});

// ── KnexAdapter.create() ──────────────────────────────────────────────────────

describe('KnexAdapter.create()', () => {
  it('injects a UUID v7 id when none is provided', async () => {
    const row = { id: 'gen-id', email: 'a@b.com', created_at: new Date(), updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(true, row);

    await adapter.create('User', { email: 'a@b.com' });

    const insertArg = qb.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg['id']).toBeDefined();
    expect(isValidUid(String(insertArg['id']))).toBe(true);
  });

  it('injects created_at and updated_at', async () => {
    const row = { id: 'x', created_at: new Date(), updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(true, row);

    const before = Date.now();
    await adapter.create('User', { email: 'a@b.com' });
    const after = Date.now();

    const arg = qb.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(arg['created_at']).toBeInstanceOf(Date);
    const ts = (arg['created_at'] as Date).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 5);
    expect(ts).toBeLessThanOrEqual(after + 5);
  });

  it('uses RETURNING on PostgreSQL (no post-insert SELECT)', async () => {
    const row = { id: 'pg-id', email: 'a@b.com', created_at: new Date(), updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(true, row);

    await adapter.create('User', { email: 'a@b.com' });

    expect(qb.returning).toHaveBeenCalledWith('*');
    // first() should NOT be called on the pg path
    expect(qb.first).not.toHaveBeenCalled();
  });

  it('uses post-insert SELECT on MySQL (no RETURNING)', async () => {
    const row = { id: 'mysql-id', email: 'a@b.com', created_at: new Date(), updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(false, row);

    await adapter.create('User', { email: 'a@b.com' });

    expect(qb.returning).not.toHaveBeenCalled();
    expect(qb.first).toHaveBeenCalled();
  });

  it('allows caller to override the generated id', async () => {
    const row = { id: 'custom-id', email: 'a@b.com', created_at: new Date(), updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(true, row);

    await adapter.create('User', { id: 'custom-id', email: 'a@b.com' });

    const arg = qb.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(arg['id']).toBe('custom-id');
  });
});

// ── KnexAdapter.update() ──────────────────────────────────────────────────────

describe('KnexAdapter.update()', () => {
  it('always injects updated_at into the update payload', async () => {
    const row = { id: 'u1', name: 'Alice', updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(true, row);

    await adapter.update('User', 'u1', { name: 'Bob' });

    const updateArg = qb.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg['updated_at']).toBeInstanceOf(Date);
  });

  it('uses RETURNING on PostgreSQL', async () => {
    const row = { id: 'u1', name: 'Alice', updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(true, row);

    await adapter.update('User', 'u1', { name: 'Bob' });

    expect(qb.returning).toHaveBeenCalledWith('*');
  });

  it('uses post-update SELECT on MySQL', async () => {
    const row = { id: 'u1', name: 'Alice', updated_at: new Date() };
    const { adapter, qb } = await makeAdapter(false, row);

    // MySQL update() returns affected row count
    qb.update = vi.fn().mockResolvedValue(1);

    await adapter.update('User', 'u1', { name: 'Bob' });

    expect(qb.returning).not.toHaveBeenCalled();
    expect(qb.first).toHaveBeenCalled();
  });
});
