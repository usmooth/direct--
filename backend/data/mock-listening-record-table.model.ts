import { ListeningRecord } from "../model/listening-record.model";
import { ListeningAndCreditTable } from "../model/user-listening-records.model";

export const listeningRecords: ListeningRecord[] = [
  // SCENARIO 1 & 2: Alice has sent a feedback request to Bob.
  // This is the record that Bob will match with when he sends feedback back to Alice.
  {
    feedbackHash: 'b688d08e9755d963d0dbf898e112ccdedd3ef55849fe4bc261f856f42325ba5f', // hash_A_B
    expireDate: new Date(new Date().setDate(new Date().getDate() + 10)), // Expires in 10 days
    mutualFeedback: false,
  },
  
  // SCENARIO 2: Alice has also sent a feedback request to Carol.
  // This record should be DELETED after Alice matches with Bob, because Alice is no longer available.
  {
    feedbackHash: '6263544d9f9680b5262e3c03977533a1e1e9ddd1268688325996f7c7843b59a4', // hash_A_C
    expireDate: new Date(new Date().setDate(new Date().getDate() + 5)), // Expires in 5 days
    mutualFeedback: false,
  },

  // SCENARIO 4: David has sent feedback to Frank, but Frank has not yet responded.
  // This record should remain untouched throughout the tests.
  {
    feedbackHash: 'a575009405d688319f3933c04297a7a7a2858b5170f089886479ca4d9472e017', // hash_D_F
    expireDate: new Date(new Date().setDate(new Date().getDate() + 12)), // Expires in 12 days
    mutualFeedback: false,
  },
];