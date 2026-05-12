/**
 * @file src/interfaces/repositories/user.repository.ts
 * @description Database-agnostic user repository interface
 */

import type { IUser } from "../entities/user/core";

export interface IUserRepository {
    // Core CRUD
    findById(id: string): Promise<IUser | null>;
    findByEmail(email: string): Promise<IUser | null>;
    findByUsername(username: string): Promise<IUser | null>;
    create(userData: Partial<IUser>): Promise<IUser>;
    update(id: string, updates: Partial<IUser>): Promise<IUser | null>;
    delete(id: string): Promise<boolean>;

    // Queries
    findAll(options?: { limit?: number; offset?: number }): Promise<IUser[]>;
    count(filters?: Partial<IUser>): Promise<number>;

    // Business operations
    verifyEmail(id: string): Promise<IUser | null>;
    updatePassword(id: string, hashedPassword: string): Promise<IUser | null>;
    updateRole(id: string, role: IUser['role']): Promise<IUser | null>;
}