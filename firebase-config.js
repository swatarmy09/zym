// ========================================
// Firebase Configuration
// ========================================
// TODO: Replace with your Firebase project credentials
// Get these from: Firebase Console > Project Settings > Your apps > Web app

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

const firebaseConfig = {
    apiKey: "AIzaSyAByrfdGPEUm_3_Wv7PMt31O9PPjsE6TA0",
    authDomain: "otpl-357f7.firebaseapp.com",
    databaseURL: "https://otpl-357f7-default-rtdb.firebaseio.com",
    projectId: "otpl-357f7",
    storageBucket: "otpl-357f7.firebasestorage.app",
    messagingSenderId: "520555173842",
    appId: "1:520555173842:web:e146c05a90001b45505a0b",
    measurementId: "G-LF40EWLJ31"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

console.log('🔥 Firebase initialized successfully');
