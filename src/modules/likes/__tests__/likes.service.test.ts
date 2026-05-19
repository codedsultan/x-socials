import { describe, it, expect, vi } from 'vitest';
import { LikesService } from '../likes.service';

function makePost(overrides = {}) {
  return { id: 'post-1', title: 'T', content: 'C', authorId: 'user-1', tags: [], likesCount: 2, ...overrides };
}

function makeFactory({ alreadyLiked = false } = {}) {
  const likeRepo = {
    hasUserLiked: vi.fn().mockResolvedValue(alreadyLiked),
    findOne: vi.fn().mockResolvedValue(alreadyLiked ? { id: 'like-1' } : null),
    findByTarget: vi.fn().mockResolvedValue([{ id: 'like-1' }, { id: 'like-2' }]),
    create: vi.fn().mockResolvedValue({ id: 'like-new' }),
    delete: vi.fn().mockResolvedValue(true),
    findById: vi.fn(), findMany: vi.fn(), update: vi.fn(), exists: vi.fn(), findByPost: vi.fn(),
  };
  const postRepo = {
    findById: vi.fn().mockResolvedValue(makePost()),
    update: vi.fn().mockResolvedValue(makePost({ likesCount: 1 })),
    incrementLikes: vi.fn().mockResolvedValue(makePost({ likesCount: 3 })),
    create: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findOne: vi.fn(),
    exists: vi.fn(), findByAuthor: vi.fn(), findByTag: vi.fn(),
  };
    const notifRepo = {
    notify:      vi.fn().mockResolvedValue(null),
    listForUser: vi.fn().mockResolvedValue([]),
    countUnread: vi.fn().mockResolvedValue(0),
    markRead:    vi.fn().mockResolvedValue(true),
    markAllRead: vi.fn().mockResolvedValue(undefined),
    findMany:    vi.fn().mockResolvedValue([]),
    findById:    vi.fn().mockResolvedValue(null),
    findOne:     vi.fn().mockResolvedValue(null),
    create:      vi.fn().mockResolvedValue({ id: 'n1' }),
    update:      vi.fn().mockResolvedValue(null),
    delete:      vi.fn().mockResolvedValue(true),
    exists:      vi.fn().mockResolvedValue(false),
    count:       vi.fn().mockResolvedValue(0),
  };
  return {
    getRepository: vi.fn((name: string) => {
      if (name === 'Like')         return likeRepo;
      if (name === 'Comment')      return { findById: vi.fn().mockResolvedValue(null) };
      if (name === 'Notification') return notifRepo;
      return postRepo;
    }),
    _likeRepo: likeRepo,
    _postRepo: postRepo,
  };
}

describe('LikesService', () => {
  describe('toggle', () => {
    it('creates a like when the user has not liked yet', async () => {
      const factory = makeFactory({ alreadyLiked: false });
      const service = new LikesService(factory as any);
      const result = await service.toggle('user-1', 'post-1', 'post');
      expect(result.liked).toBe(true);
      expect(factory._likeRepo.create).toHaveBeenCalledOnce();
      expect(factory._postRepo.incrementLikes).toHaveBeenCalledWith('post-1');
    });

    it('removes the like when the user already liked', async () => {
      const factory = makeFactory({ alreadyLiked: true });
      const service = new LikesService(factory as any);
      const result = await service.toggle('user-1', 'post-1', 'post');
      expect(result.liked).toBe(false);
      expect(factory._likeRepo.delete).toHaveBeenCalledWith('like-1');
    });

    it('does not call incrementLikes for comment likes', async () => {
      const factory = makeFactory({ alreadyLiked: false });
      const service = new LikesService(factory as any);
      await service.toggle('user-1', 'comment-1', 'comment');
      expect(factory._postRepo.incrementLikes).not.toHaveBeenCalled();
    });
  });

  describe('getLikeCount', () => {
    it('returns the count from the repo', async () => {
      const factory = makeFactory();
      const service = new LikesService(factory as any);
      const count = await service.getLikeCount('post-1', 'post');
      expect(count).toBe(2); // makeFactory returns 2 likes
    });
  });

  describe('hasLiked', () => {
    it('returns true when the user liked', async () => {
      const factory = makeFactory({ alreadyLiked: true });
      const service = new LikesService(factory as any);
      expect(await service.hasLiked('user-1', 'post-1', 'post')).toBe(true);
    });

    it('returns false when the user has not liked', async () => {
      const factory = makeFactory({ alreadyLiked: false });
      const service = new LikesService(factory as any);
      expect(await service.hasLiked('user-1', 'post-1', 'post')).toBe(false);
    });
  });
});
