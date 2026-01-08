import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, signInAnonymously } from 'firebase/auth';

// 1. Setup Configuration using Vite Environment Variables
// Vercel will inject these during the build process.
const firebaseConfig = {
  apiKey: "AIzaSyA6_RecGuSElCvuaO8PhL1Xs1rNqrJWP08",
  authDomain: "svs-8d5c6.firebaseapp.com",
  projectId: "svs-8d5c6",
  storageBucket: "svs-8d5c6.firebasestorage.app",
  messagingSenderId: "180665612598",
  appId: "1:180665612598:web:be20e6e85f6423d3605b97"
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