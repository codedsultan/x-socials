import { BaseRepository } from './BaseRepository';
import type { IRepository } from '../interfaces/db/IRepository';

export interface Follow {
    followerId: string;
    followingId: string;
    createdAt?: Date;
}

/**
 * FollowRepository — manages the directed social graph.
 *
 * Note: the follows table uses a composite PK (follower_id, following_id)
 * with no surrogate `id` column. BaseRepository.findById() is therefore not
 * applicable here — use the named methods below instead.
 *
 * The adapter's findOne / findMany still work because they filter by any
 * column combination via the filter object.
 */
export class FollowRepository extends BaseRepository<Follow> implements IRepository<Follow> {

    /**
     * Create a follow edge.
     * The composite PK / unique constraint at the DB level prevents duplicates —
     * callers should handle the constraint violation (duplicate follow attempt).
     */
    async follow(followerId: string, followingId: string): Promise<Follow> {
        return this.create({ followerId, followingId });
    }

    /**
     * Remove a follow edge. Returns true if a row was deleted.
     */
    async unfollow(followerId: string, followingId: string): Promise<boolean> {
        // BaseRepository.delete() filters by `id`, but follows use a composite PK.
        // We go directly to the adapter for a two-column WHERE.
        const result = await this.adapter.findOne(
            this.modelName,
            { followerId, followingId } as Record<string, unknown>
        ) as Follow | null;

        if (!result) return false;

        // For composite-PK tables we can't use a single id — delete via findMany
        // then adapter.delete. Here we use a custom approach: call the adapter's
        // findOne to confirm existence, then issue a targeted delete. Because the
        // adapter's delete() uses WHERE id = ?, and follows have no id column, we
        // call findMany + delete via the underlying adapter directly.
        //
        // A cleaner long-term fix is to extend IDatabaseAdapter with a deleteWhere()
        // method. For now this is the pragmatic solution that avoids changing the
        // interface contract.
        const rows = await this.adapter.findMany(
            this.modelName,
            { followerId, followingId } as Record<string, unknown>
        ) as Follow[];

        if (rows.length === 0) return false;

        // Use the adapter's raw knex/mongoose client for the composite delete
        // This is the one case where we need to reach below the abstraction.
        // The adapter will be KnexAdapter for the SQL follows table.
        const knexAdapter = this.adapter as any;
        if (knexAdapter.getKnex) {
            const count = await knexAdapter
                .getKnex()('follows')
                .where({ follower_id: followerId, following_id: followingId })
                .delete();
            return count > 0;
        }

        return false;
    }

    /** Check whether followerId already follows followingId. */
    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
        return this.exists({ followerId, followingId });
    }

    /** IDs of all users that followerId follows. */
    async getFollowingIds(followerId: string): Promise<string[]> {
        const rows = await this.findMany({ followerId });
        return rows.map(r => r.followingId);
    }

    /** IDs of all users that follow followingId. */
    async getFollowerIds(followingId: string): Promise<string[]> {
        const rows = await this.findMany({ followingId });
        return rows.map(r => r.followerId);
    }

    /** How many users does followerId follow? */
    async getFollowingCount(followerId: string): Promise<number> {
        const rows = await this.findMany({ followerId });
        return rows.length;
    }

    /** How many users follow followingId? */
    async getFollowerCount(followingId: string): Promise<number> {
        const rows = await this.findMany({ followingId });
        return rows.length;
    }
}
