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
 * The follows table uses a composite PK (follower_id, following_id) with no
 * surrogate `id` column. BaseRepository.findById() / delete() (which filter by
 * `id`) are therefore not applicable. Named methods below handle all mutations.
 */
export class FollowRepository extends BaseRepository<Follow> implements IRepository<Follow> {

    /**
     * Create a follow edge.
     * The composite PK enforces one-follow-per-pair at the DB level.
     */
    async follow(followerId: string, followingId: string): Promise<Follow> {
        return this.create({ followerId, followingId });
    }

    /**
     * Remove a follow edge. Returns true if a row was deleted.
     * Uses raw Knex because the composite PK cannot be deleted via id-based delete().
     */
    async unfollow(followerId: string, followingId: string): Promise<boolean> {
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

    /**
     * Count-only queries — use adapter.count() instead of fetching all rows.
     * This is O(1) on an indexed column vs O(n) row fetch + .length.
     */
    async getFollowingCount(followerId: string): Promise<number> {
        return this.count({ followerId });
    }

    async getFollowerCount(followingId: string): Promise<number> {
        return this.count({ followingId });
    }
}
