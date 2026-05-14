import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RepositoryFactory } from '../../../factories/RepositoryFactory';
import { PostRepository } from '../../../repositories/PostRepository';
import { UserRepository } from '../../../repositories/UserRepository';
import { CommentRepository } from '../../../repositories/CommentRepository';
import { LikeRepository } from '../../../repositories/LikeRepository';
import { OtpRepository } from '../../../repositories/OtpRepository';
import { TokenRepository } from '../../../repositories/TokenRepository';
import { BaseRepository } from '../../../repositories/BaseRepository';
import type { IDatabaseAdapter } from '../../../interfaces/db/IAdapter';
import type { DbResolver } from '../../../database/core/DbResolver';

function makeMockAdapter(): IDatabaseAdapter {
    return {
        connect: vi.fn(), disconnect: vi.fn(), isConnected: vi.fn().mockResolvedValue(true),
        registerModel: vi.fn(), migrate: vi.fn(),
        findOne: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(), update: vi.fn(), delete: vi.fn(), withTransaction: vi.fn(),
        getClient: vi.fn()
    };
}

function makeMockResolver(adapter: IDatabaseAdapter): DbResolver {
    return { getAdapterForModel: vi.fn().mockReturnValue(adapter) } as unknown as DbResolver;
}

describe('RepositoryFactory', () => {
    let adapter: IDatabaseAdapter;
    let resolver: DbResolver;
    let factory: RepositoryFactory;

    beforeEach(() => {
        adapter = makeMockAdapter();
        resolver = makeMockResolver(adapter);
        factory = new RepositoryFactory(resolver);
    });

    it('returns PostRepository for "Post"', () => {
        expect(factory.getRepository('Post')).toBeInstanceOf(PostRepository);
    });

    it('returns UserRepository for "User"', () => {
        expect(factory.getRepository('User')).toBeInstanceOf(UserRepository);
    });

    it('returns CommentRepository for "Comment"', () => {
        expect(factory.getRepository('Comment')).toBeInstanceOf(CommentRepository);
    });

    it('returns LikeRepository for "Like"', () => {
        expect(factory.getRepository('Like')).toBeInstanceOf(LikeRepository);
    });

    it('returns OtpRepository for "Otp"', () => {
        expect(factory.getRepository('Otp')).toBeInstanceOf(OtpRepository);
    });

    it('returns TokenRepository for "Token"', () => {
        expect(factory.getRepository('Token')).toBeInstanceOf(TokenRepository);
    });

    it('returns BaseRepository for unknown models', () => {
        expect(factory.getRepository('Foobar')).toBeInstanceOf(BaseRepository);
    });

    it('caches repository instances (same ref on second call)', () => {
        const r1 = factory.getRepository('Post');
        const r2 = factory.getRepository('Post');
        expect(r1).toBe(r2);
    });

    it('calls resolver.getAdapterForModel once per model (caching)', () => {
        factory.getRepository('User');
        factory.getRepository('User');
        expect(resolver.getAdapterForModel).toHaveBeenCalledTimes(1);
    });
});
