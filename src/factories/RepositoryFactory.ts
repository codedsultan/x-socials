import type { DbResolver }  from '../database/core/DbResolver';
import type { IRepository } from '../interfaces/db/IRepository';
import { BaseRepository }   from '../repositories/BaseRepository';
import { PostRepository }   from '../repositories/PostRepository';
import { CommentRepository } from '../repositories/CommentRepository';
import { LikeRepository }   from '../repositories/LikeRepository';
import { UserRepository }   from '../repositories/UserRepository';
import { OtpRepository }    from '../repositories/OtpRepository';
import { TokenRepository }  from '../repositories/TokenRepository';
import { FollowRepository }        from '../repositories/FollowRepository';
import { NotificationRepository }   from '../repositories/NotificationRepository';

export class RepositoryFactory {
    private readonly cache: Map<string, IRepository> = new Map();

    constructor(private readonly resolver: DbResolver) {}

    getRepository<T>(modelName: string): IRepository<T> {
        if (this.cache.has(modelName)) {
            return this.cache.get(modelName) as IRepository<T>;
        }

        const adapter = this.resolver.getAdapterForModel(modelName);
        let repo: IRepository;

        switch (modelName) {
            case 'Post':
                repo = new PostRepository(adapter, modelName);
                break;
            case 'Comment':
                repo = new CommentRepository(adapter, modelName);
                break;
            case 'Like':
                repo = new LikeRepository(adapter, modelName);
                break;
            case 'User':
                repo = new UserRepository(adapter, modelName);
                break;
            case 'Otp':
                repo = new OtpRepository(adapter, modelName);
                break;
            case 'Token':
                repo = new TokenRepository(adapter, modelName);
                break;
            case 'Follow':
                repo = new FollowRepository(adapter, modelName);
                break;
            case 'Notification':
                repo = new NotificationRepository(adapter, modelName);
                break;
            default:
                repo = new BaseRepository<T>(adapter, modelName);
        }

        this.cache.set(modelName, repo);
        return repo as IRepository<T>;
    }
}
