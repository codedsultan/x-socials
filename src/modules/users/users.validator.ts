import { z } from 'zod';
import { validate } from '../../shared/middlewares/validate';

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
});

export const validateUpdateProfile = validate(updateProfileSchema);
