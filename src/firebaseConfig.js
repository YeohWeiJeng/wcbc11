import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// 1. Setup Configuration using Vite Environment Variables
// Vercel will inject these during the build process.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// 2. Initialize App
// We add a check to ensure config is present to prevent crashes during build if vars are missing
const app = Object.values(firebaseConfig).every(value => !!value) 
  ? initializeApp(firebaseConfig) 
  : undefined;

// 3. Initialize Services
const db = app ? getFirestore(app) : null;
const auth = app ? getAuth(app) : null;

// 4. Auth Helper
const initFirebase = async () => {
  if (!auth) {
    console.error("Firebase not initialized. Check environment variables.");
    return;
  }
  try {
    // Basic anonymous auth for simple apps
    await signInAnonymously(auth);
    console.log("Firebase initialized and user signed in anonymously.");
  } catch (error) {
    console.error("Firebase initialization error:", error);
  }
};

export { db, auth, initFirebase };