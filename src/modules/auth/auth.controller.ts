import type { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess, sendCreated, sendNoContent } from '../../shared/helpers/response';
import type {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  RequestOtpDto,
  VerifyOtpDto,
  ResetPasswordDto,
} from './auth.types';

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
      if (userId) await this.service(req).logout(userId);
      sendSuccess(res, null, { message: 'Logged out successfully' });
    } catch (err) {
      next(err);
    }
  };

  me = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      sendSuccess(res, { user: (req as any).currentUser });
    } catch (err) {
      next(err);
    }
  };

  // ─── Email verification ──────────────────────────────────────────────────

  requestEmailVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser?.id;
      await this.service(req).requestEmailVerification(userId);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as any).currentUser?.id;
      const { code } = req.body as { code: string };
      await this.service(req).verifyEmail({ userId, code } as VerifyOtpDto);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  // ─── Password reset ──────────────────────────────────────────────────────

  requestPasswordReset = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service(req).requestPasswordReset(req.body as RequestOtpDto);
      // Always 204 — prevents email enumeration
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.service(req).resetPassword(req.body as ResetPasswordDto);
      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  };
}

export const authController = new AuthController();
