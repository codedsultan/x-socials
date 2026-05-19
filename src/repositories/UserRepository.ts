import { BaseRepository } from './BaseRepository';
import type { IRepository } from '../interfaces/db/IRepository';

export interface User {
    id: string;
    email: string;
    passwordHash: string;
    name?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export class UserRepository extends BaseRepository<User> implements IRepository<User> {

    async findByEmail(email: string): Promise<User | null> {
        return this.findOne({ email });
    }

    async emailExists(email: string): Promise<boolean> {
        return this.exists({ email });
    }

    /**
     * Fetch multiple users by ID in one query (WHERE id IN (?)).
     * Replaces N+1 findById() calls inside Promise.all().
     */
    async findByIds(ids: string[]): Promise<User[]> {
        if (ids.length === 0) return [];
        return this.findMany({ id: ids } as unknown as Partial<User>);
    }
}
