import { User } from "./user.model";

export interface ListeningRecord {
  feedbackHash: string;
  expireDate: Date;
  mutualFeedback: boolean;
}