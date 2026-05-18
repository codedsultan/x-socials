import type { Request, Response, NextFunction } from 'express';
import type { RepositoryFactory } from '../../factories/RepositoryFactory';

export interface ICurrentUser {
  id: string;
  email: string;
}

export interface IAuthenticatedRequest extends Request {
  currentUser: ICurrentUser;
  repoFactory: RepositoryFactory;
}

export interface IRequest extends Request {
  currentUser?: ICurrentUser;
  repoFactory?: RepositoryFactory;
}

export type IResponse = Response;
export type INext = NextFunction;

declare global {
  namespace Express {
    interface Request {
      currentUser?: ICurrentUser;
    }
  }
}
