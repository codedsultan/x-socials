import { Router } from 'express';
import { likesController } from './likes.controller';
import { validateToggleLike } from './likes.validator';
import { authenticate } from '../../shared/middlewares/authenticate';
import { apiLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

/** POST /likes — toggle like on a post or comment (protected) */
router.post('/', authenticate, writeLimiter, validateToggleLike, likesController.toggle);

/** GET /likes/count — get like count for a target (public) */
router.get('/count', apiLimiter, likesController.getCount);

export default router;
