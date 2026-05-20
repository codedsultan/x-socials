import { describe, it, expect, vi } from 'vitest';
import { CommentsService } from '../comments.service';

function makeComment(overrides = {}) {
  return { id: 'c-1', postId: 'post-1', authorId: 'user-1', content: 'Nice!', parentId: null, ...overrides };
}

function makePost() {
  return { id: 'post-1', title: 'T', content: 'C', authorId: 'user-1', tags: [], likesCount: 0 };
}

function makeFactory({ postExists = true, commentOverrides = {} } = {}) {
  const commentRepo = {
    findByPost: vi.fn().mockResolvedValue([makeComment()]),
    findReplies: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockResolvedValue(makeComment(commentOverrides)),
    create: vi.fn().mockResolvedValue(makeComment()),
    update: vi.fn().mockResolvedValue(makeComment({ content: 'Updated' })),
    delete: vi.fn().mockResolvedValue(true),
    softDelete: vi.fn().mockResolvedValue(undefined),
    findMany: vi.fn().mockResolvedValue([makeComment()]),
    exists: vi.fn().mockResolvedValue(false),
    count: vi.fn().mockResolvedValue(1),
  };
  const postRepo = {
    findById: vi.fn().mockResolvedValue(postExists ? makePost() : null),
    create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    exists: vi.fn(), findByAuthor: vi.fn(), findByTag: vi.fn(),
    incrementLikes: vi.fn(), count: vi.fn().mockResolvedValue(0),
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
      if (name === 'Comment')      return commentRepo;
      if (name === 'Notification') return notifRepo;
      return postRepo;
    }),
    _commentRepo: commentRepo,
    _postRepo: postRepo,
  };
}

describe('CommentsService', () => {
  describe('listForPost', () => {
    it('returns paginated comments for a post', async () => {
      const factory = makeFactory();
      const service = new CommentsService(factory as any);
      const result = await service.listForPost('post-1', { limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.meta).toBeDefined();
    });

    it('throws 404 when post does not exist', async () => {
      const factory = makeFactory({ postExists: false });
      const service = new CommentsService(factory as any);
      await expect(service.listForPost('missing', { limit: 20 })).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('createComment', () => {
    it('creates a top-level comment', async () => {
      const factory = makeFactory();
      const service = new CommentsService(factory as any);
      const comment = await service.createComment('user-1', 'post-1', { content: 'Nice!' });
      expect(comment.content).toBe('Nice!');
      expect(factory._commentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ postId: 'post-1', authorId: 'user-1' })
      );
    });

    it('throws 404 when post does not exist', async () => {
      const factory = makeFactory({ postExists: false });
      const service = new CommentsService(factory as any);
      await expect(service.createComment('user-1', 'bad-post', { content: 'x' }))
        .rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('updateComment', () => {
    it('throws 403 when a different user tries to update', async () => {
      const factory = makeFactory();
      const service = new CommentsService(factory as any);
      await expect(service.updateComment('user-99', 'c-1', { content: 'Hack' }))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows author to update', async () => {
      const factory = makeFactory();
      const service = new CommentsService(factory as any);
      const result = await service.updateComment('user-1', 'c-1', { content: 'Updated' });
      expect(result.content).toBe('Updated');
    });
  });

  describe('deleteComment', () => {
    it('throws 403 for non-author', async () => {
      const factory = makeFactory();
      const service = new CommentsService(factory as any);
      await expect(service.deleteComment('user-99', 'c-1'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('deletes when called by author', async () => {
      const factory = makeFactory();
      const service = new CommentsService(factory as any);
      await service.deleteComment('user-1', 'c-1');
      expect(factory._commentRepo.softDelete).toHaveBeenCalledWith('c-1', 'author_deleted');
    });
  });
});
