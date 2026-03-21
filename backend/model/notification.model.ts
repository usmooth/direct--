/**
 * Notification model representing a user notification
 */
export interface Notification {
  /** The user hash (phone number hash) of the user to be notified */
  to: string;
  /** The feedback hash (userHash) of the other user involved in mutual feedback */
  context: string;
  /** Timestamp when the notification was created */
  notificationTime: Date;
  /** Expiry date of the notification (skt = son kullanma tarihi / expiry date) */
  skt: Date;
}