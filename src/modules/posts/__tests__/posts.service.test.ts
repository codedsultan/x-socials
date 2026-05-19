import { describe, it, expect, vi } from 'vitest';
import { PostsService } from '../posts.service';

function makePost(overrides = {}) {
  return { id: 'post-1', title: 'Hello', content: 'World', authorId: 'user-1', tags: [], likesCount: 0, ...overrides };
}

function makePostRepo(overrides: Record<string, any> = {}) {
  return {
    findMany: vi.fn().mockResolvedValue([makePost()]),
    findById: vi.fn().mockResolvedValue(makePost()),
    findByAuthor: vi.fn().mockResolvedValue([makePost()]),
    findByTag: vi.fn().mockResolvedValue([makePost()]),
    create: vi.fn().mockResolvedValue(makePost()),
    update: vi.fn().mockResolvedValue(makePost()),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(false),
    findOne: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(1),
    incrementLikes: vi.fn().mockResolvedValue(makePost({ likesCount: 1 })),
    ...overrides,
  };
}

function makeFactory(postOverrides = {}) {
  const postRepo = makePostRepo(postOverrides);
  return {
    getRepository: vi.fn(() => postRepo),
    _postRepo: postRepo,
  };
}

describe('PostsService', () => {
  describe('listPosts', () => {
    it('returns all posts with default params', async () => {
      const factory = makeFactory();
      const service = new PostsService(factory as any);
      const result = await service.listPosts({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.meta).toBeDefined();
      expect(factory._postRepo.findMany).toHaveBeenCalledWith({}, { limit: 20, skip: 0, sort: { createdAt: -1 } });
    });

    it('delegates to findByTag when tag is provided', async () => {
      const factory = makeFactory();
      const service = new PostsService(factory as any);
      await service.listPosts({ page: 1, limit: 10, tag: 'typescript' });
      expect(factory._postRepo.findByTag).toHaveBeenCalledWith('typescript', { limit: 10, skip: 0, sort: { createdAt: -1 } });
    });

    it('delegates to findByAuthor when authorId is provided', async () => {
      const factory = makeFactory();
      const service = new PostsService(factory as any);
      await service.listPosts({ page: 2, limit: 5, authorId: 'user-1' });
      expect(factory._postRepo.findByAuthor).toHaveBeenCalledWith('user-1', { limit: 5, skip: 5, sort: { createdAt: -1 } });
    });
  });

  describe('getPost', () => {
    it('returns a post by id', async () => {
      const factory = makeFactory();
      const service = new PostsService(factory as any);
      const post = await service.getPost('post-1');
      expect(post.id).toBe('post-1');
    });

    it('throws 404 when post does not exist', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(null) });
      const service = new PostsService(factory as any);
      await expect(service.getPost('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('createPost', () => {
    it('sets authorId to the acting user', async () => {
      const factory = makeFactory();
      const service = new PostsService(factory as any);
      await service.createPost('user-99', { title: 'T', content: 'C' });
      const createArg = factory._postRepo.create.mock.calls[0][0];
      expect(createArg.authorId).toBe('user-99');
    });
  });

  describe('updatePost', () => {
    it('throws 403 when a different user tries to update', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(makePost({ authorId: 'user-1' })) });
      const service = new PostsService(factory as any);
      await expect(service.updatePost('user-2', 'post-1', { title: 'X' }))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('allows author to update their own post', async () => {
      const factory = makeFactory();
      const service = new PostsService(factory as any);
      const post = await service.updatePost('user-1', 'post-1', { title: 'Updated' });
      expect(post).toBeDefined();
      expect(factory._postRepo.update).toHaveBeenCalledWith('post-1', { title: 'Updated' });
    });
  });

  describe('deletePost', () => {
    it('throws 403 when a different user tries to delete', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(makePost({ authorId: 'user-1' })) });
      const service = new PostsService(factory as any);
      await expect(service.deletePost('user-2', 'post-1'))
        .rejects.toMatchObject({ statusCode: 403 });
    });

    it('deletes when called by the author', async () => {
      const factory = makeFactory();
      const service = new PostsService(factory as any);
      await service.deletePost('user-1', 'post-1');
      expect(factory._postRepo.delete).toHaveBeenCalledWith('post-1');
    });
  });
});
