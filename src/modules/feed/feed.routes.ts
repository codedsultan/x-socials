import { Router } from 'express';
import { feedController } from './feed.controller';
import { optionalAuthenticate } from '../../shared/middlewares/authenticate';
import { apiLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

router.use(apiLimiter);

/** GET /feed — home feed, newest first, with likedByMe when authenticated */
router.get('/', optionalAuthenticate, feedController.home);

/** GET /feed/users/:userId — posts by a specific user */
router.get('/users/:userId', optionalAuthenticate, feedController.userFeed);

export default router;
