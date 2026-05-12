/**
 * @file src/interfaces/entities/post/mongo.ts
 * @description MongoDB-specific post interfaces (Mongoose)
 */

import type { Document, Types } from "mongoose";
import type { IPost } from './core';

export interface IPostMongoDocument extends Omit<IPost, 'userId' | 'id'>, Document {
    _id: Types.ObjectId;
    userId: Types.ObjectId;  // Override as ObjectId for MongoDB
    createdAt: Date;
    updatedAt: Date;

    // Virtuals
    id: string;

    // Instance methods (if any)
    // like(): Promise<void>;
    // unlike(userId: string): Promise<void>;
    // isAuthor(userId: string): boolean;
}