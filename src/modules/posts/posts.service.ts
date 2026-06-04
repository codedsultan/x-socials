/**
 * posts.service.ts  (updated)
 *
 * Changes:
 *   After createPost() and updatePost() succeed, fire the moderation webhook
 *   as a non-blocking side effect. The call is fire-and-forget — it does not
 *   await the webhook result and never affects the response to the caller.
 *
 *   Pattern mirrors the existing notification dispatch in CommentsService:
 *     this.notifDispatcher.onComment(...).catch(() => {})
 *   Same idea — side effect, never blocks, never throws into the request.
 */

import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { PostRepository }    from '../../repositories/PostRepository';
import { ApiError }               from '../../shared/errors/ApiError';
import {
    buildOffsetPage, buildCursorPage, decodeCursor, offsetToSkip,
} from '../../shared/helpers/paginate';
import { moderationWebhook }      from '../../services/ModerationWebhook';
import type {
    CreatePostDto, UpdatePostDto, PostResponse, PostOffsetPage, PostCursorPage,
} from './posts.types';

export interface ListPostsParams {
    limit:     number;
    tag?:      string;
    authorId?: string;
    page?:     number;
    cursor?:   string;
}

export class PostsService {
    private get postRepo(): PostRepository {
        return this.repoFactory.getRepository<any>('Post') as PostRepository;
    }

    constructor(private readonly repoFactory: RepositoryFactory) {}

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
        const skip   = offsetToSkip({ page, limit });
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

        const raw = await this.postRepo.findMany(
            {},
            {
                limit:       limit + 1,
                after,
                cursorField: 'id',
                sort:        { createdAt: -1 } as Record<string, 1 | -1>,
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
        const post = await this.postRepo.create({
            ...dto,
            authorId:   actingUserId,
            tags:       dto.tags ?? [],
            likesCount: 0,
        }) as PostResponse;

        // Fire-and-forget: enqueue for real-time moderation analysis.
        // .catch(() => {}) ensures any unexpected error in the webhook client
        // itself (not the HTTP call — that's already caught inside) cannot
        // surface up and alter the response to the user.
        moderationWebhook.enqueuePost({
            id:       (post as any).id,
            title:    post.title,
            content:  post.content,
            authorId: post.authorId,
        }).catch(() => {});

        return post;
    }

    async updatePost(actingUserId: string, postId: string, dto: UpdatePostDto): Promise<PostResponse> {
        const post = await this.postRepo.findById(postId);
        if (!post) throw ApiError.notFound('Post not found');
        if (post.authorId !== actingUserId) throw ApiError.forbidden('You can only edit your own posts');

        const updated = await this.postRepo.update(postId, dto);
        if (!updated) throw ApiError.internal('Update failed');

        // Re-enqueue on update — edited content may have changed verdict.
        // The FastAPI enqueue endpoint uses upsert semantics on moderation_queue
        // so a re-analysis of safe content doesn't create noise in the queue.
        moderationWebhook.enqueuePost({
            id:       postId,
            title:    (updated as any).title ?? post.title,
            content:  (updated as any).content ?? post.content,
            authorId: post.authorId,
        }).catch(() => {});

        return updated as PostResponse;
    }

    async deletePost(actingUserId: string, postId: string): Promise<void> {
        const post = await this.postRepo.findById(postId);
        if (!post) throw ApiError.notFound('Post not found');
        if (post.authorId !== actingUserId) throw ApiError.forbidden('You can only delete your own posts');
        await this.postRepo.softDelete(postId, 'author_deleted');
    }
}
