import { describe, it, expect, vi } from 'vitest';
import { AdminService } from '../admin.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-1', email: 'alice@example.com', name: 'Alice',
    passwordHash: 'hash', createdAt: new Date(), updatedAt: new Date(),
    ...overrides,
  };
}

function makeFactory(
  userOverrides:    Record<string, any> = {},
  postOverrides:    Record<string, any> = {},
  commentOverrides: Record<string, any> = {},
  likeOverrides:    Record<string, any> = {},
  followOverrides:  Record<string, any> = {},
) {
  const userRepo = {
    findById:  vi.fn().mockResolvedValue(makeUser()),
    findByIds: vi.fn().mockResolvedValue([makeUser()]),
    findMany:  vi.fn().mockResolvedValue([makeUser()]),
    count:     vi.fn().mockResolvedValue(1),
    create:    vi.fn(), update: vi.fn(), delete: vi.fn(),
    findOne:   vi.fn().mockResolvedValue(null),
    exists:    vi.fn().mockResolvedValue(false),
    ...userOverrides,
  };
  const postRepo = {
    findById:    vi.fn().mockResolvedValue({ id: 'post-1', authorId: 'user-1', title: 'T', content: 'C', tags: [], likesCount: 0, deletedAt: null }),
    findByIdRaw: vi.fn().mockResolvedValue({ id: 'post-1', authorId: 'user-1', title: 'T', content: 'C', tags: [], likesCount: 0, deletedAt: null }),
    count:       vi.fn().mockResolvedValue(5),
    delete:      vi.fn().mockResolvedValue(true),
    softDelete:  vi.fn().mockResolvedValue(undefined),
    findMany:    vi.fn().mockResolvedValue([]),
    create:      vi.fn(), update: vi.fn(), findOne: vi.fn().mockResolvedValue(null),
    exists:      vi.fn(), findByAuthor: vi.fn(), findByTag: vi.fn(),
    incrementLikes: vi.fn(), findByAuthorIds: vi.fn().mockResolvedValue([]),
    ...postOverrides,
  };
  const commentRepo = {
    findById:    vi.fn().mockResolvedValue({ id: 'c1', authorId: 'user-1', content: 'hi', postId: 'post-1', deletedAt: null }),
    findByIdRaw: vi.fn().mockResolvedValue({ id: 'c1', authorId: 'user-1', content: 'hi', postId: 'post-1', deletedAt: null }),
    count:       vi.fn().mockResolvedValue(10),
    delete:      vi.fn().mockResolvedValue(true),
    softDelete:  vi.fn().mockResolvedValue(undefined),
    findMany:    vi.fn().mockResolvedValue([]),
    create:      vi.fn(), update: vi.fn(), findOne: vi.fn().mockResolvedValue(null), exists: vi.fn(),
    ...commentOverrides,
  };
  const likeRepo = {
    count:        vi.fn().mockResolvedValue(20),
    findMany:     vi.fn().mockResolvedValue([]),
    findByTarget: vi.fn().mockResolvedValue([]),
    hasUserLiked: vi.fn().mockResolvedValue(false),
    create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findOne: vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue(null), exists: vi.fn(),
    ...likeOverrides,
  };
  const followRepo = {
    getFollowerCount:  vi.fn().mockResolvedValue(3),
    getFollowingCount: vi.fn().mockResolvedValue(1),
    getFollowingIds:   vi.fn().mockResolvedValue([]),
    isFollowing:       vi.fn().mockResolvedValue(false),
    follow:    vi.fn(), unfollow: vi.fn().mockResolvedValue(true),
    findMany:  vi.fn().mockResolvedValue([]),
    count:     vi.fn().mockResolvedValue(0),
    findOne:   vi.fn().mockResolvedValue(null), findById: vi.fn().mockResolvedValue(null),
    create:    vi.fn(), delete: vi.fn(), update: vi.fn(), exists: vi.fn().mockResolvedValue(false),
    ...followOverrides,
  };

  return {
    getRepository: vi.fn((name: string) => {
      if (name === 'User')    return userRepo;
      if (name === 'Post')    return postRepo;
      if (name === 'Comment') return commentRepo;
      if (name === 'Like')    return likeRepo;
      if (name === 'Follow')  return followRepo;
      if (name === 'Token')   return { revokeAllForUser: vi.fn().mockResolvedValue(undefined), findMany: vi.fn().mockResolvedValue([]), delete: vi.fn() };
      if (name === 'Notification') return { create: vi.fn(), findMany: vi.fn().mockResolvedValue([]), notify: vi.fn() };
      throw new Error(`Unknown repo: ${name}`);
    }),
    _userRepo: userRepo, _postRepo: postRepo,
    _commentRepo: commentRepo, _likeRepo: likeRepo, _followRepo: followRepo,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AdminService', () => {

  describe('getStats()', () => {
    it('returns counts from all four repos in parallel', async () => {
      const factory = makeFactory(
        { count: vi.fn().mockResolvedValue(4) },   // users
        { count: vi.fn().mockResolvedValue(6) },   // posts
        { count: vi.fn().mockResolvedValue(9) },   // comments
        { count: vi.fn().mockResolvedValue(12) },  // likes
      );
      const stats = await new AdminService(factory as any).getStats();

      expect(stats.users.total).toBe(4);
      expect(stats.posts.total).toBe(6);
      expect(stats.comments.total).toBe(9);
      expect(stats.likes.total).toBe(12);
    });

    it('does not include role or suspended counts', async () => {
      const stats = await new AdminService(makeFactory() as any).getStats();
      expect(stats.users).not.toHaveProperty('admins');
      expect(stats.users).not.toHaveProperty('suspended');
    });
  });

  describe('listUsers()', () => {
    it('returns offset-paginated users with email always included', async () => {
      const result = await new AdminService(makeFactory() as any).listUsers({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.email).toBe('alice@example.com');
      expect(result.items[0]!.followerCount).toBe(3);
      expect(result.items[0]!.followingCount).toBe(1);
      expect(result.meta.total).toBe(1);
    });

    it('includes suspended flag but no role on user objects', async () => {
      const result = await new AdminService(makeFactory() as any).listUsers({ page: 1, limit: 20 });
      expect(result.items[0]).not.toHaveProperty('role');
      expect(result.items[0]).toHaveProperty('suspended');
    });
  });

  describe('getUser()', () => {
    it('returns full user view with email and follow counts', async () => {
      const user = await new AdminService(makeFactory() as any).getUser('user-1');
      expect(user.email).toBe('alice@example.com');
      expect(user.followerCount).toBe(3);
      expect(user.followingCount).toBe(1);
    });

    it('throws 404 for unknown user', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(null) });
      await expect(new AdminService(factory as any).getUser('missing'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deletePost()', () => {
    it('soft-deletes any post regardless of author', async () => {
      const factory = makeFactory();
      await new AdminService(factory as any).deletePost('post-1');
      expect(factory._postRepo.softDelete).toHaveBeenCalledWith('post-1', 'admin_removed');
    });

    it('throws 404 when post not found', async () => {
      const factory = makeFactory({}, { findByIdRaw: vi.fn().mockResolvedValue(null) });
      await expect(new AdminService(factory as any).deletePost('missing'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('deleteComment()', () => {
    it('soft-deletes any comment regardless of author', async () => {
      const factory = makeFactory();
      await new AdminService(factory as any).deleteComment('c1');
      expect(factory._commentRepo.softDelete).toHaveBeenCalledWith('c1', 'admin_removed');
    });

    it('throws 404 when comment not found', async () => {
      const factory = makeFactory({}, {}, { findByIdRaw: vi.fn().mockResolvedValue(null) });
      await expect(new AdminService(factory as any).deleteComment('missing'))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

});
