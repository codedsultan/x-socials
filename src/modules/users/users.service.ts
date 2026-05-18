import type { RepositoryFactory } from '../../factories/RepositoryFactory';
import type { UserRepository } from '../../repositories/UserRepository';
import type { FollowRepository } from '../../repositories/FollowRepository';
import { ApiError } from '../../shared/errors/ApiError';
import {
  buildOffsetPage, buildKeysetPage, offsetToSkip,
  type OffsetParams, type KeysetParams, type PagedResult,
} from '../../shared/helpers/paginate';
import type { UpdateProfileDto, UserProfile, FollowStatusResponse } from './users.types';

export class UsersService {
  private get userRepo(): UserRepository {
    return this.repoFactory.getRepository<any>('User') as UserRepository;
  }

  private get followRepo(): FollowRepository {
    return this.repoFactory.getRepository<any>('Follow') as FollowRepository;
  }

  constructor(private readonly repoFactory: RepositoryFactory) {}

  async getProfile(userId: string, viewerUserId?: string): Promise<UserProfile> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    const [followerCount, followingCount, isFollowedByMe] = await Promise.all([
      this.followRepo.getFollowerCount(userId),
      this.followRepo.getFollowingCount(userId),
      viewerUserId && viewerUserId !== userId
        ? this.followRepo.isFollowing(viewerUserId, userId)
        : Promise.resolve(false),
    ]);

    return {
      id: user.id, name: user.name, email: user.email, createdAt: user.createdAt,
      followerCount, followingCount, isFollowedByMe: isFollowedByMe || false,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw ApiError.notFound('User not found');
    const updated = await this.userRepo.update(userId, { ...dto });
    if (!updated) throw ApiError.internal('Update failed');
    return { id: updated.id, name: updated.name, email: updated.email, createdAt: updated.createdAt };
  }

  /** Offset-paginated user list — total count is meaningful here */
  async listUsers(params: OffsetParams): Promise<PagedResult<UserProfile>> {
    const { page, limit } = params;
    const skip = offsetToSkip({ page, limit });

    const [users, total] = await Promise.all([
      this.userRepo.findMany({}, { limit, skip, sort: { createdAt: -1 } }),
      this.userRepo.count({}),
    ]);

    const profiles = users.map(u => ({
      id: u.id, name: u.name, email: u.email, createdAt: u.createdAt,
    }));
    return buildOffsetPage(profiles, total, { page, limit });
  }

  async follow(actingUserId: string, targetUserId: string): Promise<FollowStatusResponse> {
    if (actingUserId === targetUserId) throw ApiError.badRequest('You cannot follow yourself');
    const target = await this.userRepo.findById(targetUserId);
    if (!target) throw ApiError.notFound('User not found');
    const alreadyFollowing = await this.followRepo.isFollowing(actingUserId, targetUserId);
    if (alreadyFollowing) throw ApiError.conflict('You are already following this user');
    await this.followRepo.follow(actingUserId, targetUserId);
    return { followerId: actingUserId, followingId: targetUserId, following: true };
  }

  async unfollow(actingUserId: string, targetUserId: string): Promise<FollowStatusResponse> {
    if (actingUserId === targetUserId) throw ApiError.badRequest('You cannot unfollow yourself');
    const deleted = await this.followRepo.unfollow(actingUserId, targetUserId);
    if (!deleted) throw ApiError.notFound('You are not following this user');
    return { followerId: actingUserId, followingId: targetUserId, following: false };
  }

  /**
   * Keyset-paginated followers list.
   * Uses follower `userId` as the cursor — stable under concurrent new follows.
   */
  async getFollowers(userId: string, params: KeysetParams): Promise<PagedResult<UserProfile>> {
    const target = await this.userRepo.findById(userId);
    if (!target) throw ApiError.notFound('User not found');

    const { after, before, limit } = params;
    const followRows = await this.followRepo.findMany(
      { followingId: userId } as any,
      { limit: limit + 1, after, before, cursorField: 'followerId', sort: { followerId: 1 } }
    );

    const ids = (followRows as any[]).map(r => r.followerId);
    const users = await Promise.all(ids.map(id => this.userRepo.findById(id)));
    const profiles = users
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .map(u => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }));

    return buildKeysetPage(profiles, limit, 'id');
  }

  /**
   * Keyset-paginated following list.
   */
  async getFollowing(userId: string, params: KeysetParams): Promise<PagedResult<UserProfile>> {
    const target = await this.userRepo.findById(userId);
    if (!target) throw ApiError.notFound('User not found');

    const { after, before, limit } = params;
    const followRows = await this.followRepo.findMany(
      { followerId: userId } as any,
      { limit: limit + 1, after, before, cursorField: 'followingId', sort: { followingId: 1 } }
    );

    const ids = (followRows as any[]).map(r => r.followingId);
    const users = await Promise.all(ids.map(id => this.userRepo.findById(id)));
    const profiles = users
      .filter((u): u is NonNullable<typeof u> => u !== null)
      .map(u => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }));

    return buildKeysetPage(profiles, limit, 'id');
  }
}
