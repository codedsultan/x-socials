import { BaseRepository } from './BaseRepository';
import type { IRepository, FindOptions } from '../interfaces/db/IRepository';

export interface Post {
    id:              string;
    title:           string;
    content:         string;
    authorId:        string;
    tags:            string[];
    likesCount:      number;
    deletedAt?:      Date | null;
    deletionReason?: string | null;
    createdAt?:      Date;
    updatedAt?:      Date;
}

/**
 * All public-facing reads filter out soft-deleted posts automatically.
 * Admin reads use findByIdRaw() which bypasses the filter.
 */
export class PostRepository extends BaseRepository<Post> implements IRepository<Post> {

    /** Soft-delete filter applied to every public read. */
    private get notDeleted() {
        return { deletedAt: null } as unknown as Partial<Post>;
    }

    async findById(id: string): Promise<Post | null> {
        const post = await super.findById(id);
        if (!post || post.deletedAt) return null;
        return post;
    }

    async findByIdRaw(id: string): Promise<Post | null> {
        return super.findById(id);
    }

    async findMany(filter: Partial<Post> = {}, options?: FindOptions): Promise<Post[]> {
        return super.findMany({ ...this.notDeleted, ...filter }, options);
    }

    async count(filter: Partial<Post> = {}): Promise<number> {
        return super.count({ ...this.notDeleted, ...filter });
    }

    async findByAuthor(authorId: string, options?: FindOptions): Promise<Post[]> {
        return this.findMany({ authorId } as Partial<Post>, options);
    }

    async findByAuthorIds(authorIds: string[], options?: FindOptions): Promise<Post[]> {
        if (authorIds.length === 0) return [];
        return super.findMany(
            { ...this.notDeleted, authorId: authorIds } as unknown as Partial<Post>,
            options
        );
    }

    async findByTag(tag: string, options?: FindOptions): Promise<Post[]> {
        return super.findMany(
            { ...this.notDeleted, tags: tag } as unknown as Partial<Post>,
            options
        );
    }

    /** Soft-delete — sets deletedAt and deletionReason rather than removing. */
    async softDelete(postId: string, reason: string): Promise<void> {
        await this.update(postId, {
            deletedAt:      new Date(),
            deletionReason: reason,
        } as unknown as Partial<Post>);
    }

    async incrementLikes(postId: string): Promise<Post | null> {
        const isMongoAdapter = (this.adapter as any).models !== undefined;
        if (isMongoAdapter) {
            return this.adapter.update(
                this.modelName,
                postId,
                { $inc: { likesCount: 1 } } as unknown as Record<string, unknown>
            ) as Promise<Post | null>;
        }
        return this.adapter.update(
            this.modelName,
            postId,
            { likesCountIncrement: 1 } as unknown as Record<string, unknown>
        ) as Promise<Post | null>;
    }
}
