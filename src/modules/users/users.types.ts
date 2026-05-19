export interface UpdateProfileDto {
  name?: string;
}

export interface UserProfile {
  id: string;
  name?: string;
  email?: string;
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
