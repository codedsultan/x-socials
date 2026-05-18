import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { PostRepository } from '../../repositories/PostRepository';
import { ApiError } from '../../shared/errors/ApiError';
import {
  buildOffsetPage, buildCursorPage, decodeCursor, offsetToSkip,
} from '../../shared/helpers/paginate';
import type {
  CreatePostDto, UpdatePostDto, PostResponse, PostOffsetPage, PostCursorPage,
} from './posts.types';

export interface ListPostsParams {
  limit:    number;
  tag?:     string;
  authorId?: string;
  // Offset mode
  page?:   number;
  // Cursor mode
  cursor?: string;
}

export class PostsService {
  private get postRepo(): PostRepository {
    return this.repoFactory.getRepository<any>('Post') as PostRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  /**
   * List posts with automatic strategy selection:
   *   - cursor present → cursor pagination (stable infinite scroll)
   *   - page/tag/authorId → offset pagination (total count meaningful)
   */
  async listPosts(params: ListPostsParams): Promise<PostOffsetPage | PostCursorPage> {
    const { limit, tag, authorId, page = 1, cursor } = params;
    const useCursor = !!cursor && !tag && !authorId;

    if (useCursor) {
      return this.listWithCursor({ limit, cursor });
    }
    return this.listWithOffset({ limit, page, tag, authorId });
  }

  private async listWithOffset(params: {
    limit: number; page: number; tag?: string; authorId?: string;
  }): Promise<PostOffsetPage> {
    const { limit, page, tag, authorId } = params;
    const skip = offsetToSkip({ page, limit });
    const filter = tag ? { tags: tag } as any : authorId ? { authorId } : {};
    const opts   = { limit, skip, sort: { createdAt: -1 } as Record<string, 1 | -1> };

    const [items, total] = await Promise.all([
      tag
        ? this.postRepo.findByTag(tag, opts)
        : authorId
          ? this.postRepo.findByAuthor(authorId, opts)
          : this.postRepo.findMany({}, opts),
      this.postRepo.count(filter),
    ]);

    return buildOffsetPage(items as PostResponse[], total, { page, limit });
  }

  private async listWithCursor(params: { limit: number; cursor?: string }): Promise<PostCursorPage> {
    const { limit, cursor } = params;
    const after = cursor ? (decodeCursor(cursor) ?? undefined) : undefined;

    // Fetch limit+1 so buildCursorPage can detect hasMore without a count query
    const raw = await this.postRepo.findMany(
      {},
      {
        limit: limit + 1,
        after,
        cursorField: 'id',
        sort: { createdAt: -1 } as Record<string, 1 | -1>,
      }
    );

    return buildCursorPage(raw as PostResponse[], limit, 'id');
  }

  async getPost(postId: string): Promise<PostResponse> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw ApiError.notFound('Post not found');
    return post as PostResponse;
  }

  async createPost(actingUserId: string, dto: CreatePostDto): Promise<PostResponse> {
    return this.postRepo.create({
      ...dto,
      authorId:   actingUserId,
      tags:       dto.tags ?? [],
      likesCount: 0,
    }) as Promise<PostResponse>;
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
