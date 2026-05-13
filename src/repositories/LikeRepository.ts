import { BaseRepository } from './BaseRepository';
import type { IRepository } from '../interfaces/db/IRepository';

export interface Like {
    id: string;
    targetId: string;
    targetType: 'post' | 'comment';
    userId: string;
    createdAt?: Date;
}

export class LikeRepository extends BaseRepository<Like> implements IRepository<Like> {

    async hasUserLiked(userId: string, targetId: string, targetType: 'post' | 'comment'): Promise<boolean> {
        return this.exists({ userId, targetId, targetType });
    }

    async findByTarget(targetId: string, targetType: 'post' | 'comment'): Promise<Like[]> {
        return this.findMany({ targetId, targetType });
    }
}
