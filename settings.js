
// ========================================
// Settings Logic
// ========================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentUser = null;

// DOM Elements
const profileForm = document.getElementById('profileForm');
const gymNameInput = document.getElementById('gymName');
const ownerNameInput = document.getElementById('ownerName');
const emailInput = document.getElementById('email');
const languageSelect = document.getElementById('languageSelect');
const backupBtn = document.getElementById('backupBtn');
const logoutBtn = document.getElementById('logoutBtn');

// ========================================
// Auth Check
// ========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadData(user);
    } else {
        window.location.href = 'index.html';
    }
});

// ========================================
// Load Data
// ========================================
async function loadData(user) {
    if (!user) return;

    try {
        const userDocRef = doc(db, 'gymOwners', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const data = userDoc.data();
            gymNameInput.value = data.gymName || '';
            ownerNameInput.value = data.ownerName || '';
            emailInput.value = user.email || '';
            languageSelect.value = data.language || 'en';
        } else {
            // First time load, set defaults from auth
            emailInput.value = user.email || '';
        }
    } catch (error) {
        console.error("Error loading settings:", error);
        alert('Failed to load settings. Please try again.');
    }
}

// ========================================
// Save Profile
// ========================================
profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const gymName = gymNameInput.value.trim();
    const ownerName = ownerNameInput.value.trim();
    const language = languageSelect.value;

    try {
        const userDocRef = doc(db, 'gymOwners', currentUser.uid);
        await setDoc(userDocRef, {
            gymName,
            ownerName,
            language,
            updatedAt: new Date()
        }, { merge: true });

        alert('Settings saved successfully! ✅');
    } catch (error) {
        console.error("Error saving settings:", error);
        alert('Failed to save settings. Please try again.');
    }
});

// ========================================
// Backup Data
// ========================================
backupBtn.addEventListener('click', async () => {
    if (!currentUser) return;

    try {
        backupBtn.textContent = 'Generating...';
        backupBtn.disabled = true;

        // Fetch User Profile
        const userDocSnap = await getDoc(doc(db, 'gymOwners', currentUser.uid));
        const userProfile = userDocSnap.exists() ? userDocSnap.data() : {};

        // Fetch Members
        const membersSnapshot = await getDocs(query(
            collection(db, 'members'),
            where('ownerId', '==', currentUser.uid)
        ));
        const members = membersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch Payments
        const paymentsSnapshot = await getDocs(query(
            collection(db, 'payments'),
            where('ownerId', '==', currentUser.uid)
        ));
        const payments = paymentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Create Backup Object
        const backupData = {
            metadata: {
                timestamp: new Date().toISOString(),
                version: '1.0',
                user: currentUser.email
            },
            profile: userProfile,
            members: members,
            payments: payments
        };

        // Download JSON
        const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `gym_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        alert('Backup downloaded successfully! 📦');

    } catch (error) {
        console.error("Error creating backup:", error);
        alert('Failed to create backup. Please try again.');
    } finally {
        backupBtn.textContent = 'Download Backup';
        backupBtn.disabled = false;
    }
});

// ========================================
// Logout
// ========================================
logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout error:", error);
        alert('Failed to logout. Please try again.');
    }
});
