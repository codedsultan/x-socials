import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseRepository } from '../../../repositories/BaseRepository';
import type { IDatabaseAdapter } from '../../../interfaces/db/IAdapter';

function makeMockAdapter(): IDatabaseAdapter {
    return {
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        isConnected: vi.fn().mockResolvedValue(true),
        registerModel: vi.fn(),
        migrate: vi.fn().mockResolvedValue(undefined),
        findOne: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: '1', email: 'a@b.com' }),
        update: vi.fn().mockResolvedValue({ id: '1', email: 'b@b.com' }),
        delete: vi.fn().mockResolvedValue(true),
        withTransaction: vi.fn(),
        getClient: vi.fn(),
        count: vi.fn().mockResolvedValue(0)
    };
}

interface TestUser {
    id: string;
    email: string;
}

describe('BaseRepository', () => {
    let adapter: IDatabaseAdapter;
    let repo: BaseRepository<TestUser>;

    beforeEach(() => {
        adapter = makeMockAdapter();
        repo = new BaseRepository<TestUser>(adapter, 'User');
    });

    it('findById calls adapter.findOne with { id }', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue({ id: '1', email: 'a@b.com' });
        const result = await repo.findById('1');
        expect(adapter.findOne).toHaveBeenCalledWith('User', { id: '1' });
        expect(result).toEqual({ id: '1', email: 'a@b.com' });
    });

    it('findById returns null when not found', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue(null);
        expect(await repo.findById('nope')).toBeNull();
    });

    it('findOne delegates filter to adapter', async () => {
        await repo.findOne({ email: 'a@b.com' });
        expect(adapter.findOne).toHaveBeenCalledWith('User', { email: 'a@b.com' });
    });

    it('findMany delegates filter and options', async () => {
        vi.mocked(adapter.findMany).mockResolvedValue([{ id: '1', email: 'a@b.com' }]);
        const result = await repo.findMany({}, { limit: 5 });
        expect(adapter.findMany).toHaveBeenCalledWith('User', {}, { limit: 5 });
        expect(result).toHaveLength(1);
    });

    it('create delegates to adapter', async () => {
        const result = await repo.create({ email: 'a@b.com' });
        expect(adapter.create).toHaveBeenCalledWith('User', { email: 'a@b.com' });
        expect(result).toEqual({ id: '1', email: 'a@b.com' });
    });

    it('update delegates id and data to adapter', async () => {
        await repo.update('1', { email: 'b@b.com' });
        expect(adapter.update).toHaveBeenCalledWith('User', '1', { email: 'b@b.com' });
    });

    it('delete delegates to adapter', async () => {
        const ok = await repo.delete('1');
        expect(adapter.delete).toHaveBeenCalledWith('User', '1');
        expect(ok).toBe(true);
    });

    it('exists returns true when findOne returns a record', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue({ id: '1', email: 'a@b.com' });
        expect(await repo.exists({ email: 'a@b.com' })).toBe(true);
    });

    it('exists returns false when findOne returns null', async () => {
        vi.mocked(adapter.findOne).mockResolvedValue(null);
        expect(await repo.exists({ email: 'nope@b.com' })).toBe(false);
    });
});
