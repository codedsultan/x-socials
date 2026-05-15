import type { Request, Response, NextFunction } from 'express';
import { LikesService } from './likes.service';
import { sendSuccess } from '../../shared/helpers/response';
import type { LikeTarget } from './likes.types';

class LikesController {
  private service(req: Request): LikesService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new LikesService(req.repoFactory);
  }

  toggle = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const { targetId, targetType } = req.body as { targetId: string; targetType: LikeTarget };
      const result = await this.service(req).toggle(userId, targetId, targetType);
      sendSuccess(res, result, { message: result.liked ? 'Liked' : 'Unliked' });
    } catch (err) {
      next(err);
    }
  };

  getCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { targetId, targetType } = req.query as { targetId: string; targetType: LikeTarget };
      const count = await this.service(req).getLikeCount(targetId, targetType);
      sendSuccess(res, { count, targetId, targetType });
    } catch (err) {
      next(err);
    }
  };
}

export const likesController = new LikesController();
