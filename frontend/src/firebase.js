import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
apiKey: "AIzaSyApBTsSGRLtKjWMkVCJz71gtcYbul2CYSE",
authDomain: "print-kiosk-6c4ff.firebaseapp.com",
projectId: "print-kiosk-6c4ff",
storageBucket: "print-kiosk-6c4ff.firebasestorage.app",
messagingSenderId: "834257482678",
appId: "1:834257482678:web:4ddfcbec69fca56f4ac717",
measurementId: "G-GNGGNF0G11"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();