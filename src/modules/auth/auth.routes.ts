import { Router } from 'express';
import { authController } from './auth.controller';
import {
    validateRegister,
    validateLogin,
    validateRefreshToken,
    validateRequestOtp,
    validateVerifyEmail,
    validateResetPassword,
} from './auth.validator';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

// ─── Core auth ───────────────────────────────────────────────────────────────
/**
 * POST /auth/register
 * Public — creates a new user account and returns tokens
 */
router.post('/register', authLimiter, validateRegister, authController.register);

/**
 * POST /auth/login
 * Public — authenticates credentials and returns tokens
 */
router.post('/login', authLimiter, validateLogin, authController.login);

/**
 * POST /auth/refresh
 * Public — rotates refresh token and returns a new token pair
 */
router.post('/refresh', writeLimiter, validateRefreshToken, authController.refresh);

/**
 * POST /auth/logout
 * Protected — revokes all refresh tokens for the current user
 */
router.post('/logout', authenticate, authController.logout);

/**
 * GET /auth/me
 * Protected — returns the current authenticated user
 */
router.get('/me', authenticate, authController.me);


// ─── Email verification ───────────────────────────────────────────────────────
// POST /auth/email/request  — resend verification OTP (protected)
// POST /auth/email/verify   — submit OTP code (protected)

router.post('/email/request', authLimiter, authenticate, authController.requestEmailVerification);
router.post('/email/verify', authLimiter, authenticate, validateVerifyEmail, authController.verifyEmail);

// ─── Password reset ───────────────────────────────────────────────────────────
// POST /auth/password/forgot — request reset OTP (public)
// POST /auth/password/reset  — submit code + new password (public)

router.post('/password/forgot', authLimiter, validateRequestOtp, authController.requestPasswordReset);
router.post('/password/reset', authLimiter, validateResetPassword, authController.resetPassword);


export default router;
