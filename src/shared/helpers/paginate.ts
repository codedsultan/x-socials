export interface OffsetPaginationParams {
  page: number;
  limit: number;
}

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
}

export function parseOffsetParams(
  query: Record<string, unknown>,
  defaults: { limit?: number } = {}
): OffsetPaginationParams {
  const limit = Math.min(Number(query['limit']) || defaults.limit || 20, 100);
  const page = Math.max(Number(query['page']) || 1, 1);
  return { page, limit };
}

export function offsetToSkip({ page, limit }: OffsetPaginationParams): number {
  return (page - 1) * limit;
}

export function buildPaginationMeta(
  params: OffsetPaginationParams,
  total: number
): { page: number; limit: number; total: number; hasMore: boolean } {
  const { page, limit } = params;
  return {
    page,
    limit,
    total,
    hasMore: page * limit < total,
  };
}

export function parseCursorParams(
  query: Record<string, unknown>,
  defaults: { limit?: number } = {}
): CursorPaginationParams {
  const limit = Math.min(Number(query['limit']) || defaults.limit || 20, 100);
  const cursor = query['cursor'] ? String(query['cursor']) : undefined;
  return { cursor, limit };
}
