import { z } from 'zod';
import { validate } from '../../shared/middlewares/validate';

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const requestOtpSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
});

export const verifyEmailSchema = z.object({
  code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Code must be numeric'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Code must be numeric'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const validateRegister = validate(registerSchema);
export const validateLogin = validate(loginSchema);
export const validateRefreshToken = validate(refreshTokenSchema);
export const validateRequestOtp = validate(requestOtpSchema);
export const validateVerifyEmail = validate(verifyEmailSchema);
export const validateResetPassword = validate(resetPasswordSchema);
