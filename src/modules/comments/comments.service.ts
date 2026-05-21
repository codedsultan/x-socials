/**
 * comments.service.ts  (updated)
 *
 * Changes:
 *   After createComment() and updateComment() succeed, fire the moderation
 *   webhook as a non-blocking side effect. Same pattern as enqueuePost().
 *
 *   Note on updateComment: edited comments are re-enqueued because a user
 *   could post benign content, then edit it to contain a violation after the
 *   initial analysis. The FastAPI enqueue endpoint handles re-analysis
 *   correctly — the daily unique constraint only applies to the scan pipeline,
 *   not to the real-time enqueue path (which uses a separate trigger='realtime'
 *   value and always writes a fresh moderation_records row).
 */

import type { RepositoryFactory }  from '../../factories/RepositoryFactory';
import type { CommentRepository }  from '../../repositories/CommentRepository';
import type { PostRepository }     from '../../repositories/PostRepository';
import { ApiError }                from '../../shared/errors/ApiError';
import { buildKeysetPage }         from '../../shared/helpers/paginate';
import { moderationWebhook }       from '../../services/ModerationWebhook';
import type { CreateCommentDto, UpdateCommentDto, CommentResponse } from './comments.types';
import { NotificationDispatcher }  from '../notifications/notifications.service';
import type { PagedResult }        from '../../shared/helpers/paginate';

export interface ListCommentsParams {
    after?:  string;
    before?: string;
    limit:   number;
}

export class CommentsService {
    private get commentRepo(): CommentRepository {
        return this.repoFactory.getRepository<any>('Comment') as CommentRepository;
    }

    private get postRepo(): PostRepository {
        return this.repoFactory.getRepository<any>('Post') as PostRepository;
    }

    private get notifDispatcher(): NotificationDispatcher {
        return new NotificationDispatcher(this.repoFactory);
    }

    constructor(private readonly repoFactory: RepositoryFactory) {}

    async listForPost(
        postId: string,
        params: ListCommentsParams
    ): Promise<PagedResult<CommentResponse>> {
        const post = await this.postRepo.findById(postId);
        if (!post) throw ApiError.notFound('Post not found');

        const { after, before, limit } = params;

        const raw = await this.commentRepo.findMany(
            { postId, parentId: null } as any,
            {
                limit:  limit + 1,
                after,
                before,
                sort:   { id: 1 } as Record<string, 1 | -1>,
            }
        );

        return buildKeysetPage(raw as CommentResponse[], limit, 'id');
    }

    async getReplies(
        parentId: string,
        params: ListCommentsParams
    ): Promise<PagedResult<CommentResponse>> {
        const { after, before, limit } = params;

        const raw = await this.commentRepo.findMany(
            { parentId } as any,
            {
                limit:  limit + 1,
                after,
                before,
                sort:   { id: 1 } as Record<string, 1 | -1>,
            }
        );

        return buildKeysetPage(raw as CommentResponse[], limit, 'id');
    }

    async createComment(actingUserId: string, postId: string, dto: CreateCommentDto): Promise<CommentResponse> {
        const post = await this.postRepo.findById(postId);
        if (!post) throw ApiError.notFound('Post not found');

        if (dto.parentId) {
            const parent = await this.commentRepo.findById(dto.parentId);
            if (!parent) throw ApiError.notFound('Parent comment not found');
            if ((parent as any).postId !== postId) {
                throw ApiError.badRequest('Parent comment belongs to a different post');
            }
        }

        const comment = await this.commentRepo.create({
            postId,
            authorId: actingUserId,
            content:  dto.content,
            parentId: dto.parentId ?? null,
        }) as CommentResponse;

        // Existing: notify post author of new comment
        this.postRepo.findById(postId).then(p => {
            if (p) this.notifDispatcher.onComment(actingUserId, p.authorId, postId);
        }).catch(() => {});

        // Existing: notify parent comment author on reply
        if (dto.parentId) {
            this.commentRepo.findById(dto.parentId).then(parent => {
                if (parent) this.notifDispatcher.onReply(actingUserId, parent.authorId, (comment as any).id);
            }).catch(() => {});
        }

        // New: enqueue for real-time moderation
        moderationWebhook.enqueueComment({
            id:       (comment as any).id,
            content:  comment.content,
            authorId: comment.authorId,
            postId,
        }).catch(() => {});

        return comment;
    }

    async updateComment(actingUserId: string, commentId: string, dto: UpdateCommentDto): Promise<CommentResponse> {
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw ApiError.notFound('Comment not found');
        if (comment.authorId !== actingUserId) throw ApiError.forbidden('You can only edit your own comments');

        const updated = await this.commentRepo.update(commentId, { content: dto.content });
        if (!updated) throw ApiError.internal('Update failed');

        // Re-enqueue on edit — content may have changed since initial analysis
        moderationWebhook.enqueueComment({
            id:       commentId,
            content:  dto.content,
            authorId: comment.authorId,
            postId:   (comment as any).postId,
        }).catch(() => {});

        return updated as CommentResponse;
    }

    async deleteComment(actingUserId: string, commentId: string): Promise<void> {
        const comment = await this.commentRepo.findById(commentId);
        if (!comment) throw ApiError.notFound('Comment not found');
        if (comment.authorId !== actingUserId) throw ApiError.forbidden('You can only delete your own comments');
        await this.commentRepo.softDelete(commentId, 'author_deleted');
    }
}
