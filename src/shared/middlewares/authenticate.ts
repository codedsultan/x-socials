import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../errors/ApiError';
import ConfigService from '../../config/config.service';
import type { ICurrentUser } from '../types/express';

interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

/**
 * Verifies the Bearer JWT in Authorization header.
 * On success, attaches req.currentUser = { id, email }.
 * Calls next(ApiError) on any failure — the global error handler responds.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const header = req.headers['authorization'];
    if (!header || !header.startsWith('Bearer ')) {
      return next(ApiError.unauthorized('No token provided'));
    }

    const token = header.slice(7).trim();
    if (!token) {
      return next(ApiError.unauthorized('No token provided'));
    }

    const secret = ConfigService.getServerConfig().JWT_SECRET;
    if (!secret) {
      return next(ApiError.internal('JWT secret not configured'));
    }

    const payload = jwt.verify(token, secret) as JwtPayload;

    const currentUser: ICurrentUser = {
      id: payload.sub,
      email: payload.email,
    };

    (req as any).currentUser = currentUser;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      return next(ApiError.unauthorized('Token has expired'));
    }
    if (err instanceof jwt.JsonWebTokenError) {
      return next(ApiError.unauthorized('Invalid token'));
    }
    next(err);
  }
}

/**
 * Optional auth — populates req.currentUser if a valid token is present,
 * but does not reject requests without a token. Useful for public endpoints
 * that show extra data when the user is logged in (e.g. "did I like this?").
 */
export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = header.slice(7).trim();
    const secret = ConfigService.getServerConfig().JWT_SECRET;
    if (!secret) return next();

    const payload = jwt.verify(token, secret) as JwtPayload;
    (req as any).currentUser = { id: payload.sub, email: payload.email };
  } catch {
    // silently ignore — token present but invalid, treat as unauthenticated
  }

  next();
}
