export type LikeTarget = 'post' | 'comment';

export interface ToggleLikeDto {
  targetId: string;
  targetType: LikeTarget;
}

export interface LikeResponse {
  liked: boolean;
  targetId: string;
  targetType: LikeTarget;
}
