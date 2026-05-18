import { describe, it, expect, vi } from 'vitest';
import { PostRepository } from '../../../repositories/PostRepository';

function makePost(overrides = {}) {
  return { id: 'post-1', title: 'T', content: 'C', authorId: 'user-1', tags: ['ts', 'node'], likesCount: 2, ...overrides };
}

function makeMongoAdapter(overrides: Record<string, any> = {}) {
  return {
    // Presence of `models` property signals MongooseAdapter to PostRepository
    models: new Map(),
    findMany: vi.fn().mockResolvedValue([makePost()]),
    findOne: vi.fn().mockResolvedValue(makePost()),
    findById: vi.fn().mockResolvedValue(makePost()),
    create: vi.fn().mockResolvedValue(makePost()),
    update: vi.fn().mockResolvedValue(makePost({ likesCount: 3 })),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    migrate: vi.fn(),
    withTransaction: vi.fn(),
    getClient: vi.fn(),
    ...overrides,
  };
}

function makeSqlAdapter(overrides: Record<string, any> = {}) {
  return {
    // No `models` property → KnexAdapter branch in PostRepository
    findMany: vi.fn().mockResolvedValue([makePost()]),
    findOne: vi.fn().mockResolvedValue(makePost()),
    create: vi.fn().mockResolvedValue(makePost()),
    update: vi.fn().mockResolvedValue(makePost({ likesCount: 3 })),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(),
    migrate: vi.fn(),
    withTransaction: vi.fn(),
    getClient: vi.fn(),
    ...overrides,
  };
}

describe('PostRepository', () => {
  describe('findByTag()', () => {
    it('calls findMany with a scalar tag value (Mongoose array match)', async () => {
      const adapter = makeMongoAdapter();
      const repo = new PostRepository(adapter as any, 'Post');

      await repo.findByTag('typescript');

      expect(adapter.findMany).toHaveBeenCalledWith(
        'Post',
        expect.objectContaining({ tags: 'typescript' }),
        undefined
      );
    });

    it('passes FindOptions through to the adapter', async () => {
      const adapter = makeMongoAdapter();
      const repo = new PostRepository(adapter as any, 'Post');

      await repo.findByTag('node', { limit: 5, skip: 10 });

      expect(adapter.findMany).toHaveBeenCalledWith(
        'Post',
        expect.any(Object),
        { limit: 5, skip: 10 }
      );
    });
  });

  describe('findByAuthor()', () => {
    it('delegates to findMany with authorId filter', async () => {
      const adapter = makeMongoAdapter();
      const repo = new PostRepository(adapter as any, 'Post');

      await repo.findByAuthor('user-42', { limit: 10, skip: 0 });

      expect(adapter.findMany).toHaveBeenCalledWith(
        'Post',
        { authorId: 'user-42' },
        { limit: 10, skip: 0 }
      );
    });
  });

  describe('incrementLikes()', () => {
    it('uses $inc operator for Mongoose adapter', async () => {
      const adapter = makeMongoAdapter();
      const repo = new PostRepository(adapter as any, 'Post');

      await repo.incrementLikes('post-1');

      expect(adapter.update).toHaveBeenCalledWith(
        'Post',
        'post-1',
        expect.objectContaining({ $inc: { likesCount: 1 } })
      );
    });

    it('uses likesCountIncrement for SQL adapter (atomic raw expression)', async () => {
      const adapter = makeSqlAdapter();
      const repo = new PostRepository(adapter as any, 'Post');

      await repo.incrementLikes('post-1');

      expect(adapter.update).toHaveBeenCalledWith(
        'Post',
        'post-1',
        expect.objectContaining({ likesCountIncrement: 1 })
      );
    });

    it('does NOT pass $inc to the SQL adapter', async () => {
      const adapter = makeSqlAdapter();
      const repo = new PostRepository(adapter as any, 'Post');

      await repo.incrementLikes('post-1');

      const payload = adapter.update.mock.calls[0][2] as Record<string, unknown>;
      expect(payload).not.toHaveProperty('$inc');
    });
  });
});
