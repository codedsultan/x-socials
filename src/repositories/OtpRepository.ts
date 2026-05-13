import { BaseRepository } from './BaseRepository';
import type { IRepository } from '../interfaces/db/IRepository';

export interface Otp {
    id: string;
    userId: string;
    code: string;
    purpose: string;
    used: boolean;
    expiresAt: Date;
    createdAt?: Date;
}

export class OtpRepository extends BaseRepository<Otp> implements IRepository<Otp> {

    async findValidOtp(userId: string, code: string, purpose: string): Promise<Otp | null> {
        return this.findOne({ userId, code, purpose, used: false });
    }

    async markUsed(id: string): Promise<Otp | null> {
        return this.update(id, { used: true });
    }
}
