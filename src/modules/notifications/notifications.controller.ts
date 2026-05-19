import type { Request, Response, NextFunction } from 'express';
import { NotificationsService } from './notifications.service';
import { sendSuccess, sendNoContent } from '../../shared/helpers/response';

class NotificationsController {
  private service(req: Request): NotificationsService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new NotificationsService(req.repoFactory);
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const { after, limit = 20, unread } = req.query as any;
      const result = await this.service(req).list(userId, {
        limit:      Number(limit),
        after,
        unreadOnly: unread === 'true',
      });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  unreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const count  = await this.service(req).unreadCount(userId);
      sendSuccess(res, { count });
    } catch (err) {
      next(err);
    }
  };

  markRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const ok     = await this.service(req).markRead(userId, req.params['id'] as string);
      if (!ok) return next(new Error('Notification not found'));
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  markAllRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      await this.service(req).markAllRead(userId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}

export const notificationsController = new NotificationsController();
