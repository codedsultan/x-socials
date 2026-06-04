import { BaseRepository } from './BaseRepository';
import type { IRepository, FindOptions } from '../interfaces/db/IRepository';

export interface Comment {
    id:              string;
    postId:          string;
    authorId:        string;
    content:         string;
    parentId?:       string | null;
    deletedAt?:      Date | null;
    deletionReason?: string | null;
    createdAt?:      Date;
    updatedAt?:      Date;
}

/**
 * All public-facing reads filter out soft-deleted comments automatically.
 */
export class CommentRepository extends BaseRepository<Comment> implements IRepository<Comment> {

    private get notDeleted() {
        return { deletedAt: null } as unknown as Partial<Comment>;
    }

    async findById(id: string): Promise<Comment | null> {
        const comment = await super.findById(id);
        if (!comment || comment.deletedAt) return null;
        return comment;
    }

    async findByIdRaw(id: string): Promise<Comment | null> {
        return super.findById(id);
    }

    async findMany(filter: Partial<Comment> = {}, options?: FindOptions): Promise<Comment[]> {
        return super.findMany({ ...this.notDeleted, ...filter }, options);
    }

    async count(filter: Partial<Comment> = {}): Promise<number> {
        return super.count({ ...this.notDeleted, ...filter });
    }

    async findByPost(postId: string, options?: FindOptions): Promise<Comment[]> {
        return this.findMany({ postId } as Partial<Comment>, options);
    }

    async findReplies(parentId: string, options?: FindOptions): Promise<Comment[]> {
        return this.findMany({ parentId } as Partial<Comment>, options);
    }

    /** Soft-delete — sets deletedAt and deletionReason rather than removing. */
    async softDelete(commentId: string, reason: string): Promise<void> {
        await this.update(commentId, {
            deletedAt:      new Date(),
            deletionReason: reason,
        } as unknown as Partial<Comment>);
    }
}
