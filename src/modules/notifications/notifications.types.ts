export type NotificationType =
  | 'like_post'
  | 'like_comment'
  | 'follow'
  | 'comment'
  | 'reply'
  | 'content_removed';   // fired when an admin removes a post or comment

export interface NotificationResponse {
  id: string;
  type: NotificationType;
  actorId: string;
  referenceId?: string | null;
  read: boolean;
  createdAt?: Date;
}
