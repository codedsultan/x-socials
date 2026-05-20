export interface AdminUserView {
  id:              string;
  name?:           string;
  email:           string;
  suspended:       boolean;
  followerCount?:  number;
  followingCount?: number;
  createdAt?:      Date;
}

export interface PlatformStats {
  users:    { total: number };
  posts:    { total: number };
  comments: { total: number };
  likes:    { total: number };
}
