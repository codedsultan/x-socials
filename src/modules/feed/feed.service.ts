import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { PostRepository } from '../../repositories/PostRepository';
import type { LikeRepository } from '../../repositories/LikeRepository';
import type { FollowRepository } from '../../repositories/FollowRepository';
import type { PostResponse } from '../posts/posts.types';
import {
  buildCursorPage, decodeCursor,
  type PagedResult,
} from '../../shared/helpers/paginate';

export interface FeedItem extends PostResponse {
  likedByMe: boolean;
}

export interface FeedOptions {
  limit: number;
  cursor?: string;
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
   * Home feed — cursor-paginated, newest first.
   * Authenticated: posts from followed authors (falls back to global when following nobody).
   * Unauthenticated: global feed.
   */
  async getHomeFeed(options: FeedOptions): Promise<PagedResult<FeedItem>> {
    const { limit, cursor, viewerUserId } = options;
    const after = cursor ? (decodeCursor(cursor) ?? undefined) : undefined;

    let rawPosts: PostResponse[];

    if (viewerUserId) {
      const followingIds = await this.followRepo.getFollowingIds(viewerUserId);

      if (followingIds.length > 0) {
        // Fetch limit+1 from each followed author, merge, re-sort, slice
        const perAuthor = await Promise.all(
          followingIds.map(authorId =>
            this.postRepo.findByAuthor(authorId, {
              limit:  limit + 1,
              sort:   { createdAt: -1 },
              after,
              cursorField: 'id',
            })
          )
        );
        rawPosts = perAuthor
          .flat()
          .sort((a, b) => {
            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return tb - ta;
          })
          .slice(0, limit + 1) as PostResponse[];
      } else {
        rawPosts = (await this.postRepo.findMany(
          {},
          { limit: limit + 1, after, cursorField: 'id', sort: { createdAt: -1 } }
        )) as PostResponse[];
      }
    } else {
      rawPosts = (await this.postRepo.findMany(
        {},
        { limit: limit + 1, after, cursorField: 'id', sort: { createdAt: -1 } }
      )) as PostResponse[];
    }

    const page = buildCursorPage(rawPosts, limit, 'id');
    return {
      items: await this.attachLikedByMe(page.items, viewerUserId),
      meta:  page.meta,
    };
  }

  /**
   * Posts by a specific author — cursor-paginated, newest first.
   */
  async getUserFeed(authorId: string, options: FeedOptions): Promise<PagedResult<FeedItem>> {
    const { limit, cursor, viewerUserId } = options;
    const after = cursor ? (decodeCursor(cursor) ?? undefined) : undefined;

    const raw = await this.postRepo.findByAuthor(authorId, {
      limit:      limit + 1,
      after,
      cursorField: 'id',
      sort:       { createdAt: -1 },
    }) as PostResponse[];

    const page = buildCursorPage(raw, limit, 'id');
    return {
      items: await this.attachLikedByMe(page.items, viewerUserId),
      meta:  page.meta,
    };
  }

  private async attachLikedByMe(posts: PostResponse[], viewerUserId?: string): Promise<FeedItem[]> {
    if (!viewerUserId || posts.length === 0) {
      return posts.map(p => ({ ...p, likedByMe: false }));
    }
    const flags = await Promise.all(
      posts.map(p => this.likeRepo.hasUserLiked(viewerUserId, p.id, 'post'))
    );
    return posts.map((p, i) => ({ ...p, likedByMe: flags[i] ?? false }));
  }
}

export interface FeedItem extends PostResponse {
  likedByMe: boolean;
}

