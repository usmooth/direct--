import * as admin from 'firebase-admin';


// eslint-disable-next-line @typescript-eslint/no-var-requires
const serviceAccount = require('./serviceAccountKey.json'); 

// Initialize the Firebase Admin SDK with your project's credentials.
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// Export the Firestore database instance so it can be used in other files.
export const db = admin.firestore();