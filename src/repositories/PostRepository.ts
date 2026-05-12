import { BaseRepository } from './BaseRepository';
// import { DbResolver } from '../database/core/DbResolver';
import { IRepository } from '../interfaces/db/IRepository';

export interface Post {
    id: string;
    title: string;
    content: string;
    authorId: string;
    tags: string[];
    likesCount: number;
}

export class PostRepository extends BaseRepository<Post> implements IRepository<Post> {
    async findByAuthor(authorId: string): Promise<Post[]> {
        return this.adapter.findMany(this.modelName, { authorId });
    }

    async searchByTags(tags: string[]): Promise<Post[]> {
        // DB-specific implementation
        return this.adapter.findMany(this.modelName, { tags: { $in: tags } });
    }

    async incrementLikes(postId: string): Promise<void> {
        await this.adapter.update(this.modelName, postId, {
            $inc: { likesCount: 1 }
        });
    }
}