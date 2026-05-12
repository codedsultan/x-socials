// src/types/express.d.ts
import { IRepository } from '../interfaces/db/IRepository';

declare global {
    namespace Express {
        interface Request {
            repositories?: {
                user: IRepository;
                post: IRepository;
                comment: IRepository;
                like: IRepository;
                otp: IRepository;
                token: IRepository;
            };
        }
    }
}

export { };