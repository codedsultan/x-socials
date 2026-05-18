import { z } from 'zod';
import { validate } from '../../shared/middlewares/validate';

export const createPostSchema = z.object({
  title:   z.string().min(3, 'Title must be at least 3 characters').max(200),
  content: z.string().min(1, 'Content is required').max(10_000),
  tags:    z.array(z.string().max(50)).max(10).optional().default([]),
});

export const updatePostSchema = z.object({
  title:   z.string().min(3).max(200).optional(),
  content: z.string().min(1).max(10_000).optional(),
  tags:    z.array(z.string().max(50)).max(10).optional(),
});

/**
 * Post list query supports two pagination modes determined by the presence
 * of `cursor` in the query string:
 *
 *   Offset mode  (default)  — ?page=2&limit=20
 *   Cursor mode  (timeline) — ?cursor=<token>&limit=20
 *
 * Filter params (tag, authorId) always use offset mode because the total
 * count is meaningful for filtered result sets.
 */
export const postQuerySchema = z.object({
  // Shared
  limit:    z.coerce.number().int().min(1).max(100).default(20),
  tag:      z.string().optional(),
  authorId: z.string().optional(),
  // Offset
  page:     z.coerce.number().int().min(1).default(1).optional(),
  // Cursor
  cursor:   z.string().optional(),
});

export const validateCreatePost = validate(createPostSchema);
export const validateUpdatePost  = validate(updatePostSchema);
export const validatePostQuery   = validate(postQuerySchema, 'query');
