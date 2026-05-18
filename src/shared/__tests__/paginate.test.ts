import { describe, it, expect } from 'vitest';
import {
  parseOffsetParams, offsetToSkip, buildOffsetPage,
  parseCursorParams, encodeCursor, decodeCursor, buildCursorPage,
  parseKeysetParams, buildKeysetPage,
} from '../helpers/paginate';

// ── shared helpers ─────────────────────────────────────────────────────────────

function items(n: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `id-${i + 1}`, value: i + 1 }));
}

// ── 1. Offset ──────────────────────────────────────────────────────────────────

describe('Offset pagination', () => {
  describe('parseOffsetParams()', () => {
    it('returns defaults when query is empty', () => {
      const p = parseOffsetParams({});
      expect(p).toEqual({ page: 1, limit: 20 });
    });

    it('coerces string values', () => {
      expect(parseOffsetParams({ page: '3', limit: '10' })).toEqual({ page: 3, limit: 10 });
    });

    it('clamps limit to 100', () => {
      expect(parseOffsetParams({ limit: '9999' }).limit).toBe(100);
    });

    it('clamps page minimum to 1', () => {
      expect(parseOffsetParams({ page: '-5' }).page).toBe(1);
    });
  });

  describe('offsetToSkip()', () => {
    it('returns 0 for page 1', () => expect(offsetToSkip({ page: 1, limit: 20 })).toBe(0));
    it('returns 20 for page 2 with limit 20', () => expect(offsetToSkip({ page: 2, limit: 20 })).toBe(20));
    it('returns 40 for page 3 with limit 20', () => expect(offsetToSkip({ page: 3, limit: 20 })).toBe(40));
  });

  describe('buildOffsetPage()', () => {
    it('calculates totalPages correctly', () => {
      const result = buildOffsetPage(items(10), 47, { page: 1, limit: 10 });
      expect(result.meta.totalPages).toBe(5);
    });

    it('hasMore is true when not on the last page', () => {
      const result = buildOffsetPage(items(10), 25, { page: 1, limit: 10 });
      expect(result.meta.hasMore).toBe(true);
    });

    it('hasMore is false on the last page', () => {
      const result = buildOffsetPage(items(5), 25, { page: 3, limit: 10 });
      expect(result.meta.hasMore).toBe(false);
    });

    it('includes total and page in meta', () => {
      const result = buildOffsetPage(items(5), 100, { page: 2, limit: 5 });
      expect(result.meta.total).toBe(100);
      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(5);
    });

    it('returns all items unchanged', () => {
      const data = items(3);
      expect(buildOffsetPage(data, 3, { page: 1, limit: 10 }).items).toHaveLength(3);
    });

    it('hasMore false when total equals page * limit exactly', () => {
      const result = buildOffsetPage(items(10), 10, { page: 1, limit: 10 });
      expect(result.meta.hasMore).toBe(false);
    });
  });
});

// ── 2. Cursor ──────────────────────────────────────────────────────────────────

