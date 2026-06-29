import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  initializeFirestore,
  getFirestore,
  deleteDoc,
  doc,
  where,
  orderBy,
  limit,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA7HJG5T4Caj54QZj2NDESkuQ97Kl9pG9w",
  authDomain: "fci-assiut-2027.firebaseapp.com",
  projectId: "fci-assiut-2027",
  storageBucket: "fci-assiut-2027.firebasestorage.app",
  messagingSenderId: "1003924938115",
  appId: "1:1003924938115:web:45dfefa4ef428542a12ab6",
  measurementId: "G-CT71W2BWGK"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore safely (handling HMR duplicate initialization)
let firestoreInstance;
try {
  firestoreInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  firestoreInstance = getFirestore(app);
}

export const db = firestoreInstance;

export { collection, addDoc, getDocs, query, deleteDoc, doc, where, orderBy, limit };

