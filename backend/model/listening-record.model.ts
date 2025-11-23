import { User } from "./user.model";

/**
 * Listening record model representing a pending feedback request
 */
export interface ListeningRecord {
  /** Hash identifier for the feedback relationship between two users */
  feedbackHash: string;
  /** Date when this record expires (14 days from creation) */
  expireDate: Date;
  /** Whether mutual feedback has been established */
  mutualFeedback: boolean;
}