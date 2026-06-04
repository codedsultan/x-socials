export interface UpdateProfileDto {
  name?: string;
}

export interface UserProfile {
  id: string;
  name?: string;
  /** Only populated for the authenticated user's own profile */
  email?: string;
  suspended?: boolean;
  createdAt?: Date;
  followerCount?: number;
  followingCount?: number;
  isFollowedByMe?: boolean;
}

export interface FollowStatusResponse {
  followerId: string;
  followingId: string;
  following: boolean;
}
