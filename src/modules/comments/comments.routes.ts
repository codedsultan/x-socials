import { Router } from 'express';
import { commentsController } from './comments.controller';
import { validateCreateComment, validateUpdateComment } from './comments.validator';
import { authenticate } from '../../shared/middlewares/authenticate';
import { apiLimiter, writeLimiter } from '../../shared/middlewares/rateLimit';

const router = Router();

router.use(apiLimiter);

/**
 * Nested routes (mounted at /posts/:postId/comments by ModuleRouter)
 */

/** GET /posts/:postId/comments — list all top-level comments for a post */
router.get('/posts/:postId/comments', commentsController.listForPost);

/** POST /posts/:postId/comments — add a comment to a post */
router.post('/posts/:postId/comments', authenticate, writeLimiter, validateCreateComment, commentsController.create);

/**
 * Standalone comment routes
 */

/** GET /comments/:id/replies — get replies to a comment */
router.get('/comments/:id/replies', commentsController.getReplies);

/** PATCH /comments/:id — edit a comment (author only) */
router.patch('/comments/:id', authenticate, writeLimiter, validateUpdateComment, commentsController.update);

/** DELETE /comments/:id — delete a comment (author only) */
router.delete('/comments/:id', authenticate, writeLimiter, commentsController.delete);

export default router;
