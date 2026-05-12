/**
 * @file src/models/mongo/Post.model.ts
 * @description Mongoose model for Posts
 */

import mongoose, { Schema } from 'mongoose';
import type { IPostMongoDocument } from '../../interfaces/entities/post/mongo';
import type { PostStatus } from '../../interfaces/entities/post/core';

const PostSchema = new Schema<IPostMongoDocument>(
    {
        userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        content: { type: String, required: true, maxlength: 5000 },
        mediaUrls: [{ type: String }],
        status: {
            type: String,
            enum: ['active', 'inactive', 'deleted'] as PostStatus[],
            default: 'active'
        },
        metadata: {
            likesCount: { type: Number, default: 0 },
            commentsCount: { type: Number, default: 0 },
            sharesCount: { type: Number, default: 0 }
        }
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Indexes for performance
PostSchema.index({ userId: 1, createdAt: -1 });
PostSchema.index({ status: 1, createdAt: -1 });
PostSchema.index({ 'metadata.likesCount': -1 });

// Virtual for id (maps _id to id)
PostSchema.virtual('id').get(function (this: IPostMongoDocument) {
    return this._id.toHexString();
});

export const PostModel = mongoose.model<IPostMongoDocument>('Post', PostSchema);