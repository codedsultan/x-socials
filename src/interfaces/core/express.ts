import type { NextFunction, Request, Response } from 'express';

/** Minimal user shape for authenticated requests. */
export interface ICurrentUser {
    id: string;
    email: string;
}

/**
 * Extended Express Request.
 * Use req.currentUser after auth middleware runs.
 * Use req.repoFactory (declared in interfaces/express.d.ts) for repositories.
 */
export interface IRequest extends Request {
    currentUser?: ICurrentUser;
}

export interface IResponse extends Response {}

export interface INext extends NextFunction {}
