import { db } from './firebase-init';
import { User } from "./model/user.model";
import { Notification } from "./model/notification.model";
import sha256 from "sha256";
import express, { Request, Response, NextFunction } from "express";
import * as admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors()); // Enable CORS for all routes (will be configured for specific origins in production)

// Extended Request interface for authenticated routes
interface AuthenticatedRequest extends Request {
	userHash?: string;
}

// The in-memory arrays are no longer needed, as Firestore is now our database.
// export let mutableListeningRecords: ListeningRecord[] = [];
// ... other mutable arrays are also removed.

interface FeedbackResponse {
	success: boolean;
	message: string;
}
/**
 * Generates a random numeric verification code
 * @param length - Length of the verification code (default: 6)
 * @returns Random numeric string of specified length
 */
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
const isProduction = process.env.NODE_ENV === 'production';

// JWT_SECRET is required in production
if (isProduction && (!process.env.JWT_SECRET || JWT_SECRET === 'DEFAULT_DEVELOPMENT_SECRET_KEY_12345')) {
    console.error('ERROR: JWT_SECRET environment variable is required in production!');
    process.exit(1);
}

if (!isProduction && JWT_SECRET === 'DEFAULT_DEVELOPMENT_SECRET_KEY_12345') {
    console.warn('WARNING: Using default JWT secret key. Set JWT_SECRET environment variable in production!');
}

const JWT_EXPIRES_IN = '1y';

/**
 * Generates a JWT token for a user
 * @param userHash - The hashed user identifier (phone number hash)
 * @returns JWT token string
 */
function generateJwtToken(userHash: string): string {
    const payload = { userHash };
    const token = jwt.sign(
        payload,
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
    console.log(`[Auth] Generated token for ${userHash}`);
    return token;
}

/**
 * JWT Authentication Middleware
 * Validates JWT token from Authorization header and adds userHash to request
 * @param req - Express request with AuthenticatedRequest interface
 * @param res - Express response
 * @param next - Express next function
 */
function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        res.status(401).json({ success: false, code: "AUTH_TOKEN_REQUIRED", message: "Authentication token required." });
        return;
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                res.status(401).json({ success: false, code: "TOKEN_EXPIRED", message: "Token has expired." });
                return;
            }
            res.status(403).json({ success: false, code: "INVALID_TOKEN", message: "Invalid or malformed token." });
            return;
        }

        // Token is valid, add userHash to request
        const payload = decoded as { userHash: string };
        req.userHash = payload.userHash;
        next();
    });
}
/**
 * Sorts two strings alphabetically
 * @param firstString - First string to sort
 * @param secondString - Second string to sort
 * @returns Array with both strings sorted alphabetically
 */
function sortAlphabetically(firstString: string, secondString: string): string[] {
	const arrayToSort = [firstString, secondString];
	arrayToSort.sort();
	return arrayToSort;
}

/**
 * Creates a deterministic hash for two users by sorting their hashes alphabetically
 * This ensures the same hash is generated regardless of the order of users
 * @param firstUser - First user hash
 * @param secondUser - Second user hash
 * @returns SHA-256 hash of the sorted concatenated user hashes
 */
export function hashTwoUsers(firstUser: string, secondUser: string): string {
	const [alphabeticOne, alphabeticTwo] = sortAlphabetically(firstUser, secondUser);
	const stringToHash = alphabeticOne + alphabeticTwo;
	return sha256(stringToHash);
}

/**
 * Sends feedback from one user to another
 * Handles mutual feedback matching and rate limiting
 * @param sendTo - Target user to receive feedback
 * @param from - User sending the feedback
 * @returns Promise resolving to FeedbackResponse with success status and message
 */
