import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { db, auth } from './firebaseConfig';

export const useBattleSync = () => {
  // Default Initial State
  const [battleState, setBattleState] = useState({
    ourTime: { h: 0, m: 0, s: 0 },
    enemyTime: { h: 0, m: 0, s: 0 },
    remainingTime: { h: 5, m: 0, s: 0 },
    castleOwner: 'neutral',
    battleStartTime: null,
    lastTick: 0,
    rallyLeads: [],
    groups: [],
    battleLog: [],
    savedBattles: []
  });
  
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // App ID for path construction
  const appId = typeof __app_id !== 'undefined' ? __app_id : (import.meta.env.VITE_FIREBASE_APP_ID || 'default-app-id');

  // 1. Monitor Authentication
  useEffect(() => {
    // Ensure we are signed in (anonymously) to read/write
    const ensureAuth = async () => {
        if (!auth.currentUser) {
            try { await signInAnonymously(auth); } catch(e) { console.error("Auth error", e); }
        }
    };
    ensureAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Real-time Sync (Read) - SHARED PUBLIC PATH
  // Path: /artifacts/{appId}/public/data/active_battles/current_session
  useEffect(() => {
    if (!user) return;
    setLoading(true);

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'active_battles', 'current_session');

      const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          // Update state with remote data, falling back to defaults if fields are missing
          setBattleState(prev => ({ ...prev, ...data }));
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

  // 3. Update Function (Write) - SHARED PUBLIC PATH
  const updateBattleState = useCallback(async (updates) => {
    if (!user) return;

    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'active_battles', 'current_session');
      
      // Merge updates into the existing document
      await setDoc(docRef, {
        ...updates,
        lastUpdated: Date.now() 
      }, { merge: true });

    } catch (error) {
      console.error("Error updating battle state:", error);
    }
  }, [user, appId]);

  return { battleState, updateBattleState, loading };
};