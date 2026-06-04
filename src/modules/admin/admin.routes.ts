import { Router } from 'express';
import { adminController } from './admin.controller';
import { requireAdminKey } from '../../shared/middlewares/authenticate';
import { apiLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

/**
 * All admin routes are protected by a shared API key (X-Admin-Key header).
 * These endpoints are called server-to-server by the Laravel admin panel —
 * never directly from a browser or end-user client.
 *
 * The Node.js app does not manage admin users or roles. That is entirely
 * the responsibility of the Laravel admin panel.
 *
 * Set in Node.js .env:   ADMIN_API_KEY=<random 64-char hex>
 * Set in Laravel .env:   XSOCIALS_ADMIN_KEY=<same value>
 */
router.use(requireAdminKey, apiLimiter);

// ── Stats ──────────────────────────────────────────────────────────────────
router.get('/stats', adminController.stats);

// ── Users ──────────────────────────────────────────────────────────────────
router.get('/users',     adminController.listUsers);
router.get('/users/:id', adminController.getUser);

/** PATCH /admin/users/:id/suspend   — suspend a user (revokes tokens immediately) */
router.patch('/users/:id/suspend',   writeLimiter, adminController.suspendUser);

/** PATCH /admin/users/:id/reinstate — lift suspension */
router.patch('/users/:id/reinstate', writeLimiter, adminController.reinstateUser);

// ── Content moderation (privileged deletes) ───────────────────────────────
router.delete('/posts/:id',    writeLimiter, adminController.deletePost);
router.delete('/comments/:id', writeLimiter, adminController.deleteComment);

export default router;
