import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAhM7Ie2weCZPTFn-V4GBbiPd8b2kbXk3M",
  authDomain: "databaselabrochimica.firebaseapp.com",
  projectId: "databaselabrochimica",
  storageBucket: "databaselabrochimica.firebasestorage.app",
  messagingSenderId: "627809297640",
  appId: "1:627809297640:web:d1b0885d37051fc80b155d",
  measurementId: "G-V8D62VEW9B",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
