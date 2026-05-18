import { describe, it, expect, vi } from 'vitest';
import { FeedService } from '../feed.service';

function makePost(authorId = 'user-1', overrides = {}) {
  return {
    id: `post-${Math.random()}`,
    title: 'T',
    content: 'C',
    authorId,
    tags: [],
    likesCount: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeFactory({
  posts = [makePost()],
  followingIds = [] as string[],
  alreadyLiked = false,
} = {}) {
  const postRepo = {
    findMany: vi.fn().mockResolvedValue(posts),
    findByAuthor: vi.fn().mockImplementation((authorId: string) =>
      Promise.resolve(posts.filter(p => p.authorId === authorId))
    ),
    findByTag: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    exists: vi.fn(),
    incrementLikes: vi.fn(),
  };

  const likeRepo = {
    hasUserLiked: vi.fn().mockResolvedValue(alreadyLiked),
    findByTarget: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    delete: vi.fn(),
    findOne: vi.fn(),
    findMany: vi.fn(),
    findById: vi.fn(),
    exists: vi.fn(),
    update: vi.fn(),
  };

  const followRepo = {
    getFollowingIds: vi.fn().mockResolvedValue(followingIds),
    isFollowing: vi.fn().mockResolvedValue(false),
    follow: vi.fn(),
    unfollow: vi.fn(),
    getFollowerIds: vi.fn().mockResolvedValue([]),
    getFollowingCount: vi.fn().mockResolvedValue(0),
    getFollowerCount: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    delete: vi.fn(),
    findOne: vi.fn(),
    findById: vi.fn(),
    exists: vi.fn(),
    update: vi.fn(),
  };

  return {
    getRepository: vi.fn((name: string) => {
      if (name === 'Post') return postRepo;
      if (name === 'Like') return likeRepo;
      if (name === 'Follow') return followRepo;
      throw new Error(`Unknown repo: ${name}`);
    }),
    _postRepo: postRepo,
    _likeRepo: likeRepo,
    _followRepo: followRepo,
  };
}

describe('FeedService', () => {
  describe('getHomeFeed()', () => {
    it('returns global feed when viewer is unauthenticated', async () => {
      const factory = makeFactory({ posts: [makePost(), makePost()] });
      const service = new FeedService(factory as any);

      const result = await service.getHomeFeed({ limit: 20 });

      expect(result.items).toHaveLength(2);
      expect(result.meta).toBeDefined();
      expect(factory._postRepo.findMany).toHaveBeenCalled();
      expect(factory._followRepo.getFollowingIds).not.toHaveBeenCalled();
    });

    it('returns global feed as fallback when authenticated user follows nobody', async () => {
      const factory = makeFactory({ followingIds: [] });
      const service = new FeedService(factory as any);

      await service.getHomeFeed({ limit: 20, viewerUserId: 'user-99' });

      expect(factory._followRepo.getFollowingIds).toHaveBeenCalledWith('user-99');
      expect(factory._postRepo.findMany).toHaveBeenCalled();
    });

    it('returns only posts from followed authors when viewer follows someone', async () => {
      const post1 = makePost('user-2');
      const post2 = makePost('user-3');
      const factory = makeFactory({
        posts: [post1, post2],
        followingIds: ['user-2', 'user-3'],
      });
      const service = new FeedService(factory as any);

      const result = await service.getHomeFeed({ limit: 20, viewerUserId: 'user-1' });

      expect(factory._postRepo.findByAuthor).toHaveBeenCalledWith('user-2', expect.any(Object));
      expect(factory._postRepo.findByAuthor).toHaveBeenCalledWith('user-3', expect.any(Object));
      expect(result.items.length).toBeGreaterThan(0);
    });

    it('attaches likedByMe: true when viewer has liked a post', async () => {
      const factory = makeFactory({ alreadyLiked: true });
      const service = new FeedService(factory as any);

      const result = await service.getHomeFeed({ limit: 20, viewerUserId: 'user-1' });

      expect(result.items[0]!.likedByMe).toBe(true);
    });

    it('attaches likedByMe: false when viewer has not liked', async () => {
      const factory = makeFactory({ alreadyLiked: false });
      const service = new FeedService(factory as any);

      const result = await service.getHomeFeed({ limit: 20, viewerUserId: 'user-1' });

      expect(result.items[0]!.likedByMe).toBe(false);
    });

    it('attaches likedByMe: false for all posts when unauthenticated', async () => {
      const factory = makeFactory({ posts: [makePost(), makePost()] });
      const service = new FeedService(factory as any);

      const result = await service.getHomeFeed({ limit: 20 });

      expect(result.items.every(f => f.likedByMe === false)).toBe(true);
      expect(factory._likeRepo.hasUserLiked).not.toHaveBeenCalled();
    });
  });

  describe('getUserFeed()', () => {
    it('fetches posts by the given author', async () => {
      const factory = makeFactory({ posts: [makePost('user-5')] });
      const service = new FeedService(factory as any);

      await service.getUserFeed('user-5', { limit: 10 });

      expect(factory._postRepo.findByAuthor).toHaveBeenCalledWith(
        'user-5',
        expect.objectContaining({ limit: 11 })   // limit+1 for hasMore detection
      );
    });

    it('passes cursor through to findByAuthor', async () => {
      const { encodeCursor } = await import('../../../shared/helpers/paginate');
      const token = encodeCursor('some-id');
      const factory = makeFactory({ posts: [] });
      const service = new FeedService(factory as any);

      await service.getUserFeed('user-5', { limit: 10, cursor: token });

      expect(factory._postRepo.findByAuthor).toHaveBeenCalledWith(
        'user-5',
        expect.objectContaining({ after: 'some-id' })
      );
    });
  });
});
