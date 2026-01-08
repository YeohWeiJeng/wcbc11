import { useState, useEffect } from 'react';
import { db, auth } from './firebaseConfig';
import { collection, query, onSnapshot, addDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Custom Hook to handle Firestore operations
 * @param {string} collectionName - Name of the collection to listen to (default: 'appData')
 */
export const useFirestore = (collectionName = 'appData') => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Get the current app ID from the global scope (environment specific)
  const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

  // 1. Listen for Auth State
  // We need to wait for the user to be authenticated before accessing Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setLoading(false);
        setData([]); // Clear data if logged out
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data & Listen for Real-time Updates (fetchData logic)
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    try {
      // Path Rule: /artifacts/{appId}/users/{userId}/{collectionName}
      // This ensures data is private to the specific user
      const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, collectionName);
      
      // Create a simple query
      const q = query(collectionRef);

      // Subscribe to real-time updates using onSnapshot
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setData(docs);
        setLoading(false);
      }, (error) => {
        console.error("Error fetching Firestore data:", error);
        setLoading(false);
      });

      // Cleanup listener on unmount or user change
      return () => unsubscribe();
    } catch (err) {
      console.error("Error setting up Firestore listener:", err);
      setLoading(false);
    }
  }, [user, collectionName, appId]);

  // 3. Add Data Function
  const addData = async (newData) => {
    if (!user) {
      console.error("User not authenticated, cannot write data.");
      return;
    }

    try {
      const collectionRef = collection(db, 'artifacts', appId, 'users', user.uid, collectionName);
      await addDoc(collectionRef, newData);
      console.log("Document successfully written!");
    } catch (error) {
      console.error("Error writing document: ", error);
    }
  };

  return { data, addData, loading, user };
};