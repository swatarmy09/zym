// ========================================
// Dashboard Logic
// ========================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// DOM Elements
const ownerNameEl = document.getElementById('ownerName');
const gymNameEl = document.getElementById('gymName');
const logoutBtn = document.getElementById('logoutBtn');

// ========================================
// Load User Data
// ========================================
async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'gymOwners', user.uid));

        if (userDoc.exists()) {
            const data = userDoc.data();
            ownerNameEl.textContent = data.ownerName;
            gymNameEl.textContent = data.gymName;
            console.log('✅ User data loaded:', data);
        } else {
            console.error('User data not found');
            gymNameEl.textContent = 'Gym data not found';
        }
    } catch (error) {
        console.error('Error loading user data:', error);
        gymNameEl.textContent = 'Error loading gym data';
    }
}

// ========================================
// Auth State Observer
// ========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        // User is logged in
        console.log('User logged in:', user.uid);
        loadUserData(user);
    } else {
        // User is not logged in, redirect to login
        console.log('No user logged in, redirecting...');
        window.location.href = 'index.html';
    }
});

// ========================================
// Logout Handler
// ========================================
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        console.log('✅ Logged out successfully');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
});
