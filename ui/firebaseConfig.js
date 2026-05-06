import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyC7Ne0ZzsKMzrjRvdaIQwqIE4LLs0NC91o",
  authDomain: "direct--backend.firebaseapp.com",
  projectId: "direct--backend",
  storageBucket: "direct--backend.firebasestorage.app",
  messagingSenderId: "833972566315",
  appId: "1:833972566315:web:9bc5141c70f0e76be02d6e",
  measurementId: "G-36DL86L3H1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export { app, auth };
