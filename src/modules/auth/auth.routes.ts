import { Router } from 'express';
import { authController } from './auth.controller';
import { validateRegister, validateLogin, validateRefreshToken } from './auth.validator';
import { authenticate } from '../../shared/middlewares/authenticate';
import { authLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

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

export default router;
