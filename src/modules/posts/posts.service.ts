import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { PostRepository } from '../../repositories/PostRepository';
import { ApiError } from '../../shared/errors/ApiError';
import type { CreatePostDto, UpdatePostDto, PostResponse } from './posts.types';

export class PostsService {
  private get postRepo(): PostRepository {
    return this.repoFactory.getRepository<any>('Post') as PostRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  async listPosts(params: { page: number; limit: number; tag?: string; authorId?: string }): Promise<PostResponse[]> {
    const { page, limit, tag, authorId } = params;
    const skip = (page - 1) * limit;

    if (tag) {
      return (await this.postRepo.findByTag(tag, { limit, skip })) as PostResponse[];
    }
    if (authorId) {
      return (await this.postRepo.findByAuthor(authorId, { limit, skip })) as PostResponse[];
    }
    return (await this.postRepo.findMany({}, { limit, skip })) as PostResponse[];
  }

  async getPost(postId: string): Promise<PostResponse> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw ApiError.notFound('Post not found');
    return post as PostResponse;
  }

  async createPost(actingUserId: string, dto: CreatePostDto): Promise<PostResponse> {
    const post = await this.postRepo.create({
      ...dto,
      authorId: actingUserId,
      tags: dto.tags ?? [],
      likesCount: 0,
    });
    return post as PostResponse;
  }

  async updatePost(actingUserId: string, postId: string, dto: UpdatePostDto): Promise<PostResponse> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw ApiError.notFound('Post not found');
    if (post.authorId !== actingUserId) throw ApiError.forbidden('You can only edit your own posts');

    const updated = await this.postRepo.update(postId, dto);
    if (!updated) throw ApiError.internal('Update failed');
    return updated as PostResponse;
  }

  async deletePost(actingUserId: string, postId: string): Promise<void> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw ApiError.notFound('Post not found');
    if (post.authorId !== actingUserId) throw ApiError.forbidden('You can only delete your own posts');

    await this.postRepo.delete(postId);
  }
}
