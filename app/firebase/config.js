import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDSp6HSxGlNNe2E8BRNITCU04utLr7x89U",
  authDomain: "triblet-f8227.firebaseapp.com",
  projectId: "triblet-f8227",
  storageBucket: "triblet-f8227.firebasestorage.app",
  messagingSenderId: "770050130559",
  appId: "1:770050130559:web:e864c8d8ab45b82e25f54a",
  measurementId: "G-JCB9VV5FTL",
  databaseURL: "https://triblet-f8227-default-rtdb.us-central1.firebasedatabase.app"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Realtime Database
const realtimeDb = getDatabase(app);

export { auth, db, realtimeDb };
export default app;