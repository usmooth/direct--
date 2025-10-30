import { db } from './firebase-init'; // Import our Firestore database connection.
import { User } from "./model/user.model";
import { Notification } from "./model/notification.model";
import sha256 from "sha256";
import express, { Request, Response } from "express";
import * as admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
const app = express();
app.use(express.json());

// The in-memory arrays are no longer needed, as Firestore is now our database.
// export let mutableListeningRecords: ListeningRecord[] = [];
// ... other mutable arrays are also removed.

interface FeedbackResponse {
	success: boolean;
	message: string;
}
function generateVerificationCode(length: number = 6): string {
    const digits = '0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += digits[Math.floor(Math.random() * 10)];
    }
    return code;
}

// --- JWT Configuration ---
// IMPORTANT: Store your secret in environment variables in production!
const JWT_SECRET = process.env.JWT_SECRET || 'DEFAULT_DEVELOPMENT_SECRET_KEY_12345';
if (process.env.NODE_ENV !== 'production' && JWT_SECRET === 'DEFAULT_DEVELOPMENT_SECRET_KEY_12345') {
    console.warn('WARNING: Using default JWT secret key. Set JWT_SECRET environment variable in production!');
}
const JWT_EXPIRES_IN = '1y';

// --- JWT Token Generation Function (Implemented) ---
function generateJwtToken(userHash: string): string {
    const payload = { userHash }; // Payload contains only userHash as requested
    const token = jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN } // Set expiration time to 1 year
    );
    console.log(`[Auth] Generated token for ${userHash}`);
    return token;
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
	recordsToDeleteQuery.forEach((doc: any)=> batch.delete(doc.ref));
	creditDataToDeleteQuery.forEach((doc: any)=> batch.delete(doc.ref));

	// Commit the batch to execute the deletions.
	await batch.commit();
}

app.post("/register-request", async (req: Request, res: Response) => {
  try {
    const { phoneNumber } = req.body;

    // Check if phoneNumber exists and is not empty
    if (!phoneNumber || typeof phoneNumber !== 'string' || phoneNumber.trim() === '') {
      return res.status(400).json({ success: false, message: "phoneNumber is required." });
    }

    // Hash the phone number
    const phoneNumberHash = sha256(phoneNumber.trim());

    // Generate verification code
    const verificationCode = generateVerificationCode(6);

    // Calculate expiration time (5 minutes from now)
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    // Save code and expiration to Firestore using the hash as document ID
    // Note: Set up TTL policy on 'expiresAt' field for 'verificationRequests' collection in Firestore.
    await db.collection('verificationRequests').doc(phoneNumberHash).set({
      code: verificationCode,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt) // Store as Firestore Timestamp
    });

    // -------- Trigger SMS Sending Area --------
    console.log(`Sending SMS to ${phoneNumber} (hashed: ${phoneNumberHash}) with code: ${verificationCode}`);
    // TODO: Add actual SMS sending code here
    // await sendSms(phoneNumber, `Your verification code is: ${verificationCode}`);
    // ------------------------------------------

    // Send successful response including expiresAt
    res.status(200).json({
      success: true,
      message: "Verification code sent.",
      expiresAt: expiresAt.toISOString() // Send expiration date in ISO format
    });

  } catch (error) {
    console.error("Error in /register-request:", error);
    res.status(500).json({ success: false, message: "Internal server error." });
  }
});

app.post("/register", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, smsValidationCode } = req.body;
    if (!phoneNumber || !smsValidationCode || typeof phoneNumber !== 'string' || typeof smsValidationCode !== 'string') {
         return res.status(400).json({ success: false, message: "phoneNumber and smsValidationCode are required." });
    }

    const phoneNumberHash = sha256(phoneNumber.trim());
    const verificationRef = db.collection('verificationRequests').doc(phoneNumberHash);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
        return res.status(401).json({ success: false, message: "Verification request not found or expired." });
    }

    const data = verificationDoc.data();
    const expiresAt = data?.expiresAt.toDate();
    const storedCode = data?.code;

    if (!expiresAt || !storedCode) { // Extra check for data integrity
        await verificationRef.delete(); // Clean up invalid record
        return res.status(500).json({ success: false, message: "Verification data corrupted." });
    }


    if (expiresAt < new Date()) {
        await verificationRef.delete(); // Clean up expired record
        return res.status(401).json({ success: false, message: "Verification code has expired." });
    }

    if (storedCode !== smsValidationCode.trim()) {
        return res.status(401).json({ success: false, message: "Invalid verification code." });
    }

    // --- Verification Successful ---
    await verificationRef.delete(); // Delete the used verification code

    const userHash = phoneNumberHash; // Use the phone hash as user identifier

    // User is verified, generate the JWT token
    const token = generateJwtToken(userHash);

    // Return the token as per the diagram
    res.status(200).json({ token: token });

  } catch (error) {
     console.error("Error in /register:", error);
     res.status(500).json({ success: false, message: "Internal server error." });
  }
});

app.post("/send-feedback", (req: Request, res: Response) => {
  res.status(200).json({ message: "/send-feedback works" });
});

app.get("/get-notifications", (req: Request, res: Response) => {
  res.status(200).json({ message: "/get-notifications works" });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server runs on:${PORT}`));
