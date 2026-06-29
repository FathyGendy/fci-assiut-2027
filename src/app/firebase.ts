import { initializeApp } from 'firebase/app';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  initializeFirestore,
  deleteDoc,
  doc
} from 'firebase/firestore';

const firebaseConfig = {
  projectId: "gen-lang-client-0807264227",
  appId: "1:432407635859:web:1d10fc3773a9a1eaa0aa66",
  apiKey: "AIzaSyAJ20AkyuPDtsXektsT3Sp9ic1azYnIB0U",
  authDomain: "gen-lang-client-0807264227.firebaseapp.com",
  storageBucket: "gen-lang-client-0807264227.firebasestorage.app",
  messagingSenderId: "432407635859"
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID from config
export const db = initializeFirestore(app, {}, "ai-studio-fciassiut2027-8c281ef6-fe41-48a0-bf2d-7291a4573f26");

export { collection, addDoc, getDocs, query, deleteDoc, doc };
