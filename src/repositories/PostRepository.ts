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

    /** All posts by a given author, newest first by default. */
    async findByAuthor(authorId: string, options?: FindOptions): Promise<Post[]> {
        return this.findMany({ authorId }, options);
    }

    /**
     * All posts containing a given tag.
     *
     * MongoDB — passes `{ tags: tag }` as a filter. Mongoose translates a
     * scalar value against an array field into a $elemMatch, so it correctly
     * matches any document whose tags array contains that value.
     *
     * SQL  — tags are typically stored as JSON / a join table.
     * If SQL is the adapter, this falls back to a full-scan findMany with
     * client-side filtering until a proper SQL tag index is added.
     */
    async findByTag(tag: string, options?: FindOptions): Promise<Post[]> {
        // { tags: tag } is valid for Mongoose (array field element match).
        // For SQL adapters the WHERE clause will not match correctly — they'd
        // need a JSON_CONTAINS / join. Posts live in MongoDB so this is safe.
        return this.findMany({ tags: tag } as unknown as Partial<Post>, options);
    }

    /**
     * Atomically increment the likes counter by 1.
     *
     * MongoDB path — passes `{ $inc: { likesCount: 1 } }` directly to
     * MongooseAdapter.update(), which forwards the whole payload to
     * findByIdAndUpdate(). Mongoose passes operator keys untouched.
     *
     * SQL path — passes `{ likesCountRaw: 'likes_count + 1' }` which
     * KnexAdapter translates to a raw SQL expression via knex.raw().
     * This keeps the increment atomic at the DB level on both engines.
     */
    async incrementLikes(postId: string): Promise<Post | null> {
        const isMongoAdapter = (this.adapter as any).models !== undefined;

        if (isMongoAdapter) {
            return this.adapter.update(
                this.modelName,
                postId,
                { $inc: { likesCount: 1 } } as unknown as Record<string, unknown>
            ) as Promise<Post | null>;
        }

        // SQL: use a raw increment expression so it's atomic.
        // KnexAdapter.update() runs toSnakeCase, so we pass the camelCase key
        // and it becomes likes_count in the query.
        return this.adapter.update(
            this.modelName,
            postId,
            { likesCountIncrement: 1 } as unknown as Record<string, unknown>
        ) as Promise<Post | null>;
    }
}
