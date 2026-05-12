/**
 * @file src/interfaces/repositories/token.repository.ts
 * @description Database-agnostic auth token repository interface
 */

import type { IAuthToken, TokenType } from "../entities/auth/token";

export interface ITokenRepository {
    // Core CRUD
    create(tokenData: Omit<IAuthToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<IAuthToken>;
    findById(id: string | number): Promise<IAuthToken | null>;
    findByToken(token: string): Promise<IAuthToken | null>;
    update(id: string | number, updates: Partial<Omit<IAuthToken, 'id' | 'createdAt'>>): Promise<IAuthToken | null>;
    delete(id: string | number): Promise<boolean>;

    // Query methods
    findByUserId(userId: string | number, options?: { type?: TokenType; isValid?: boolean }): Promise<IAuthToken[]>;
    findAllValidForUser(userId: string | number): Promise<IAuthToken[]>;

    // Token specific operations
    invalidateToken(id: string | number): Promise<boolean>;
    invalidateAllForUser(userId: string | number, excludeTokenId?: string | number): Promise<number>;
    cleanupExpiredTokens(): Promise<number>;
    refreshToken(oldTokenId: string | number, newTokenData: Omit<IAuthToken, 'id' | 'createdAt' | 'updatedAt'>): Promise<IAuthToken>;

    // Utility
    count(filters?: Partial<IAuthToken>): Promise<number>;
    exists(token: string): Promise<boolean>;
    isTokenValid(token: string): Promise<boolean>;
}