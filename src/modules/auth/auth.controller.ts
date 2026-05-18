import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendCreated } from '../../shared/helpers/response';
import type { RegisterDto, LoginDto, RefreshTokenDto } from './auth.types';

export class AuthController {
  private service(req: Request): AuthService {
    if (!req.repoFactory) throw new Error('repoFactory not available');
    return new AuthService(req.repoFactory);
  }

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service(req).register(req.body as RegisterDto);
      sendCreated(res, result, 'Account created successfully');
    } catch (err) {
      next(err);
    }
  };

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await this.service(req).login(req.body as LoginDto);
      sendSuccess(res, result, { message: 'Logged in successfully' });
    } catch (err) {
      next(err);
    }
  };

  refresh = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body as RefreshTokenDto;
      const tokens = await this.service(req).refreshTokens(refreshToken);
      sendSuccess(res, { tokens });
    } catch (err) {
      next(err);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser?.id;
      if (userId) {
        await this.service(req).logout(userId);
      }
      sendSuccess(res, null, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const currentUser = (req as any).currentUser;
      sendSuccess(res, { user: currentUser });
    } catch (err) {
      next(err);
    }
  };
}

export const authController = new AuthController();
