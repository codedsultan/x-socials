/**
 * @file src/interfaces/entities/user/mongo.ts
 * @description MongoDB-specific user interfaces (Mongoose)
 */

import type { Document, Types } from "mongoose";
import type { IUser } from './core';
import type { IAuthTokenMongoDocument } from "../auth/token";

export interface IUserMongoDocument extends IUser, Document {
    _id: Types.ObjectId;
    id: string;
    createdAt: Date;
    updatedAt: Date;
    verification?: {
        isVerified: boolean;
        category?: string;
        verifiedAt?: Date;
        lastRequestedAt?: Date;
    };

    // Instance methods
    generateToken(): Promise<IAuthTokenMongoDocument>;
    getToken(refreshToken?: boolean): Promise<IAuthTokenMongoDocument>;
    isProfileComplete(): Promise<boolean>;
    setPassword(password: string): Promise<void>;
    matchPassword(password: string): Promise<boolean>;
}