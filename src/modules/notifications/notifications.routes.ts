import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '../../shared/middlewares/authenticate';
import { apiLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

router.use(authenticate);  // all notification routes require auth
router.use(apiLimiter);

/** GET /notifications — keyset-paginated list (?after=id&limit=20&unread=true) */
router.get('/',        notificationsController.list);

/** GET /notifications/unread-count — badge count */
router.get('/unread-count', notificationsController.unreadCount);

/** PATCH /notifications/:id/read — mark one as read */
router.patch('/:id/read', writeLimiter, notificationsController.markRead);

/** POST /notifications/read-all — mark all as read */
router.post('/read-all', writeLimiter, notificationsController.markAllRead);

export default router;