describe('Cursor pagination', () => {
  describe('encodeCursor() / decodeCursor()', () => {
    it('round-trips a plain ID string', () => {
      const id = 'abc-123-def';
      expect(decodeCursor(encodeCursor(id))).toBe(id);
    });

    it('round-trips a MongoDB ObjectId', () => {
      const id = '6849f2a1c3d4e5f6a7b8c9d0';
      expect(decodeCursor(encodeCursor(id))).toBe(id);
    });

    it('encodes to a base64url string (no +/= chars)', () => {
      const token = encodeCursor('some-value');
      expect(token).not.toMatch(/[+/=]/);
    });

    it('returns null for an invalid token', () => {
      expect(decodeCursor('not_valid_base64!!!!')).toBeNull();
    });
  });

  describe('buildCursorPage()', () => {
    it('slices to limit when rawItems has limit+1 items', () => {
      const result = buildCursorPage(items(21), 20);
      expect(result.items).toHaveLength(20);
    });

    it('hasMore is true when rawItems.length > limit', () => {
      expect(buildCursorPage(items(21), 20).meta.hasMore).toBe(true);
    });

    it('hasMore is false when rawItems.length <= limit', () => {
      expect(buildCursorPage(items(15), 20).meta.hasMore).toBe(false);
    });

    it('nextCursor encodes the last item id when hasMore', () => {
      const data = items(21);
      const result = buildCursorPage(data, 20);
      expect(result.meta.nextCursor).toBe(encodeCursor('id-20'));
    });

    it('nextCursor is undefined when no more pages', () => {
      const result = buildCursorPage(items(5), 20);
      expect(result.meta.nextCursor).toBeUndefined();
    });

    it('prevCursor encodes the first item id', () => {
      const data = items(5);
      const result = buildCursorPage(data, 20);
      expect(result.meta.prevCursor).toBe(encodeCursor('id-1'));
    });

    it('returns empty items and no cursors for empty input', () => {
      const result = buildCursorPage([], 20);
      expect(result.items).toHaveLength(0);
      expect(result.meta.nextCursor).toBeUndefined();
      expect(result.meta.prevCursor).toBeUndefined();
    });
  });

  describe('parseCursorParams()', () => {
    it('returns limit 20 and no cursor by default', () => {
      expect(parseCursorParams({})).toEqual({ limit: 20, cursor: undefined });
    });

    it('parses cursor from query', () => {
      const token = encodeCursor('abc');
      const p = parseCursorParams({ cursor: token, limit: '10' });
      expect(p.cursor).toBe(token);
      expect(p.limit).toBe(10);
    });
  });
});

// ── 3. Keyset ──────────────────────────────────────────────────────────────────

describe('Keyset pagination', () => {
  describe('parseKeysetParams()', () => {
    it('returns defaults when query is empty', () => {
      expect(parseKeysetParams({})).toEqual({ after: undefined, before: undefined, limit: 20 });
    });

    it('parses after', () => {
      expect(parseKeysetParams({ after: 'some-id', limit: '10' })).toMatchObject({ after: 'some-id', limit: 10 });
    });

    it('parses before', () => {
      expect(parseKeysetParams({ before: 'some-id' })).toMatchObject({ before: 'some-id' });
    });

    it('clamps limit to 100', () => {
      expect(parseKeysetParams({ limit: '500' }).limit).toBe(100);
    });
  });

  describe('buildKeysetPage()', () => {
    it('slices to limit when rawItems has limit+1 items', () => {
      const result = buildKeysetPage(items(11), 10);
      expect(result.items).toHaveLength(10);
    });

    it('hasMore true when more items exist', () => {
      expect(buildKeysetPage(items(11), 10).meta.hasMore).toBe(true);
    });

    it('hasMore false when fewer items than limit', () => {
      expect(buildKeysetPage(items(7), 10).meta.hasMore).toBe(false);
    });

    it('nextCursor is the last returned item id', () => {
      const result = buildKeysetPage(items(11), 10);
      expect(result.meta.nextCursor).toBe('id-10');
    });

    it('prevCursor is the first returned item id', () => {
      const result = buildKeysetPage(items(11), 10);
      expect(result.meta.prevCursor).toBe('id-1');
    });

    it('nextCursor undefined when no more pages', () => {
      expect(buildKeysetPage(items(5), 10).meta.nextCursor).toBeUndefined();
    });

    it('returns empty items for empty input', () => {
      const result = buildKeysetPage([], 10);
      expect(result.items).toHaveLength(0);
      expect(result.meta.hasMore).toBe(false);
    });

    it('uses a custom idField when specified', () => {
      const data = [{ postId: 'p1', title: 'X' }, { postId: 'p2', title: 'Y' }];
      const result = buildKeysetPage(data, 10, 'postId');
      expect(result.meta.prevCursor).toBe('p1');
    });
  });
});
