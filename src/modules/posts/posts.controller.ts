import type { Request, Response, NextFunction } from 'express';
import { PostsService } from './posts.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/helpers/response';
import type { CreatePostDto, UpdatePostDto } from './posts.types';

class PostsController {
  private service(req: Request): PostsService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new PostsService(req.repoFactory);
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, tag, authorId, cursor } = req.query as any;
      const result = await this.service(req).listPosts({
        page: page ? Number(page) : 1,
        limit: Number(limit ?? 20),
        tag,
        authorId,
        cursor,
      });
      // result is a PagedResult — { items, meta }
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const post = await this.service(req).getPost(req.params['id'] as string);
      sendSuccess(res, { post });
    } catch (err) {
      next(err);
    }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const post = await this.service(req).createPost(userId, req.body as CreatePostDto);
      sendCreated(res, { post }, 'Post created');
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const post = await this.service(req).updatePost(userId, req.params['id'] as string, req.body as UpdatePostDto);
      sendSuccess(res, { post }, { message: 'Post updated' });
    } catch (err) {
      next(err);
    }
  };

  delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      await this.service(req).deletePost(userId, req.params['id'] as string);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}

export const postsController = new PostsController();
