import { db } from './firebase-init'; // Import our Firestore database connection.
import { User } from "./model/user.model";
import { Notification } from "./model/notification.model";
import sha256 from "sha256";

// The in-memory arrays are no longer needed, as Firestore is now our database.
// export let mutableListeningRecords: ListeningRecord[] = [];
// ... other mutable arrays are also removed.

interface FeedbackResponse {
	success: boolean;
	message: string;
}

// These helper functions can remain the same.
function sortAlphabetically(firstString: string, secondString: string): string[] {
	const arrayToSort = [firstString, secondString];
	arrayToSort.sort();
	return arrayToSort;
}

export function hashTwoUsers(firstUser: string, secondUser: string): string {
	const [alphabeticOne, alphabeticTwo] = sortAlphabetically(firstUser, secondUser);
	const stringToHash = alphabeticOne + alphabeticTwo;
	return sha256(stringToHash);
}

// Functions now need to be 'async' because database operations are asynchronous and return Promises.
export async function sendFeedbackToSomeone(sendTo: User, from: User): Promise<FeedbackResponse> {
	// Check if the user has the right to send feedback.
	if (!(await doesUserHaveRightToSendAFeedback(from))) {
		return {
			success: false,
			message: "sorry-,-you-must-wait"
		};
	}

	const fromUserHash = from.userHash;
	const sendToUserHash = sendTo.userHash;
	const commonListeningHash = hashTwoUsers(sendToUserHash, fromUserHash);

    // Query Firestore for existing records instead of filtering an in-memory array.
	const existingRecordQuery = await db.collection('listeningRecords').where('feedbackHash', '==', commonListeningHash).get();
	const initialSenderQuery = await db.collection('listeningAndCreditData').where('listening', '==', commonListeningHash).where('user.userHash', '==', sendToUserHash).get();

	// Check if the query snapshots are not empty, which means documents were found.
	if (!existingRecordQuery.empty && !initialSenderQuery.empty) {
		// This block handles a mutual match.
		
		// Get the ID of the document to update it.
		const recordDocId = existingRecordQuery.docs[0].id;
		await db.collection('listeningRecords').doc(recordDocId).update({ mutualFeedback: true });

		// Create notifications and clean up the records from the database.
		await createNotification(sendToUserHash, fromUserHash);
		await cleanupRecords(commonListeningHash);

		return {
			success: true,
			message: "mutual-feedback-established"
		};
	} else {
		// This block handles creating a new, pending feedback record.
		const newListeningRecord = {
			expireDate: new Date(new Date().getTime() + 14 * 24 * 60 * 60 * 1000), // Expires in 14 days
			feedbackHash: commonListeningHash,
			mutualFeedback: false,
		};
		// Add a new document to the 'listeningRecords' collection.
		await db.collection('listeningRecords').add(newListeningRecord);

		// Add a new document to the 'listeningAndCreditData' collection.
		await db.collection('listeningAndCreditData').add({
			user: from,
			credit: new Date(),
			listening: commonListeningHash
		});
		
		return {
			success: true,
			message: "feedback-is-sent"
		};
	}
}

async function doesUserHaveRightToSendAFeedback(from: User): Promise<boolean> {
	const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
	const sevenDaysAgo = new Date(new Date().getTime() - sevenDaysInMs);

    // Query the user's records from the last 7 days.
    // It's generally better to use Timestamp objects for date queries in Firestore.
	const query = await db.collection('listeningAndCreditData')
		.where('user.userHash', '==', from.userHash)
		.where('credit', '>', sevenDaysAgo) // Check for credits created *after* seven days ago.
		.get();
	
	// If the query result is empty, it means the user has no recent credits and can send feedback.
	return query.empty;
}

async function createNotification(userA_Hash: string, userB_Hash: string): Promise<void> {
	const now = new Date();
	const oneDayInMs = 24 * 60 * 60 * 1000;
	const randomDays = 1 + (Math.random() * 6);
	const randomMillisecondsToAdd = randomDays * oneDayInMs;
	const expiryDate = new Date(now.getTime() + randomMillisecondsToAdd);

	const notificationForA: Notification = { to: userA_Hash, context: userB_Hash, notificationTime: now, skt: expiryDate };
	const notificationForB: Notification = { to: userB_Hash, context: userA_Hash, notificationTime: now, skt: expiryDate };
    
    // A batch write performs multiple operations as a single, atomic unit.
    // This ensures that either both notifications are created, or neither is.
    const batch = db.batch();
    batch.set(db.collection('notifications').doc(), notificationForA);
    batch.set(db.collection('notifications').doc(), notificationForB);
    await batch.commit();
}

async function cleanupRecords(feedbackHash: string): Promise<void> {
    // Use a batch to delete all related records atomically.
	const batch = db.batch();

	// Query for the documents that need to be deleted.
	const recordsToDeleteQuery = await db.collection('listeningRecords').where('feedbackHash', '==', feedbackHash).get();
	const creditDataToDeleteQuery = await db.collection('listeningAndCreditData').where('listening', '==', feedbackHash).get();

	// Add each found document to the batch delete list.
	recordsToDeleteQuery.forEach(doc => batch.delete(doc.ref));
	creditDataToDeleteQuery.forEach(doc => batch.delete(doc.ref));

	// Commit the batch to execute the deletions.
	await batch.commit();
}