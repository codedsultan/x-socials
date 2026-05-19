export type NotificationType =
  | 'like_post'
  | 'like_comment'
  | 'follow'
  | 'comment'
  | 'reply';

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  actorId: string;
  referenceId?: string | null;
  read: boolean;
  createdAt?: Date;
}
