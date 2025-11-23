/**
 * User model representing a user in the system
 */
export interface User {
  /** SHA-256 hash of the user's phone number, used as unique identifier */
  userHash: string;
}