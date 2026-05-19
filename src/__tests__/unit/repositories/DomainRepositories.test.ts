import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IDatabaseAdapter } from '../../../interfaces/db/IAdapter';
import { UserRepository } from '../../../repositories/UserRepository';
import { PostRepository } from '../../../repositories/PostRepository';
import { CommentRepository } from '../../../repositories/CommentRepository';
import { LikeRepository } from '../../../repositories/LikeRepository';
import { OtpRepository } from '../../../repositories/OtpRepository';
import { TokenRepository } from '../../../repositories/TokenRepository';

function makeAdapter(): IDatabaseAdapter {
    return {
        connect: vi.fn(), disconnect: vi.fn(), isConnected: vi.fn().mockResolvedValue(true),
        registerModel: vi.fn(), migrate: vi.fn().mockResolvedValue(undefined),
        findOne: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: '1' }),
        update: vi.fn().mockResolvedValue({ id: '1' }),
        delete: vi.fn().mockResolvedValue(true),
        count: vi.fn().mockResolvedValue(0),
        withTransaction: vi.fn(),
        getClient: vi.fn()
    };
}

// ─── UserRepository ───────────────────────────────────────────────────────────
describe('UserRepository', () => {
    let adapter: IDatabaseAdapter;
    let repo: UserRepository;

    beforeEach(() => { adapter = makeAdapter(); repo = new UserRepository(adapter, 'User'); });

    it('findByEmail calls findOne with { email }', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue({ id: '1', email: 'a@b.com' });
        const result = await repo.findByEmail('a@b.com');
        expect(adapter.findOne).toHaveBeenCalledWith('User', { email: 'a@b.com' });
        expect(result).toMatchObject({ email: 'a@b.com' });
    });

    it('findByEmail returns null when not found', async () => {
        expect(await repo.findByEmail('nope@b.com')).toBeNull();
    });

    it('emailExists returns true when found', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue({ id: '1' });
        expect(await repo.emailExists('a@b.com')).toBe(true);
    });

    it('emailExists returns false when not found', async () => {
        expect(await repo.emailExists('nope@b.com')).toBe(false);
    });
});

// ─── PostRepository ───────────────────────────────────────────────────────────
describe('PostRepository', () => {
    let adapter: IDatabaseAdapter;
    let repo: PostRepository;

    beforeEach(() => { adapter = makeAdapter(); repo = new PostRepository(adapter, 'Post'); });

    it('findByAuthor calls findMany with { authorId }', async () => {
        vi.mocked(adapter.findMany).mockResolvedValue([{ id: '1', authorId: 'u1' }]);
        const results = await repo.findByAuthor('u1');
        expect(adapter.findMany).toHaveBeenCalledWith('Post', { authorId: 'u1' }, undefined);
        expect(results).toHaveLength(1);
    });

    it('findByAuthor passes options through', async () => {
        await repo.findByAuthor('u1', { limit: 5 });
        expect(adapter.findMany).toHaveBeenCalledWith('Post', { authorId: 'u1' }, { limit: 5 });
    });

    it('findByTag calls findMany with scalar tag (Mongoose array-element match)', async () => {
        await repo.findByTag('typescript');
        expect(adapter.findMany).toHaveBeenCalledWith('Post', { tags: 'typescript' }, undefined);
    });

    it('incrementLikes uses likesCountIncrement on SQL adapters (no models property)', async () => {
        await repo.incrementLikes('post-1');
        expect(adapter.update).toHaveBeenCalledWith(
            'Post', 'post-1', { likesCountIncrement: 1 }
        );
    });
});

// ─── CommentRepository ────────────────────────────────────────────────────────
describe('CommentRepository', () => {
    let adapter: IDatabaseAdapter;
    let repo: CommentRepository;

    beforeEach(() => { adapter = makeAdapter(); repo = new CommentRepository(adapter, 'Comment'); });

    it('findByPost calls findMany with { postId }', async () => {
        await repo.findByPost('post-1');
        expect(adapter.findMany).toHaveBeenCalledWith('Comment', { postId: 'post-1' }, undefined);
    });

    it('findByPost passes options through', async () => {
        await repo.findByPost('post-1', { limit: 10 });
        expect(adapter.findMany).toHaveBeenCalledWith('Comment', { postId: 'post-1' }, { limit: 10 });
    });

    it('findReplies calls findMany with { parentId }', async () => {
        await repo.findReplies('comment-1');
        expect(adapter.findMany).toHaveBeenCalledWith('Comment', { parentId: 'comment-1' }, undefined);
    });
});

