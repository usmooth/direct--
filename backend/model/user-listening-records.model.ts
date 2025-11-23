import { User } from "./user.model";

/**
 * Listening and credit table model tracking user feedback credits
 * Used for rate limiting (users can send feedback once per 7 days)
 */
export interface ListeningAndCreditTable {
  /** The user who sent the feedback */
  user: User;
  /** Timestamp when the feedback credit was used */
  credit: Date;
  /** The feedback hash (listening identifier) for this credit */
  listening: string;
}