/**
 * @file src/interfaces/entities/auth/token.ts
 * @description Auth token entity interfaces
 */

import type { Document, Types } from "mongoose";

// Core business interface (database agnostic)
export interface IAuthToken {
    id: string;
    token: string;
    userId: string;
    type: TokenType;
    expiresAt: number; // Unix timestamp
    createdAt: Date;
    updatedAt: Date;
}

export type TokenType = 'access' | 'refresh' | 'reset_password' | 'email_verification';

// MongoDB specific interface
export interface IAuthTokenMongoDocument extends Document {
    _id: Types.ObjectId;
    token: string;
    userId: Types.ObjectId;
    type: TokenType;
    expiresAt: number;
    createdAt: Date;
    updatedAt: Date;

    // Instance methods
    isExpired(): boolean;
    refresh(): Promise<IAuthTokenMongoDocument>;
}

// SQL specific interface
export interface IAuthTokenSQLRow {
    id: number;
    token: string;
    user_id: number;
    type: TokenType;
    expires_at: number;
    created_at: Date;
    updated_at: Date;
}

export type IAuthTokenSQLInsert = Omit<IAuthTokenSQLRow, 'id' | 'created_at' | 'updated_at'>;
export type IAuthTokenSQLUpdate = Partial<IAuthTokenSQLInsert>;

// Converter functions
