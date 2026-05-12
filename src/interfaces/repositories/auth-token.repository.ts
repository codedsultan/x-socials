/**
 * @file src/interfaces/repositories/auth-token.repository.ts
 * @description Database-agnostic auth token repository interface
 */

import type { IAuthToken } from "../entities/auth/token";

export interface IAuthTokenRepository {
    findById(id: string): Promise<IAuthToken | null>;
    findByToken(token: string): Promise<IAuthToken | null>;
    findByUserId(userId: string): Promise<IAuthToken[]>;
    create(tokenData: Partial<IAuthToken>): Promise<IAuthToken>;
    delete(id: string): Promise<boolean>;
    deleteByUserId(userId: string): Promise<boolean>;
    deleteExpired(): Promise<number>;
    isExpired(token: IAuthToken): boolean;
}