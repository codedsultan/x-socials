import type { Request, Response, NextFunction } from 'express';
import { UsersService } from './users.service';
import { sendSuccess } from '../../shared/helpers/response';
import type { UpdateProfileDto } from './users.types';

class UsersController {
  private service(req: Request): UsersService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new UsersService(req.repoFactory);
  }

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page = 1, limit = 20 } = req.query as any;
      const result = await this.service(req).listUsers({ page: Number(page), limit: Number(limit) });
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  getMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const profile = await this.service(req).getProfile(userId, userId);
      sendSuccess(res, { user: profile });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const viewerUserId = (req as any).currentUser?.id;
      const profile = await this.service(req).getProfile(req.params['id'] as string, viewerUserId);
      sendSuccess(res, { user: profile });
    } catch (err) {
      next(err);
    }
  };

  updateMe = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser.id;
      const profile = await this.service(req).updateProfile(userId, req.body as UpdateProfileDto);
      sendSuccess(res, { user: profile }, { message: 'Profile updated' });
    } catch (err) {
      next(err);
    }
  };

  follow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actingUserId = (req as any).currentUser.id;
      const result = await this.service(req).follow(actingUserId, req.params['id'] as string);
      sendSuccess(res, result, { message: 'Now following' });
    } catch (err) {
      next(err);
    }
  };

  unfollow = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actingUserId = (req as any).currentUser.id;
      const result = await this.service(req).unfollow(actingUserId, req.params['id'] as string);
      sendSuccess(res, result, { message: 'Unfollowed' });
    } catch (err) {
      next(err);
    }
  };

  getFollowers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { after, before, limit = 20 } = req.query as any;
      const result = await this.service(req).getFollowers(
        req.params['id'] as string,
        { after, before, limit: Number(limit) }
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };

  getFollowing = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { after, before, limit = 20 } = req.query as any;
      const result = await this.service(req).getFollowing(
        req.params['id'] as string,
        { after, before, limit: Number(limit) }
      );
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  };
}

export const usersController = new UsersController();
