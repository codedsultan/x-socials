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
    findOne: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    exists: vi.fn().mockResolvedValue(false),
  };
  const postRepo = {
    findById: vi.fn().mockResolvedValue(postExists ? makePost() : null),
    create: vi.fn(), update: vi.fn(), delete: vi.fn(), findMany: vi.fn(), findOne: vi.fn(),
    exists: vi.fn(), findByAuthor: vi.fn(), findByTag: vi.fn(), incrementLikes: vi.fn(),
  };
  return {
    getRepository: vi.fn((name: string) => name === 'Comment' ? commentRepo : postRepo),
    _commentRepo: commentRepo,
    _postRepo: postRepo,
  };
}

describe('CommentsService', () => {
  describe('listForPost', () => {
    it('returns comments for a post', async () => {
      const factory = makeFactory();
      const service = new CommentsService(factory as any);
      const comments = await service.listForPost('post-1');
      expect(comments).toHaveLength(1);
    });

    it('throws 404 when post does not exist', async () => {
      const factory = makeFactory({ postExists: false });
      const service = new CommentsService(factory as any);
      await expect(service.listForPost('missing')).rejects.toMatchObject({ statusCode: 404 });
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
      expect(factory._commentRepo.delete).toHaveBeenCalledWith('c-1');
    });
  });
});
