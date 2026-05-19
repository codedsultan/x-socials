import { Router } from 'express';
import { usersController } from './users.controller';
import { validateUpdateProfile } from './users.validator';
import { authenticate, optionalAuthenticate } from '../../shared/middlewares/authenticate';
import { apiLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

router.use(apiLimiter);

/** GET /users — list all users (public) */
router.get('/', usersController.list);

/** GET /users/me — current user's own profile (protected) */
router.get('/me', authenticate, usersController.getMe);

/** PATCH /users/me — update current user's profile (protected) */
router.patch('/me', authenticate, writeLimiter, validateUpdateProfile, usersController.updateMe);

/** GET /users/:id — any user's public profile; isFollowedByMe populated when authenticated */
router.get('/:id', optionalAuthenticate, usersController.getById);

/** POST /users/:id/follow — follow a user (protected) */
router.post('/:id/follow', authenticate, writeLimiter, usersController.follow);

/** DELETE /users/:id/follow — unfollow a user (protected) */
router.delete('/:id/follow', authenticate, writeLimiter, usersController.unfollow);

/** GET /users/:id/followers — who follows this user (public) */
router.get('/:id/followers', usersController.getFollowers);

/** GET /users/:id/following — who this user follows (public) */
router.get('/:id/following', usersController.getFollowing);

export default router;
