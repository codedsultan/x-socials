import type { Request, Response, NextFunction } from 'express';
import { AdminService } from './admin.service';
import { sendSuccess, sendNoContent } from '../../shared/helpers/response';
import { parseOffsetParams } from '../../shared/helpers/paginate';

class AdminController {
  private service(req: Request): AdminService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new AdminService(req.repoFactory);
  }

  stats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, { stats: await this.service(req).getStats() });
    } catch (err) { next(err); }
  };

  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service(req).listUsers(parseOffsetParams(req.query as any));
      sendSuccess(res, result);
    } catch (err) { next(err); }
  };

  getUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, { user: await this.service(req).getUser(req.params['id'] as string) });
    } catch (err) { next(err); }
  };

  suspendUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service(req).suspendUser(req.params['id'] as string);
      sendSuccess(res, { user }, { message: 'User suspended' });
    } catch (err) { next(err); }
  };

  reinstateUser = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.service(req).reinstateUser(req.params['id'] as string);
      sendSuccess(res, { user }, { message: 'User reinstated' });
    } catch (err) { next(err); }
  };

  deletePost = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service(req).deletePost(req.params['id'] as string);
      sendNoContent(res);
    } catch (err) { next(err); }
  };

  deleteComment = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service(req).deleteComment(req.params['id'] as string);
      sendNoContent(res);
    } catch (err) { next(err); }
  };
}

export const adminController = new AdminController();
