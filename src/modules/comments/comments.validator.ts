import { z } from 'zod';
import { validate } from '../../shared/middlewares/validate';

export const createCommentSchema = z.object({
  content:  z.string().min(1, 'Content is required').max(2000),
  parentId: z.string().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000),
});

/**
 * Comments use keyset pagination: ?after=<lastId>&limit=20
 * This avoids OFFSET scans on large threads and is stable under
 * concurrent new comments (which don't shift existing items).
 */
export const commentQuerySchema = z.object({
  after:  z.string().optional(),
  before: z.string().optional(),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
}).refine(d => !(d.after && d.before), {
  message: 'Provide either "after" or "before", not both',
});

export const validateCreateComment  = validate(createCommentSchema);
export const validateUpdateComment  = validate(updateCommentSchema);
export const validateCommentQuery   = validate(commentQuerySchema, 'query');
