import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
// Importing from the config file in the same directory (src/firebaseConfig.js)
import { db, auth } from './firebaseConfig';

export const useBattleSync = () => {
  const [battleState, setBattleState] = useState({
    ourTime: { h: 0, m: 0, s: 0 },
    enemyTime: { h: 0, m: 0, s: 0 },
    remainingTime: { h: 5, m: 0, s: 0 },
    castleOwner: 'neutral',
    battleStartTime: null,
    lastTick: 0,
    rallyLeads: [],
    groups: [],
    battleLog: []
  });
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Helper to get App ID in this environment or fallback for local
  const appId = typeof __app_id !== 'undefined' ? __app_id : (import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id');

  // 1. Monitor Authentication
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Sync (Read)
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    try {
      // Mandatory Path Structure: /artifacts/{appId}/users/{userId}/{collectionName}/{docId}
      const docRef = doc(
        db, 
        'artifacts', 
        appId, 
        'users', 
        user.uid, 
        'active_battles', 
        'current_session'
      );

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          // Merge with default state to ensure all fields exist even if DB is partial
          setBattleState(prevState => ({
            ...prevState,
            ...docSnap.data()
          }));
        }
        setLoading(false);
      }, (error) => {
        console.error("Battle sync error:", error);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up listener:", err);
      setLoading(false);
    }
  }, [user, appId]);

  // 3. Update Function (Write)
  const updateBattleState = useCallback(async (updates) => {
    if (!user) return;

    try {
      const docRef = doc(
        db, 
        'artifacts', 
        appId, 
        'users', 
        user.uid, 
        'active_battles', 
        'current_session'
      );

      // Use merge: true to update only specific fields without overwriting the whole doc
      await setDoc(docRef, {
        ...updates,
        lastUpdated: Date.now() // Optional: track when update happened
      }, { merge: true });

    } catch (error) {
      console.error("Error updating battle state:", error);
    }
  }, [user, appId]);

  return { battleState, updateBattleState, loading };
};