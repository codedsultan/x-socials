import type { Request, Response, NextFunction } from 'express';
import { FeedService } from './feed.service';
import { sendSuccess } from '../../shared/helpers/response';

class FeedController {
  private service(req: Request): FeedService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new FeedService(req.repoFactory);
  }

  home = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cursor, limit = 20 } = req.query as any;
      const viewerUserId = (req as any).currentUser?.id;
      const result = await this.service(req).getHomeFeed({
        limit: Number(limit),
        cursor,
        viewerUserId,
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  userFeed = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { cursor, limit = 20 } = req.query as any;
      const viewerUserId = (req as any).currentUser?.id;
      const result = await this.service(req).getUserFeed(
        req.params['userId'] as string,
        { limit: Number(limit), cursor, viewerUserId }
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}

export const feedController = new FeedController();
