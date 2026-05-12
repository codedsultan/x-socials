/**
 * @file src/interfaces/entities/post/core.ts
 * @description Database-agnostic post entity - used by business logic
 */

export type PostStatus = "active" | "inactive" | "deleted";

export interface IPostMetadata {
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
}

export interface IPost {
  id: string | number;
  userId: string | number;
  content: string;
  mediaUrls?: string[];
  status: PostStatus;
  metadata: IPostMetadata;
  createdAt: Date;
  updatedAt: Date;
}