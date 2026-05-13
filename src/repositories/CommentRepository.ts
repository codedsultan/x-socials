import { BaseRepository } from './BaseRepository';
import type { IRepository, FindOptions } from '../interfaces/db/IRepository';

export interface Comment {
    id: string;
    postId: string;
    authorId: string;
    content: string;
    parentId?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

export class CommentRepository extends BaseRepository<Comment> implements IRepository<Comment> {

    async findByPost(postId: string, options?: FindOptions): Promise<Comment[]> {
        return this.findMany({ postId }, options);
    }

    async findReplies(parentId: string, options?: FindOptions): Promise<Comment[]> {
        return this.findMany({ parentId }, options);
    }
}
