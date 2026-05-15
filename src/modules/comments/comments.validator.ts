import { z } from 'zod';
import { validate } from '../../shared/middlewares/validate';

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000),
  parentId: z.string().optional(),
});

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Content is required').max(2000),
});

export const validateCreateComment = validate(createCommentSchema);
export const validateUpdateComment = validate(updateCommentSchema);
