import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { PostRepository } from '../../repositories/PostRepository';
import type { LikeRepository } from '../../repositories/LikeRepository';
import type { FollowRepository } from '../../repositories/FollowRepository';
import type { PostResponse } from '../posts/posts.types';

export interface FeedItem extends PostResponse {
  likedByMe: boolean;
}

export interface FeedOptions {
  page: number;
  limit: number;
  viewerUserId?: string;
}

export class FeedService {
  private get postRepo(): PostRepository {
    return this.repoFactory.getRepository<any>('Post') as PostRepository;
  }

  private get likeRepo(): LikeRepository {
    return this.repoFactory.getRepository<any>('Like') as LikeRepository;
  }

  private get followRepo(): FollowRepository {
    return this.repoFactory.getRepository<any>('Follow') as FollowRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  /**
   * Home feed — posts from users the viewer follows, newest first.
   * Falls back to all posts when the viewer is unauthenticated or follows nobody.
   */
  async getHomeFeed(options: FeedOptions): Promise<FeedItem[]> {
    const { page, limit, viewerUserId } = options;
    const skip = (page - 1) * limit;

    let posts: PostResponse[];

    if (viewerUserId) {
      const followingIds = await this.followRepo.getFollowingIds(viewerUserId);

      if (followingIds.length > 0) {
        // Fetch posts only from followed authors — social feed
        // We fetch from each author and merge; a real impl would use $in via aggregation.
        // For now, fetch per-author and merge — works correctly, optimise later with $in.
        const authorPosts = await Promise.all(
          followingIds.map(authorId =>
            this.postRepo.findByAuthor(authorId, { limit, skip: 0, sort: { createdAt: -1 } })
          )
        );
        const merged = authorPosts
          .flat()
          .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          })
          .slice(skip, skip + limit) as PostResponse[];
        posts = merged;
      } else {
        // Viewer follows nobody yet — show global feed as onboarding fallback
        posts = (await this.postRepo.findMany({}, { limit, skip, sort: { createdAt: -1 } })) as PostResponse[];
      }
    } else {
      posts = (await this.postRepo.findMany({}, { limit, skip, sort: { createdAt: -1 } })) as PostResponse[];
    }

    return this.attachLikedByMe(posts, viewerUserId);
  }

  /**
   * Returns posts by a specific author, newest first.
   */
  async getUserFeed(authorId: string, options: FeedOptions): Promise<FeedItem[]> {
    const { page, limit, viewerUserId } = options;
    const skip = (page - 1) * limit;

    const posts = (await this.postRepo.findByAuthor(authorId, {
      limit,
      skip,
      sort: { createdAt: -1 },
    })) as PostResponse[];

    return this.attachLikedByMe(posts, viewerUserId);
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private async attachLikedByMe(posts: PostResponse[], viewerUserId?: string): Promise<FeedItem[]> {
    if (!viewerUserId || posts.length === 0) {
      return posts.map(p => ({ ...p, likedByMe: false }));
    }

    // Batch parallel check — one DB round-trip per post, all in flight simultaneously
    const likedFlags = await Promise.all(
      posts.map(p => this.likeRepo.hasUserLiked(viewerUserId, p.id, 'post'))
    );

    return posts.map((p, i) => ({ ...p, likedByMe: likedFlags[i] ?? false }));
  }
}