export async function sendFeedbackToSomeone(sendTo: User, from: User): Promise<FeedbackResponse> {
	// Check if the user has the right to send feedback.
	if (!(await doesUserHaveRightToSendAFeedback(from))) {
		return {
			success: false,
			message: "rate-limit-exceeded"
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

/**
 * Checks if a user has the right to send feedback (rate limiting: 7 days)
 * @param from - User attempting to send feedback
 * @returns Promise resolving to true if user can send feedback, false otherwise
 */
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

/**
 * Creates notifications for both users when mutual feedback is established
 * Notifications have random expiry dates between 1-7 days
 * @param userA_Hash - Hash of first user
 * @param userB_Hash - Hash of second user
 */
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

/**
 * Cleans up all records related to a feedback hash after mutual feedback is established
 * Uses batch operations for atomic deletion
 * @param feedbackHash - The feedback hash to clean up records for
 */
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
      return res.status(400).json({ success: false, code: "PHONE_NUMBER_REQUIRED", message: "phoneNumber is required." });
    }

    // Hash the phone number
    const phoneNumberHash = sha256(phoneNumber.trim());

    // Check for existing verification request to implement rate limiting
    const existingRequestRef = db.collection('verificationRequests').doc(phoneNumberHash);
    const existingRequestDoc = await existingRequestRef.get();
    
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (existingRequestDoc.exists) {
      const existingData = existingRequestDoc.data();
      const requestTime = existingData?.requestTime?.toDate();
      
      // Rate limiting: Max 1 request per 1 minute per phone number
      if (requestTime && requestTime > fiveMinutesAgo) {
        const timeRemaining = Math.ceil((requestTime.getTime() + 5 * 60 * 1000 - now.getTime()) / 1000);
        return res.status(429).json({ 
          success: false,
          code: "RATE_LIMIT_EXCEEDED",
          message: "Please wait before requesting a new verification code.",
          retryAfter: timeRemaining
        });
      }
    }

    // Generate verification code
    const verificationCode = generateVerificationCode(6);

    // Calculate expiration time (5 minutes from now)
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    // Save code and expiration to Firestore using the hash as document ID
    // Note: Set up TTL policy on 'expiresAt' field for 'verificationRequests' collection in Firestore.
    await existingRequestRef.set({
      code: verificationCode,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt), // Store as Firestore Timestamp
      requestTime: admin.firestore.Timestamp.fromDate(now), // Track when request was made
      attemptCount: 0 // Initialize attempt counter for rate limiting
    });

    // -------- SMS Sending (Mock Implementation) --------
    // TODO: Replace with actual SMS service integration (Twilio, AWS SNS, etc.)
    console.log(`[SMS Mock] Sending SMS to ${phoneNumber} (hashed: ${phoneNumberHash}) with code: ${verificationCode}`);
    // In production, replace with:
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
    res.status(500).json({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error." });
  }
});

