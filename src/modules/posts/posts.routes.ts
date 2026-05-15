import { Router } from 'express';
import { postsController } from './posts.controller';
import { validateCreatePost, validateUpdatePost, validatePostQuery } from './posts.validator';
import { authenticate, optionalAuthenticate } from '../../shared/middlewares/authenticate';
import { apiLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

router.use(apiLimiter);

/** GET /posts — list posts (public, optional auth for extra context) */
router.get('/', optionalAuthenticate, validatePostQuery, postsController.list);

/** GET /posts/:id — single post (public) */
router.get('/:id', optionalAuthenticate, postsController.getById);

/** POST /posts — create a post (protected) */
router.post('/', authenticate, writeLimiter, validateCreatePost, postsController.create);

/** PATCH /posts/:id — update a post (protected, author only) */
router.patch('/:id', authenticate, writeLimiter, validateUpdatePost, postsController.update);

/** DELETE /posts/:id — delete a post (protected, author only) */
router.delete('/:id', authenticate, writeLimiter, postsController.delete);

export default router;
