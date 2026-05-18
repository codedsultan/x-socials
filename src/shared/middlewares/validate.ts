import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
import { ApiError } from '../errors/ApiError';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Returns a middleware that validates req[target] against the given Zod schema.
 * On failure, calls next(ApiError.badRequest) with the first validation message.
 * On success, replaces req[target] with the parsed (coerced + stripped) value.
 */
export function validate<T>(schema: ZodSchema<T>, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse((req as any)[target]);
    if (!result.success) {
      const issues = result.error.issues ?? (result.error as any).errors ?? [];
      const first = issues[0];
      const field = first?.path?.join('.') || 'input';
      const msg = first?.message ?? 'Validation error';
      return next(ApiError.badRequest(`${field}: ${msg}`));
    }
    (req as any)[target] = result.data;
    next();
  };
}

// ─── Common reusable schemas ────────────────────────────────────────────────

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const idParamSchema = z.object({
  id: z.string().min(1, 'ID is required'),
});

export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});
