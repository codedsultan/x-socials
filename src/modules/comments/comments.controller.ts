import type { Request, Response, NextFunction } from 'express';
import { CommentsService } from './comments.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/helpers/response';
import type { CreateCommentDto, UpdateCommentDto } from './comments.types';

class CommentsController {
  private service(req: Request): CommentsService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new CommentsService(req.repoFactory);
  }

  listForPost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { after, before, limit = 20 } = req.query as any;
      const result = await this.service(req).listForPost(
        req.params['postId'] as string,
        { after, before, limit: Number(limit) }
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  getReplies = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { after, before, limit = 20 } = req.query as any;
      const result = await this.service(req).getReplies(
        req.params['id'] as string,
        { after, before, limit: Number(limit) }
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const comment = await this.service(req).createComment(userId, req.params['postId'] as string, req.body as CreateCommentDto);
      sendCreated(res, { comment }, 'Comment added');
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const comment = await this.service(req).updateComment(userId, req.params['id'] as string, req.body as UpdateCommentDto);
      sendSuccess(res, { comment }, { message: 'Comment updated' });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      await this.service(req).deleteComment(userId, req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}

export const commentsController = new CommentsController();
