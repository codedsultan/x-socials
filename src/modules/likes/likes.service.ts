import type { RepositoryFactory }    from '../../factories/RepositoryFactory';
import type { LikeRepository }       from '../../repositories/LikeRepository';
import type { PostRepository }       from '../../repositories/PostRepository';
import type { CommentRepository }    from '../../repositories/CommentRepository';
import { NotificationDispatcher }   from '../notifications/notifications.service';
import type { LikeTarget, LikeResponse } from './likes.types';

export class LikesService {
  private get likeRepo(): LikeRepository {
    return this.repoFactory.getRepository<any>('Like') as LikeRepository;
  }
  private get postRepo(): PostRepository {
    return this.repoFactory.getRepository<any>('Post') as PostRepository;
  }
  private get commentRepo(): CommentRepository {
    return this.repoFactory.getRepository<any>('Comment') as CommentRepository;
  }
  private get notifDispatcher(): NotificationDispatcher {
    return new NotificationDispatcher(this.repoFactory);
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  async toggle(actingUserId: string, targetId: string, targetType: LikeTarget): Promise<LikeResponse> {
    const alreadyLiked = await this.likeRepo.hasUserLiked(actingUserId, targetId, targetType);

    if (alreadyLiked) {
      const existing = await this.likeRepo.findOne({ userId: actingUserId, targetId, targetType });
      if (existing) {
        await this.likeRepo.delete(existing.id);
        if (targetType === 'post') await this.decrementPostLikes(targetId);
      }
      return { liked: false, targetId, targetType };
    }

    await this.likeRepo.create({ userId: actingUserId, targetId, targetType });

    if (targetType === 'post') {
      await this.postRepo.incrementLikes(targetId);
      // Notify post author (fire-and-forget — don't fail the like if this errors)
      this.postRepo.findById(targetId).then(post => {
        if (post) this.notifDispatcher.onLikePost(actingUserId, post.authorId, targetId);
      }).catch(() => {});
    }

    if (targetType === 'comment') {
      this.commentRepo.findById(targetId).then(comment => {
        if (comment) this.notifDispatcher.onLikeComment(actingUserId, comment.authorId, targetId);
      }).catch(() => {});
    }

    return { liked: true, targetId, targetType };
  }

  async getLikeCount(targetId: string, targetType: LikeTarget): Promise<number> {
    const likes = await this.likeRepo.findByTarget(targetId, targetType);
    return likes.length;
  }

  async hasLiked(userId: string, targetId: string, targetType: LikeTarget): Promise<boolean> {
    return this.likeRepo.hasUserLiked(userId, targetId, targetType);
  }

  private async decrementPostLikes(postId: string): Promise<void> {
    const post = await this.postRepo.findById(postId);
    if (!post) return;
    const newCount = Math.max(0, post.likesCount - 1);
    await this.postRepo.update(postId, { likesCount: newCount });
  }
}
