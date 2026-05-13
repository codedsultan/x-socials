import { BaseRepository } from './BaseRepository';
import type { IRepository, FindOptions } from '../interfaces/db/IRepository';

export interface Post {
    id: string;
    title: string;
    content: string;
    authorId: string;
    tags: string[];
    likesCount: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export class PostRepository extends BaseRepository<Post> implements IRepository<Post> {

    /** Find all posts by a given author */
    async findByAuthor(authorId: string, options?: FindOptions): Promise<Post[]> {
        return this.findMany({ authorId }, options);
    }

    /**
     * Find posts that include ALL of the given tags.
     * Uses findMany with a plain equality filter —
     * each adapter translates this without DB-specific operators leaking here.
     */
    async findByTag(tag: string, options?: FindOptions): Promise<Post[]> {
        return this.findMany({ tags: [tag] } as unknown as Partial<Post>, options);
    }

    /**
     * Increment the likes counter atomically.
     * Delegates the DB-specific increment to the adapter via update().
     * For Mongo this uses $inc through a raw update; for SQL this is a
     * safe increment using a subquery — the adapter handles the translation.
     */
    async incrementLikes(postId: string): Promise<Post | null> {
        // We surface a clean domain method. The adapter's update()
        // for Mongo will accept $inc; for Knex we use a raw expression.
        return this.adapter.update(
            this.modelName,
            postId,
            { $inc: { likesCount: 1 } } as unknown as Record<string, unknown>
        ) as Promise<Post | null>;
    }
}
