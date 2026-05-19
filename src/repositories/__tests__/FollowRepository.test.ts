import { describe, it, expect, vi } from 'vitest';
import { FollowRepository } from '../FollowRepository';

function makeFollow(followerId = 'user-1', followingId = 'user-2') {
  return { followerId, followingId, createdAt: new Date() };
}

function makeAdapter(overrides: Record<string, any> = {}) {
  return {
    findOne:  vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create:   vi.fn().mockResolvedValue(makeFollow()),
    update:   vi.fn().mockResolvedValue(null),
    delete:   vi.fn().mockResolvedValue(true),
    exists:   vi.fn().mockResolvedValue(false),
    count:    vi.fn().mockResolvedValue(0),  // ← added: getFollowerCount/getFollowingCount delegate here
    connect: vi.fn(), disconnect: vi.fn(), isConnected: vi.fn(),
    migrate: vi.fn(), withTransaction: vi.fn(), getClient: vi.fn(),
    ...overrides,
  };
}

describe('FollowRepository', () => {
  describe('follow()', () => {
    it('calls adapter.create with followerId and followingId', async () => {
      const adapter = makeAdapter();
      const repo = new FollowRepository(adapter as any, 'Follow');

      await repo.follow('user-1', 'user-2');

      expect(adapter.create).toHaveBeenCalledWith(
        'Follow',
        expect.objectContaining({ followerId: 'user-1', followingId: 'user-2' })
      );
    });
  });

  describe('isFollowing()', () => {
    it('returns false when no follow edge exists', async () => {
      const adapter = makeAdapter({ findOne: vi.fn().mockResolvedValue(null) });
      const repo = new FollowRepository(adapter as any, 'Follow');

      expect(await repo.isFollowing('user-1', 'user-2')).toBe(false);
    });

    it('returns true when the follow edge exists', async () => {
      const adapter = makeAdapter({ findOne: vi.fn().mockResolvedValue(makeFollow()) });
      const repo = new FollowRepository(adapter as any, 'Follow');

      expect(await repo.isFollowing('user-1', 'user-2')).toBe(true);
    });
  });

  describe('getFollowingIds()', () => {
    it('extracts followingId from each row', async () => {
      const rows = [
        makeFollow('user-1', 'user-2'),
        makeFollow('user-1', 'user-3'),
      ];
      const adapter = makeAdapter({ findMany: vi.fn().mockResolvedValue(rows) });
      const repo = new FollowRepository(adapter as any, 'Follow');

      const ids = await repo.getFollowingIds('user-1');

      expect(ids).toEqual(['user-2', 'user-3']);
      expect(adapter.findMany).toHaveBeenCalledWith(
        'Follow',
        expect.objectContaining({ followerId: 'user-1' }),
        undefined
      );
    });

    it('returns empty array when user follows nobody', async () => {
      const adapter = makeAdapter({ findMany: vi.fn().mockResolvedValue([]) });
      const repo = new FollowRepository(adapter as any, 'Follow');

      expect(await repo.getFollowingIds('user-1')).toEqual([]);
    });
  });

  describe('getFollowerIds()', () => {
    it('extracts followerId from each row', async () => {
      const rows = [makeFollow('user-2', 'user-1'), makeFollow('user-3', 'user-1')];
      const adapter = makeAdapter({ findMany: vi.fn().mockResolvedValue(rows) });
      const repo = new FollowRepository(adapter as any, 'Follow');

      const ids = await repo.getFollowerIds('user-1');

      expect(ids).toEqual(['user-2', 'user-3']);
    });
  });

  describe('getFollowingCount() / getFollowerCount()', () => {
    it('delegates to adapter.count() — O(1) indexed query, no row fetch', async () => {
      // count() returns the number directly; we no longer fetch rows to measure length
      const adapter = makeAdapter({ count: vi.fn().mockResolvedValue(2) });
      const repo    = new FollowRepository(adapter as any, 'Follow');

      expect(await repo.getFollowingCount('user-1')).toBe(2);
      expect(await repo.getFollowerCount('user-1')).toBe(2);
      // Verify count() was called — findMany() must NOT be called
      expect(adapter.count).toHaveBeenCalled();
      expect(adapter.findMany).not.toHaveBeenCalled();
    });
  });
});
