export interface Notification {
  to: string; // The user hash to be notified
  context: string; // The feedbackHash of the another user 
  notificationTime: Date; // Timestamp of the notification
  skt: Date; // Expiry date of the notification
}