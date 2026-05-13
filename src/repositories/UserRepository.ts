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
}