// ─── LikeRepository ──────────────────────────────────────────────────────────
describe('LikeRepository', () => {
    let adapter: IDatabaseAdapter;
    let repo: LikeRepository;

    beforeEach(() => { adapter = makeAdapter(); repo = new LikeRepository(adapter, 'Like'); });

    it('hasUserLiked returns true when like exists', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue({ id: '1' });
        expect(await repo.hasUserLiked('u1', 'post-1', 'post')).toBe(true);
    });

    it('hasUserLiked returns false when no like found', async () => {
        expect(await repo.hasUserLiked('u1', 'post-1', 'post')).toBe(false);
    });

    it('hasUserLiked calls findOne with correct composite filter', async () => {
        await repo.hasUserLiked('u1', 'post-1', 'comment');
        expect(adapter.findOne).toHaveBeenCalledWith('Like', {
            userId: 'u1', targetId: 'post-1', targetType: 'comment',
        });
    });

    it('findByTarget calls findMany with targetId and targetType', async () => {
        await repo.findByTarget('post-1', 'post');
        expect(adapter.findMany).toHaveBeenCalledWith('Like', { targetId: 'post-1', targetType: 'post' }, undefined);
    });
});

// ─── OtpRepository ───────────────────────────────────────────────────────────
describe('OtpRepository', () => {
    let adapter: IDatabaseAdapter;
    let repo: OtpRepository;

    beforeEach(() => { adapter = makeAdapter(); repo = new OtpRepository(adapter, 'Otp'); });

    it('findValidOtp calls findOne with composite filter including used=false', async () => {
        await repo.findValidOtp('u1', '123456', 'email-verify');
        expect(adapter.findOne).toHaveBeenCalledWith('Otp', {
            userId: 'u1', code: '123456', purpose: 'email-verify', used: false,
        });
    });

    it('findValidOtp returns null when not found', async () => {
        expect(await repo.findValidOtp('u1', 'bad', 'email-verify')).toBeNull();
    });

    it('markUsed calls update with { used: true }', async () => {
        vi.mocked(adapter.update).mockResolvedValue({ id: '1', used: true });
        const result = await repo.markUsed('otp-1');
        expect(adapter.update).toHaveBeenCalledWith('Otp', 'otp-1', { used: true });
        expect(result).toMatchObject({ used: true });
    });
});

// ─── TokenRepository ─────────────────────────────────────────────────────────
describe('TokenRepository', () => {
    let adapter: IDatabaseAdapter;
    let repo: TokenRepository;

    beforeEach(() => { adapter = makeAdapter(); repo = new TokenRepository(adapter, 'Token'); });

    it('findByValue calls findOne with { token }', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue({ id: '1', token: 'tok-abc' });
        const result = await repo.findByValue('tok-abc');
        expect(adapter.findOne).toHaveBeenCalledWith('Token', { token: 'tok-abc' });
        expect(result).toMatchObject({ token: 'tok-abc' });
    });

    it('findByValue returns null for unknown token', async () => {
        expect(await repo.findByValue('unknown')).toBeNull();
    });

    it('revokeAllForUser finds all tokens and deletes each', async () => {
        vi.mocked(adapter.findMany).mockResolvedValue([
            { id: 't1', userId: 'u1' },
            { id: 't2', userId: 'u1' },
        ]);
        await repo.revokeAllForUser('u1');
        expect(adapter.findMany).toHaveBeenCalledWith('Token', { userId: 'u1' }, undefined);
        expect(adapter.delete).toHaveBeenCalledTimes(2);
        expect(adapter.delete).toHaveBeenCalledWith('Token', 't1');
        expect(adapter.delete).toHaveBeenCalledWith('Token', 't2');
    });

    it('revokeAllForUser does nothing when no tokens exist', async () => {
        await repo.revokeAllForUser('u-no-tokens');
        expect(adapter.delete).not.toHaveBeenCalled();
    });
});
