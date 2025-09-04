import { ListeningAndCreditTable } from "../model/user-listening-records.model";
import { users } from "./mock-users.model";

// Helper function to create dates easily
const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

// This table tracks which user initiated which listening (feedbackHash) and when.
export const listeningAndCreditData: ListeningAndCreditTable[] = [
  // --- SCENARIO 1: A mutual match waiting to happen (Alice -> Bob) ---
  {
    user: users[0], // Alice
    credit: daysAgo(2),
    listening: '5c0c3a8e0d9b4c2a4f4b1e3e7d9c6b9a8e0d9b4c2a4f4b1e3e7d9c6b9a8e0d9b' // hash(Alice, Bob)
  },

  // --- SCENARIO 2: Carol has sent feedback to two different users ---
  // This will test the cleanup logic when Carol matches with someone.
  {
    user: users[2], // Carol
    credit: daysAgo(3),
    listening: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' // hash(Carol, David)
  },
  {
    user: users[2], // Carol
    credit: daysAgo(1),
    listening: '1f8f9b4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c8a4c' // hash(Carol, Eve)
  },

  // --- SCENARIO 3: Bob has multiple pending feedbacks waiting for him ---
  // This will also test the cleanup logic when Bob matches.
  {
    user: users[3], // David
    credit: daysAgo(4),
    listening: '9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b' // hash(David, Bob)
  },

  // --- SCENARIO 4: A user with an EXPIRED credit ---
  // Frank sent feedback to Grace 10 days ago. Frank cannot send new feedbacks.
  {
    user: users[5], // Frank
    credit: daysAgo(10), // This credit is older than 7 days.
    listening: 'd2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3' // hash(Frank, Grace)
  },
   
  // --- SCENARIO 5: An unrelated pending feedback that should not be affected ---
  {
    user: users[6], // Grace
    credit: daysAgo(5),
    listening: 'c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7' // hash(Grace, Heidi)
  },
];

