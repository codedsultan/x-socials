/**
 * shared/helpers/paginate.ts
 *
 * Three pagination strategies available to every module:
 *
 *   1. Offset  — page + limit with a total count.
 *                Best for: user lists, search results, admin views.
 *                Allows random access ("jump to page 7") but expensive on
 *                large collections because the DB must scan to the offset.
 *
 *   2. Cursor  — opaque token (base64-encoded field value) + limit.
 *                Best for: feeds, timelines, infinite scroll.
 *                Stable under inserts — page 2 always starts after the last
 *                item of page 1, regardless of how many new items were added.
 *                No total count (impractical at scale).
 *
 *   3. Keyset  — after/before IDs + limit, no offset scan.
 *                Best for: comment threads, follower lists, any SQL table.
 *                Uses an indexed WHERE id > ? clause — O(1) regardless of
 *                dataset size. Supports bi-directional navigation.
 *
 * All three return the same PagedResult<T> envelope so the client only needs
 * one handler regardless of which strategy the endpoint uses.
 */

import { z } from 'zod';
import { validate } from '../middlewares/validate';

// ─── shared result envelope ───────────────────────────────────────────────────

export interface PageMeta {
  limit: number;
  hasMore: boolean;
  /** Offset only */
  page?: number;
  total?: number;
  totalPages?: number;
  /** Cursor / Keyset */
  nextCursor?: string;
  prevCursor?: string;
}

export interface PagedResult<T> {
  items: T[];
  meta: PageMeta;
}

// ─── 1. Offset pagination ─────────────────────────────────────────────────────

export interface OffsetParams {
  page: number;
  limit: number;
}

export const offsetQuerySchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const validateOffsetQuery = validate(offsetQuerySchema, 'query');

export function parseOffsetParams(
  query: Record<string, unknown>,
  defaults: { limit?: number } = {}
): OffsetParams {
  const limit = Math.min(Number(query['limit']) || defaults.limit || 20, 100);
  const page  = Math.max(Number(query['page'])  || 1, 1);
  return { page, limit };
}

export function offsetToSkip({ page, limit }: OffsetParams): number {
  return (page - 1) * limit;
}

/**
 * Build an offset PagedResult from a pre-fetched items array + total count.
 *
 * Usage:
 *   const [items, total] = await Promise.all([repo.findMany({}, { limit, skip }), repo.count({})]);
 *   return buildOffsetPage(items, total, { page, limit });
 */
export function buildOffsetPage<T>(
  items: T[],
  total: number,
  params: OffsetParams
): PagedResult<T> {
  const { page, limit } = params;
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    meta: {
      page,
      limit,
      total,
      totalPages,
      hasMore: page < totalPages,
    },
  };
}

// ─── 2. Cursor pagination ─────────────────────────────────────────────────────

export interface CursorParams {
  cursor?: string;
  limit: number;
}

export const cursorQuerySchema = z.object({
  cursor: z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
});

export const validateCursorQuery = validate(cursorQuerySchema, 'query');

export function parseCursorParams(
  query: Record<string, unknown>,
  defaults: { limit?: number } = {}
): CursorParams {
  const limit  = Math.min(Number(query['limit']) || defaults.limit || 20, 100);
  const cursor = query['cursor'] ? String(query['cursor']) : undefined;
  return { cursor, limit };
}

/**
 * Encode a field value into an opaque, URL-safe cursor token.
 * Using base64 keeps the implementation detail hidden from clients.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/**
 * Decode a cursor token back to its field value.
 * Returns null for invalid/tampered tokens rather than throwing.
 * Node's Buffer never throws on bad base64 — we validate the output instead.
 */
export function decodeCursor(token: string): string | null {
  if (!token || typeof token !== 'string') return null;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    // Reject empty strings or strings with non-printable / replacement characters
    if (!decoded || /\uFFFD|[\x00-\x08\x0E-\x1F\x7F]/.test(decoded)) return null;
    return decoded;
  } catch {
    return null;
  }
}

/**
 * Build a cursor PagedResult.
 *
 * The caller must fetch limit + 1 items and pass all of them here.
 * We use the extra item to determine hasMore without a separate count query,
 * then discard it before returning to the client.
 *
 * cursorField — the field on T whose value is encoded into the cursor.
 *               Must be the same field used in the findMany sort + after filter.
 *               Defaults to 'id'.
 *
 * Usage (fetch limit+1):
 *   const rawItems = await repo.findMany({}, { limit: limit + 1, after: decodedCursor, sort: { createdAt: -1 } });
 *   return buildCursorPage(rawItems, limit, 'id');
 */
export function buildCursorPage<T extends Record<string, any>>(
  rawItems: T[],
  limit: number,
  cursorField: keyof T = 'id' as keyof T
): PagedResult<T> {
  const hasMore = rawItems.length > limit;
  const items   = hasMore ? rawItems.slice(0, limit) : rawItems;

  const lastItem  = items[items.length - 1];
  const firstItem = items[0];

  return {
    items,
    meta: {
      limit,
      hasMore,
      nextCursor: hasMore && lastItem
        ? encodeCursor(String(lastItem[cursorField]))
        : undefined,
      prevCursor: firstItem
        ? encodeCursor(String(firstItem[cursorField]))
        : undefined,
    },
  };
}

// ─── 3. Keyset pagination ─────────────────────────────────────────────────────

export interface KeysetParams {
  after?:  string;   // ID of the last item on the previous page (exclusive lower bound)
  before?: string;   // ID of the first item on the next page  (exclusive upper bound)
  limit:   number;
}

export const keysetQuerySchema = z.object({
  after:  z.string().optional(),
  before: z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
}).refine(d => !(d.after && d.before), {
  message: 'Provide either "after" or "before", not both',
});

export const validateKeysetQuery = validate(keysetQuerySchema, 'query');

export function parseKeysetParams(
  query: Record<string, unknown>,
  defaults: { limit?: number } = {}
): KeysetParams {
  return {
    after:  query['after']  ? String(query['after'])  : undefined,
    before: query['before'] ? String(query['before']) : undefined,
    limit:  Math.min(Number(query['limit']) || defaults.limit || 20, 100),
  };
}

/**
 * Build a keyset PagedResult (identical limit+1 trick as cursor).
 *
 * Usage:
 *   const rawItems = await repo.findMany({ postId }, {
 *     limit: limit + 1,
 *     after,              // pass through to adapter WHERE id > :after
 *     sort: { id: 1 },
 *   });
 *   return buildKeysetPage(rawItems, limit);
 */
export function buildKeysetPage<T extends Record<string, any>>(
  rawItems: T[],
  limit:    number,
  idField:  keyof T = 'id' as keyof T
): PagedResult<T> {
  const hasMore = rawItems.length > limit;
  const items   = hasMore ? rawItems.slice(0, limit) : rawItems;

  const lastItem  = items[items.length - 1];
  const firstItem = items[0];

  return {
    items,
    meta: {
      limit,
      hasMore,
      nextCursor: hasMore && lastItem  ? String(lastItem[idField])  : undefined,
      prevCursor: firstItem ? String(firstItem[idField]) : undefined,
    },
  };
}

// ─── convenience re-exports ───────────────────────────────────────────────────

/** Keep old callers working during migration */
export function buildPaginationMeta(
  params: OffsetParams,
  total:  number
): { page: number; limit: number; total: number; hasMore: boolean } {
  const { page, limit } = params;
  return { page, limit, total, hasMore: page * limit < total };
}