app.post("/register", async (req: Request, res: Response) => {
  try {
    const { phoneNumber, smsValidationCode } = req.body;
    if (!phoneNumber || !smsValidationCode || typeof phoneNumber !== 'string' || typeof smsValidationCode !== 'string') {
         return res.status(400).json({ success: false, code: "VALIDATION_ERROR", message: "phoneNumber and smsValidationCode are required." });
    }

    const phoneNumberHash = sha256(phoneNumber.trim());
    const verificationRef = db.collection('verificationRequests').doc(phoneNumberHash);
    const verificationDoc = await verificationRef.get();

    if (!verificationDoc.exists) {
        return res.status(401).json({ success: false, code: "VERIFICATION_NOT_FOUND", message: "Verification request not found or expired." });
    }

    const data = verificationDoc.data();
    const expiresAt = data?.expiresAt.toDate();
    const storedCode = data?.code;
    const attemptCount = data?.attemptCount || 0;

    if (!expiresAt || !storedCode) { // Extra check for data integrity
        await verificationRef.delete(); // Clean up invalid record
        return res.status(500).json({ success: false, code: "DATA_CORRUPTED", message: "Verification data corrupted." });
    }

    // Rate limiting: Max 5 attempts per verification code
    if (attemptCount >= 5) {
        await verificationRef.delete(); // Clean up after max attempts
        return res.status(429).json({ 
            success: false,
            code: "MAX_ATTEMPTS_EXCEEDED",
            message: "Too many failed attempts. Please request a new verification code." 
        });
    }

    if (expiresAt < new Date()) {
        await verificationRef.delete(); // Clean up expired record
        return res.status(401).json({ success: false, code: "VERIFICATION_EXPIRED", message: "Verification code has expired." });
    }

    if (storedCode !== smsValidationCode.trim()) {
        // Increment attempt counter on failed attempt
        await verificationRef.update({ 
            attemptCount: admin.firestore.FieldValue.increment(1),
            lastAttempt: admin.firestore.Timestamp.fromDate(new Date())
        });
        return res.status(401).json({ success: false, code: "INVALID_VERIFICATION_CODE", message: "Invalid verification code." });
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
     res.status(500).json({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error." });
  }
});

app.post("/send-feedback", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { targetUserHash } = req.body;
    const fromUserHash = req.userHash;

    // Input validation
    if (!targetUserHash || typeof targetUserHash !== 'string' || targetUserHash.trim() === '') {
      return res.status(400).json({ success: false, code: "TARGET_USER_HASH_REQUIRED", message: "targetUserHash is required." });
    }

    // Validate targetUserHash format (should be SHA-256 hash: 64 hex characters)
    if (!/^[a-f0-9]{64}$/i.test(targetUserHash.trim())) {
      return res.status(400).json({ success: false, code: "INVALID_USER_HASH_FORMAT", message: "Invalid targetUserHash format." });
    }

    // Prevent self-feedback
    if (fromUserHash === targetUserHash.trim()) {
      return res.status(400).json({ success: false, code: "SELF_FEEDBACK_NOT_ALLOWED", message: "Cannot send feedback to yourself." });
    }

    // Create User objects
    const fromUser: User = { userHash: fromUserHash! };
    const targetUser: User = { userHash: targetUserHash.trim() };

    // Call the feedback function
    const result = await sendFeedbackToSomeone(targetUser, fromUser);

    // Return appropriate status code based on result
    const statusCode = result.success ? 200 : 400;
    res.status(statusCode).json(result);

  } catch (error) {
    console.error("Error in /send-feedback:", error);
    res.status(500).json({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error." });
  }
});

app.get("/get-notifications", authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userHash = req.userHash;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Validate limit (max 100, min 1)
    const validLimit = Math.min(Math.max(1, limit), 100);
    const validOffset = Math.max(0, offset);

    const now = admin.firestore.Timestamp.fromDate(new Date());

    // Query notifications for the user that haven't expired
    // Note: Using single orderBy to avoid composite index requirement
    // Filter expired notifications in memory after fetching
    const notificationsQuery = db.collection('notifications')
      .where('to', '==', userHash)
      .orderBy('notificationTime', 'desc') // Order by notification time descending
      .limit(validLimit + validOffset + 50); // Fetch extra to account for expired ones

    const snapshot = await notificationsQuery.get();

    // Filter out expired notifications and apply offset
    const allNotifications = snapshot.docs
      .map(doc => {
        const data = doc.data();
        const sktTimestamp = data.skt;
        const sktDate = sktTimestamp?.toDate ? sktTimestamp.toDate() : new Date(sktTimestamp);
        
        // Filter expired notifications
        if (sktDate <= new Date()) {
          return null;
        }
        
        return {
          id: doc.id,
          to: data.to,
          context: data.context,
          notificationTime: data.notificationTime?.toDate ? data.notificationTime.toDate().toISOString() : data.notificationTime,
          skt: sktDate.toISOString()
        };
      })
      .filter((n): n is NonNullable<typeof n> => n !== null); // Remove nulls

    // Apply offset and limit
    const notifications = allNotifications.slice(validOffset, validOffset + validLimit);

    // Get total count (for pagination info) - query all and filter
    const totalQuery = await db.collection('notifications')
      .where('to', '==', userHash)
      .get();
    
    const total = totalQuery.docs.filter(doc => {
      const data = doc.data();
      const sktTimestamp = data.skt;
      const sktDate = sktTimestamp?.toDate ? sktTimestamp.toDate() : new Date(sktTimestamp);
      return sktDate > new Date();
    }).length;

    res.status(200).json({
      success: true,
      notifications: notifications,
      total: total,
      limit: validLimit,
      offset: validOffset
    });

  } catch (error) {
    console.error("Error in /get-notifications:", error);
    res.status(500).json({ success: false, code: "INTERNAL_SERVER_ERROR", message: "Internal server error." });
  }
});

// Health check endpoint for deployment platforms
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ 
    success: false, 
    code: "INTERNAL_SERVER_ERROR",
    message: process.env.NODE_ENV === 'production' 
      ? "Internal server error." 
      : err.message 
  });
});

// Request logging middleware (development only)
if (process.env.NODE_ENV !== 'production') {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    });
    next();
  });
}

// Export app for testing
export { app };

const PORT = process.env.PORT || 3000;
// Only start server if this file is run directly (not imported for tests)
if (require.main === module) {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}
