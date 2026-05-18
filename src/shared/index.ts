// Errors
export { ApiError } from './errors/ApiError';

// Helpers
export { sendSuccess, sendCreated, sendNoContent, sendError } from './helpers/response';
export {
  // types
  type OffsetParams, type CursorParams, type KeysetParams,
  type PagedResult, type PageMeta,
  // offset
  offsetQuerySchema, validateOffsetQuery,
  parseOffsetParams, offsetToSkip, buildOffsetPage,
  // cursor
  cursorQuerySchema, validateCursorQuery,
  parseCursorParams, encodeCursor, decodeCursor, buildCursorPage,
  // keyset
  keysetQuerySchema, validateKeysetQuery,
  parseKeysetParams, buildKeysetPage,
  // legacy compat
  buildPaginationMeta,
} from './helpers/paginate';

// Middlewares
export { authenticate, optionalAuthenticate } from './middlewares/authenticate';
export { rateLimit, authLimiter, apiLimiter, writeLimiter } from './middlewares/rateLimit';
export { validate, paginationSchema, idParamSchema, uuidParamSchema } from './middlewares/validate';

// Types
export type { ICurrentUser, IAuthenticatedRequest, IRequest, IResponse, INext } from './types/express';
