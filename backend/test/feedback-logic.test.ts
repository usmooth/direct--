// backend/test/test.ts

import { 
    sendFeedbackToSomeone, 
    hashTwoUsers 
} from "../index";
import { User } from "../model/user.model";
import { db } from '../firebase-init'; // Import the Firestore instance.

// A helper function to clear all documents from a collection.
// This is essential for ensuring our tests are isolated and don't affect each other.
const clearCollection = async (collectionName: string) => {
    const snapshot = await db.collection(collectionName).get();
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
};

// 'describe' groups related tests.
describe('Feedback System Logic with Firestore', () => {

    // 'afterEach' runs AFTER each test in this block.
    // We use it to clean up the database to ensure a clean slate for the next test.
    afterEach(async () => {
        await clearCollection('listeningRecords');
        await clearCollection('listeningAndCreditData');
        await clearCollection('notifications');
    });

    // 'it' defines a single test case. It must now be 'async' since we are using 'await'.
    it('should create the same hash regardless of user order', () => {
        const firstUserHash = "user_A_hash";
        const secondUserHash = "user_B_hash";

        const hash1 = hashTwoUsers(firstUserHash, secondUserHash);
        const hash2 = hashTwoUsers(secondUserHash, firstUserHash);

        // This assertion remains synchronous as it doesn't involve async operations.
        expect(hash1).toBe(hash2);
    });

    it('should establish mutual feedback when two users send feedback to each other', async () => {
        const userAlice: User = { userHash: "Alice" };
        const userBob: User = { userHash: "Bob" };

        // 1. Alice sends feedback to Bob. We must 'await' this async function.
        await sendFeedbackToSomeone(userBob, userAlice);
        
        // 2. Bob sends feedback to Alice, which should create a match.
        const response = await sendFeedbackToSomeone(userAlice, userBob);

        // Assertions for the function's response.
        expect(response.success).toBe(true);
        expect(response.message).toBe("mutual-feedback-established");
        
        // Verify that the records have been cleaned up from Firestore.
        const listeningRecordsSnapshot = await db.collection('listeningRecords').get();
        const creditDataSnapshot = await db.collection('listeningAndCreditData').get();
        expect(listeningRecordsSnapshot.empty).toBe(true);
        expect(creditDataSnapshot.empty).toBe(true);
        
        // Verify that notifications were created in Firestore.
        const notificationsSnapshot = await db.collection('notifications').get();
        expect(notificationsSnapshot.size).toBe(2);

        // Optional: Deeper check to ensure notifications are correct.
        const notifications = notificationsSnapshot.docs.map(doc => doc.data());
        const notificationForAlice = notifications.find(n => n.to === userAlice.userHash);
        const notificationForBob = notifications.find(n => n.to === userBob.userHash);
        expect(notificationForAlice?.context).toBe(userBob.userHash);
        expect(notificationForBob?.context).toBe(userAlice.userHash);
    });

    it('should create a new pending feedback record when a user sends the first feedback', async () => {
        const userAlice: User = { userHash: "Alice" };
        const userBob: User = { userHash: "Bob" };
        const commonHash = hashTwoUsers(userAlice.userHash, userBob.userHash);

        const response = await sendFeedbackToSomeone(userBob, userAlice);

        // Assert the immediate response from the function.
        expect(response.success).toBe(true);
        expect(response.message).toBe("feedback-is-sent");

        // Verify that a new document was created in 'listeningRecords' collection.
        const listeningRecordsQuery = await db.collection('listeningRecords').where('feedbackHash', '==', commonHash).get();
        expect(listeningRecordsQuery.size).toBe(1);
        expect(listeningRecordsQuery.docs[0].data().mutualFeedback).toBe(false);
        
        // Verify that a new document was created in 'listeningAndCreditData' for the sender.
        const creditDataQuery = await db.collection('listeningAndCreditData').where('user.userHash', '==', userAlice.userHash).get();
        expect(creditDataQuery.size).toBe(1);
        expect(creditDataQuery.docs[0].data().listening).toBe(commonHash);
    });

    it('should prevent a user from sending feedback if they sent one less than 7 days ago', async () => {
        const userCarol: User = { userHash: "Carol" };
        const userDavid: User = { userHash: "David" };
        const userEve: User = { userHash: "Eve" };

        // Manually create a recent credit record in Firestore for Carol to simulate the condition.
        await db.collection('listeningAndCreditData').add({
            user: userCarol,
            credit: new Date(), // Today's date (0 days ago)
            listening: hashTwoUsers(userCarol.userHash, userDavid.userHash)
        });
        
        // Carol attempts to send feedback to Eve.
        const response = await sendFeedbackToSomeone(userEve, userCarol);

        // Assert the function's response.
        expect(response.success).toBe(false);
        expect(response.message).toBe("sorry-,-you-must-wait");
        
        // Verify that the database state was not altered by this failed attempt.
        // There should still be only the one initial credit record for Carol.
        const creditDataSnapshot = await db.collection('listeningAndCreditData').get();
        expect(creditDataSnapshot.size).toBe(1);
        
        // No new listening records should have been created.
        const listeningRecordsSnapshot = await db.collection('listeningRecords').get();
        expect(listeningRecordsSnapshot.empty).toBe(true);
    });
});