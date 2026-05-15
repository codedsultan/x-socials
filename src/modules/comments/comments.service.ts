import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { CommentRepository } from '../../repositories/CommentRepository';
import type { PostRepository } from '../../repositories/PostRepository';
import { ApiError } from '../../shared/errors/ApiError';
import type { CreateCommentDto, UpdateCommentDto, CommentResponse } from './comments.types';

export class CommentsService {
  private get commentRepo(): CommentRepository {
    return this.repoFactory.getRepository<any>('Comment') as CommentRepository;
  }

  private get postRepo(): PostRepository {
    return this.repoFactory.getRepository<any>('Post') as PostRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  async listForPost(postId: string): Promise<CommentResponse[]> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw ApiError.notFound('Post not found');
    return (await this.commentRepo.findByPost(postId)) as CommentResponse[];
  }

  async getReplies(parentId: string): Promise<CommentResponse[]> {
    return (await this.commentRepo.findReplies(parentId)) as CommentResponse[];
  }

  async createComment(actingUserId: string, postId: string, dto: CreateCommentDto): Promise<CommentResponse> {
    const post = await this.postRepo.findById(postId);
    if (!post) throw ApiError.notFound('Post not found');

    if (dto.parentId) {
      const parent = await this.commentRepo.findById(dto.parentId);
      if (!parent) throw ApiError.notFound('Parent comment not found');
      if ((parent as any).postId !== postId) throw ApiError.badRequest('Parent comment belongs to a different post');
    }

    const comment = await this.commentRepo.create({
      postId,
      authorId: actingUserId,
      content: dto.content,
      parentId: dto.parentId ?? null,
    });
    return comment as CommentResponse;
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
    await this.commentRepo.delete(commentId);
  }
}
