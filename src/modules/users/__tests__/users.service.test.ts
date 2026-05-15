import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UsersService } from '../users.service';

function makeUser(overrides = {}) {
  return { id: 'user-1', email: 'a@b.com', name: 'Alice', passwordHash: 'h', createdAt: new Date(), ...overrides };
}

function makeUserRepo(overrides: Record<string, any> = {}) {
  return {
    findById: vi.fn().mockResolvedValue(makeUser()),
    findByEmail: vi.fn().mockResolvedValue(null),
    emailExists: vi.fn().mockResolvedValue(false),
    findMany: vi.fn().mockResolvedValue([makeUser()]),
    create: vi.fn().mockResolvedValue(makeUser()),
    update: vi.fn().mockResolvedValue(makeUser({ name: 'Updated' })),
    delete: vi.fn().mockResolvedValue(true),
    exists: vi.fn().mockResolvedValue(false),
    findOne: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeFollowRepo(overrides: Record<string, any> = {}) {
  return {
    isFollowing: vi.fn().mockResolvedValue(false),
    follow: vi.fn().mockResolvedValue({ followerId: 'user-1', followingId: 'user-2', createdAt: new Date() }),
    unfollow: vi.fn().mockResolvedValue(true),
    getFollowerIds: vi.fn().mockResolvedValue([]),
    getFollowingIds: vi.fn().mockResolvedValue([]),
    getFollowerCount: vi.fn().mockResolvedValue(0),
    getFollowingCount: vi.fn().mockResolvedValue(0),
    findMany: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(null),
    findById: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
    exists: vi.fn().mockResolvedValue(false),
    ...overrides,
  };
}

function makeFactory(userOverrides = {}, followOverrides = {}) {
  const userRepo = makeUserRepo(userOverrides);
  const followRepo = makeFollowRepo(followOverrides);
  return {
    getRepository: vi.fn((name: string) => {
      if (name === 'User') return userRepo;
      if (name === 'Follow') return followRepo;
      throw new Error(`Unknown: ${name}`);
    }),
    _userRepo: userRepo,
    _followRepo: followRepo,
  };
}

describe('UsersService', () => {
  describe('getProfile()', () => {
    it('returns profile with follower/following counts', async () => {
      const factory = makeFactory(
        {},
        { getFollowerCount: vi.fn().mockResolvedValue(5), getFollowingCount: vi.fn().mockResolvedValue(3) }
      );
      const service = new UsersService(factory as any);
      const profile = await service.getProfile('user-1');

      expect(profile.followerCount).toBe(5);
      expect(profile.followingCount).toBe(3);
    });

    it('includes isFollowedByMe: true when viewer follows the user', async () => {
      const factory = makeFactory({}, { isFollowing: vi.fn().mockResolvedValue(true) });
      const service = new UsersService(factory as any);
      const profile = await service.getProfile('user-2', 'user-1');

      expect(profile.isFollowedByMe).toBe(true);
    });

    it('always returns isFollowedByMe: false for own profile', async () => {
      const factory = makeFactory({}, { isFollowing: vi.fn().mockResolvedValue(true) });
      const service = new UsersService(factory as any);
      const profile = await service.getProfile('user-1', 'user-1');

      // viewer === target → no follow check, false returned
      expect(profile.isFollowedByMe).toBe(false);
      expect(factory._followRepo.isFollowing).not.toHaveBeenCalled();
    });

    it('throws 404 when user does not exist', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(null) });
      const service = new UsersService(factory as any);
      await expect(service.getProfile('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('follow()', () => {
    it('creates a follow edge and returns following: true', async () => {
      const factory = makeFactory();
      const service = new UsersService(factory as any);
      const result = await service.follow('user-1', 'user-2');

      expect(result.following).toBe(true);
      expect(factory._followRepo.follow).toHaveBeenCalledWith('user-1', 'user-2');
    });

    it('throws 400 when trying to follow yourself', async () => {
      const factory = makeFactory();
      const service = new UsersService(factory as any);
      await expect(service.follow('user-1', 'user-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 404 when target user does not exist', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(null) });
      const service = new UsersService(factory as any);
      await expect(service.follow('user-1', 'user-99')).rejects.toMatchObject({ statusCode: 404 });
    });

    it('throws 409 when already following', async () => {
      const factory = makeFactory({}, { isFollowing: vi.fn().mockResolvedValue(true) });
      const service = new UsersService(factory as any);
      await expect(service.follow('user-1', 'user-2')).rejects.toMatchObject({ statusCode: 409 });
    });
  });

  describe('unfollow()', () => {
    it('removes the follow edge and returns following: false', async () => {
      const factory = makeFactory({}, { unfollow: vi.fn().mockResolvedValue(true) });
      const service = new UsersService(factory as any);
      const result = await service.unfollow('user-1', 'user-2');

      expect(result.following).toBe(false);
      expect(factory._followRepo.unfollow).toHaveBeenCalledWith('user-1', 'user-2');
    });

    it('throws 400 when trying to unfollow yourself', async () => {
      const factory = makeFactory();
      const service = new UsersService(factory as any);
      await expect(service.unfollow('user-1', 'user-1')).rejects.toMatchObject({ statusCode: 400 });
    });

    it('throws 404 when not following the user', async () => {
      const factory = makeFactory({}, { unfollow: vi.fn().mockResolvedValue(false) });
      const service = new UsersService(factory as any);
      await expect(service.unfollow('user-1', 'user-2')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getFollowers()', () => {
    it('returns hydrated user profiles for each follower', async () => {
      const follower = makeUser({ id: 'user-2', email: 'b@b.com', name: 'Bob' });
      const factory = makeFactory(
        {
          findById: vi.fn().mockImplementation((id: string) =>
            Promise.resolve(id === 'user-1' ? makeUser() : id === 'user-2' ? follower : null)
          ),
        },
        { getFollowerIds: vi.fn().mockResolvedValue(['user-2']) }
      );
      const service = new UsersService(factory as any);
      const followers = await service.getFollowers('user-1');

      expect(followers).toHaveLength(1);
      expect(followers[0]!.id).toBe('user-2');
    });

    it('returns empty array when nobody follows the user', async () => {
      const factory = makeFactory({}, { getFollowerIds: vi.fn().mockResolvedValue([]) });
      const service = new UsersService(factory as any);
      expect(await service.getFollowers('user-1')).toEqual([]);
    });

    it('throws 404 when target user does not exist', async () => {
      const factory = makeFactory({ findById: vi.fn().mockResolvedValue(null) });
      const service = new UsersService(factory as any);
      await expect(service.getFollowers('missing')).rejects.toMatchObject({ statusCode: 404 });
    });
  });

  describe('getFollowing()', () => {
    it('returns hydrated user profiles for each followed user', async () => {
      const followed = makeUser({ id: 'user-3', email: 'c@c.com', name: 'Charlie' });
      const factory = makeFactory(
        {
          findById: vi.fn().mockImplementation((id: string) =>
            Promise.resolve(id === 'user-1' ? makeUser() : id === 'user-3' ? followed : null)
          ),
        },
        { getFollowingIds: vi.fn().mockResolvedValue(['user-3']) }
      );
      const service = new UsersService(factory as any);
      const following = await service.getFollowing('user-1');

      expect(following).toHaveLength(1);
      expect(following[0]!.id).toBe('user-3');
    });

    it('returns empty array when user follows nobody', async () => {
      const factory = makeFactory({}, { getFollowingIds: vi.fn().mockResolvedValue([]) });
      const service = new UsersService(factory as any);
      expect(await service.getFollowing('user-1')).toEqual([]);
    });
  });

  describe('updateProfile()', () => {
    it('updates and returns the updated profile', async () => {
      const factory = makeFactory();
      const service = new UsersService(factory as any);
      const result = await service.updateProfile('user-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
      expect(factory._userRepo.update).toHaveBeenCalledWith('user-1', { name: 'Updated' });
    });
  });
});
