import { z } from 'zod';
import { validate } from '../../shared/middlewares/validate';

export const toggleLikeSchema = z.object({
  targetId: z.string().min(1, 'targetId is required'),
  targetType: z.enum(['post', 'comment'] as const, { error: 'targetType must be "post" or "comment"' }),
});

export const validateToggleLike = validate(toggleLikeSchema);
