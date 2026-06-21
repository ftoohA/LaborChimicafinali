import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || 'AIzaSyAhM7Ie2weCZPTFn-V4GBbiPd8b2kbXk3M',
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || 'databaselabrochimica.firebaseapp.com',
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || 'databaselabrochimica',
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || 'databaselabrochimica.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '627809297640',
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || '1:627809297640:web:1724b6a16916b6e80b155d',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
