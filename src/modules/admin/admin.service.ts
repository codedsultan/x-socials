import type { RepositoryFactory }  from '../../factories/RepositoryFactory';
import type { UserRepository }     from '../../repositories/UserRepository';
import type { PostRepository }     from '../../repositories/PostRepository';
import type { CommentRepository }  from '../../repositories/CommentRepository';
import type { LikeRepository }     from '../../repositories/LikeRepository';
import type { FollowRepository }   from '../../repositories/FollowRepository';
import type { TokenRepository }    from '../../repositories/TokenRepository';
import { NotificationDispatcher }  from '../notifications/notifications.service';
import { ApiError }                from '../../shared/errors/ApiError';
import {
  buildOffsetPage, offsetToSkip,
  type OffsetParams, type PagedResult,
} from '../../shared/helpers/paginate';
import type { AdminUserView, PlatformStats } from './admin.types';

export class AdminService {
  private get userRepo(): UserRepository {
    return this.repoFactory.getRepository<any>('User') as UserRepository;
  }
  private get postRepo(): PostRepository {
    return this.repoFactory.getRepository<any>('Post') as PostRepository;
  }
  private get commentRepo(): CommentRepository {
    return this.repoFactory.getRepository<any>('Comment') as CommentRepository;
  }
  private get likeRepo(): LikeRepository {
    return this.repoFactory.getRepository<any>('Like') as LikeRepository;
  }
  private get followRepo(): FollowRepository {
    return this.repoFactory.getRepository<any>('Follow') as FollowRepository;
  }
  private get tokenRepo(): TokenRepository {
    return this.repoFactory.getRepository<any>('Token') as TokenRepository;
  }
  private get notifDispatcher(): NotificationDispatcher {
    return new NotificationDispatcher(this.repoFactory);
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  // ── Stats ─────────────────────────────────────────────────────────────────

  async getStats(): Promise<PlatformStats> {
    const [totalUsers, totalPosts, totalComments, totalLikes] = await Promise.all([
      this.userRepo.count({}),
      this.postRepo.count({}),
      this.commentRepo.count({}),
      this.likeRepo.count({}),
    ]);
    return {
      users:    { total: totalUsers },
      posts:    { total: totalPosts },
      comments: { total: totalComments },
      likes:    { total: totalLikes },
    };
  }

  // ── Users ─────────────────────────────────────────────────────────────────

  async listUsers(params: OffsetParams): Promise<PagedResult<AdminUserView>> {
    const { page, limit } = params;
    const skip = offsetToSkip({ page, limit });

    const [users, total] = await Promise.all([
      this.userRepo.findMany({}, { limit, skip, sort: { createdAt: -1 } }),
      this.userRepo.count({}),
    ]);

    const profiles: AdminUserView[] = await Promise.all(
      users.map(async (u) => {
        const [followerCount, followingCount] = await Promise.all([
          this.followRepo.getFollowerCount(u.id),
          this.followRepo.getFollowingCount(u.id),
        ]);
        return {
          id: u.id, name: u.name, email: u.email,
          suspended: u.suspended ?? false,
          followerCount, followingCount, createdAt: u.createdAt,
        };
      })
    );

    return buildOffsetPage(profiles, total, { page, limit });
  }

  async getUser(userId: string): Promise<AdminUserView> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const [followerCount, followingCount] = await Promise.all([
      this.followRepo.getFollowerCount(userId),
      this.followRepo.getFollowingCount(userId),
    ]);

    return {
      id: user.id, name: user.name, email: user.email,
      suspended: user.suspended ?? false,
      followerCount, followingCount, createdAt: user.createdAt,
    };
  }

  /**
   * Suspend a user.
   * Revokes all existing tokens immediately so in-flight sessions are cut off.
   */
  async suspendUser(userId: string): Promise<AdminUserView> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    if (user.suspended) return this.getUser(userId);

    await Promise.all([
      this.userRepo.setSuspended(userId, true),
      this.tokenRepo.revokeAllForUser(userId),
    ]);

    return this.getUser(userId);
  }

  async reinstateUser(userId: string): Promise<AdminUserView> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    await this.userRepo.setSuspended(userId, false);
    return this.getUser(userId);
  }

  // ── Posts ─────────────────────────────────────────────────────────────────

  /**
   * Soft-delete a post and notify the author.
   * The document remains in MongoDB with deletedAt set.
   * All public reads filter { deletedAt: null } so it vanishes from feeds.
   */
  async deletePost(postId: string): Promise<void> {
    const post = await this.postRepo.findByIdRaw(postId);
    if (!post) throw ApiError.notFound('Post not found');
    if (post.deletedAt) return;  // already deleted — idempotent

    await this.postRepo.softDelete(postId, 'admin_removed');

    // Notify the author — fire-and-forget
    this.notifDispatcher.onContentRemoved(post.authorId, postId).catch(() => {});
  }

  // ── Comments ──────────────────────────────────────────────────────────────

  /**
   * Soft-delete a comment and notify the author.
   */
  async deleteComment(commentId: string): Promise<void> {
    const comment = await this.commentRepo.findByIdRaw(commentId);
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.deletedAt) return;

    await this.commentRepo.softDelete(commentId, 'admin_removed');

    this.notifDispatcher.onContentRemoved(comment.authorId, commentId).catch(() => {});
  }
}
