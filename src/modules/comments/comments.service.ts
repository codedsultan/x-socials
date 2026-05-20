import type { RepositoryFactory }  from '../../factories/RepositoryFactory';
import type { CommentRepository }  from '../../repositories/CommentRepository';
import type { PostRepository }     from '../../repositories/PostRepository';
import { ApiError }                from '../../shared/errors/ApiError';
import { buildKeysetPage }         from '../../shared/helpers/paginate';
import type { CreateCommentDto, UpdateCommentDto, CommentResponse } from './comments.types';
import { NotificationDispatcher } from '../notifications/notifications.service';
import type { PagedResult } from '../../shared/helpers/paginate';

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

  /**
   * Keyset-paginated top-level comments for a post, oldest first.
   * Clients walk forward with ?after=<lastId>.
   * Bi-directional navigation: ?before=<firstId> scrolls back up.
   */
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

  /**
   * Keyset-paginated replies to a specific comment, oldest first.
   */
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

    // Notify post author of new comment (unless commenter is the author)
    this.postRepo.findById(postId).then(post => {
      if (post) this.notifDispatcher.onComment(actingUserId, post.authorId, postId);
    }).catch(() => {});

    // If reply, notify the parent comment's author
    if (dto.parentId) {
      this.commentRepo.findById(dto.parentId).then(parent => {
        if (parent) this.notifDispatcher.onReply(actingUserId, parent.authorId, (comment as any).id);
      }).catch(() => {});
    }

    return comment;
  }

  async updateComment(actingUserId: string, commentId: string, dto: UpdateCommentDto): Promise<CommentResponse> {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.authorId !== actingUserId) throw ApiError.forbidden('You can only edit your own comments');

    const updated = await this.commentRepo.update(commentId, { content: dto.content });
    if (!updated) throw ApiError.internal('Update failed');
    return updated as CommentResponse;
  }

  async deleteComment(actingUserId: string, commentId: string): Promise<void> {
    const comment = await this.commentRepo.findById(commentId);
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.authorId !== actingUserId) throw ApiError.forbidden('You can only delete your own comments');
    await this.commentRepo.softDelete(commentId, 'author_deleted');
  }
}
