import { useState, useEffect } from 'react';
import { db, auth } from './firebaseConfig'; // Assumes firebaseConfig.js exists in the same folder
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously, signInWithCustomToken } from 'firebase/auth';

export const useFirestore = (collectionName = 'appData') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Use environment variable for App ID or default
  const appId = import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id';

  // 1. Auth & User State
  useEffect(() => {
    const initAuth = async () => {
      try {
        // If you have a custom token mechanism, check for it here, otherwise anonymous
        await signInAnonymously(auth);
      } catch (e) {
        console.error("Auth Error:", e);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        setData(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Data Sync (Read)
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    try {
      // Path: /artifacts/{appId}/users/{userId}/{collectionName}
      // We explicitly listen to the 'latest_session' document for state restoration
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, collectionName, 'latest_session');
      
      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            setData({ id: docSnap.id, ...docSnap.data() });
        }
        setLoading(false);
      }, (err) => {
        console.error("Firestore read error", err);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Firestore setup error", e);
      setLoading(false);
    }
  }, [user, collectionName, appId]);

  // 3. Save Data (Write)
  // Writes the entire state object to the 'latest_session' document
  const saveData = async (stateData) => {
      if (!user) return;
      try {
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, collectionName, 'latest_session');
          // Merge: true is safer, but for state replacement we might want raw set
          await setDoc(docRef, { ...stateData, updatedAt: Date.now() });
      } catch (e) {
          console.error("Firestore write error", e);
      }
  };

  return { data, saveData, loading, user };
};