import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// Firebase credentials configuration
// Priority: Environment variable > serviceAccountKey.json file
let serviceAccount: admin.ServiceAccount;

const isProduction = process.env.NODE_ENV === 'production';
const firebaseServiceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;

if (firebaseServiceAccountEnv) {
    // Use environment variable (preferred for production)
    try {
        serviceAccount = JSON.parse(firebaseServiceAccountEnv);
    } catch (error) {
        console.error('ERROR: Failed to parse FIREBASE_SERVICE_ACCOUNT environment variable. It must be valid JSON.');
        if (isProduction) {
            process.exit(1);
        }
        throw error;
    }
} else {
    // Fallback to serviceAccountKey.json file (for development)
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
    
    if (!fs.existsSync(serviceAccountPath)) {
        const errorMsg = `ERROR: Firebase service account not found. Either set FIREBASE_SERVICE_ACCOUNT environment variable or provide serviceAccountKey.json file.`;
        console.error(errorMsg);
        if (isProduction) {
            process.exit(1);
        }
        throw new Error(errorMsg);
    }
    
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    serviceAccount = require(serviceAccountPath);
    
    if (isProduction) {
        console.warn('WARNING: Using serviceAccountKey.json file in production. Consider using FIREBASE_SERVICE_ACCOUNT environment variable for better security.');
    }
}

// Initialize the Firebase Admin SDK with your project's credentials.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Export the Firestore database instance so it can be used in other files.
export const db = admin.firestore();