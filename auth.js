// ========================================
// Authentication Logic
// ========================================

import { auth, db } from './firebase-config.js';
import {
    signInWithEmailAndPassword,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    doc,
    getDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ========================================
// DOM Elements
// ========================================
const loginForm = document.getElementById('loginForm');

// Login elements
const loginEmail = document.getElementById('loginEmail');
const loginPassword = document.getElementById('loginPassword');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');

// ========================================
// Validation Functions
// ========================================
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function showFieldError(inputId, errorId, message) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    input.classList.add('error');
    error.textContent = message;
}

function clearFieldError(inputId, errorId) {
    const input = document.getElementById(inputId);
    const error = document.getElementById(errorId);
    input.classList.remove('error');
    error.textContent = '';
}

function clearErrors() {
    document.querySelectorAll('.error-msg').forEach(el => el.textContent = '');
    document.querySelectorAll('input').forEach(el => el.classList.remove('error'));
    loginError.classList.remove('show');
}

function showFormError(errorElement, message) {
    errorElement.textContent = message;
    errorElement.classList.add('show');
}

// ========================================
// Real-time Validation
// ========================================
loginEmail.addEventListener('blur', () => {
    if (!validateEmail(loginEmail.value)) {
        showFieldError('loginEmail', 'loginEmailError', 'Enter a valid email address');
    } else {
        clearFieldError('loginEmail', 'loginEmailError');
    }
});

// ========================================
// Login Handler
// ========================================
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearErrors();

    const email = loginEmail.value.trim();
    const password = loginPassword.value;

    // Validation
    let hasError = false;

    if (!validateEmail(email)) {
        showFieldError('loginEmail', 'loginEmailError', 'Enter a valid email address');
        hasError = true;
    }

    if (!password) {
        showFieldError('loginPassword', 'loginPasswordError', 'Password is required');
        hasError = true;
    }

    if (hasError) return;

    // Show loading
    loginBtn.classList.add('loading');
    loginBtn.disabled = true;

    try {
        // Sign in with email and password
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, 'gymOwners', user.uid));

        if (userDoc.exists()) {
            console.log('✅ Login successful:', userDoc.data());
            // Redirect to dashboard
            window.location.href = 'dashboard.html';
        } else {
            console.log('⚠️ User authenticated but no Firestore data found');
            // Still redirect to dashboard even if no Firestore data
            window.location.href = 'dashboard.html';
        }

    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed. Please try again.';

        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email address.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password. Please try again.';
        } else if (error.code === 'auth/too-many-requests') {
            errorMessage = 'Too many failed attempts. Please try again later.';
        } else if (error.code === 'auth/invalid-credential') {
            errorMessage = 'Invalid email or password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address format.';
        }

        showFormError(loginError, errorMessage);
    } finally {
        loginBtn.classList.remove('loading');
        loginBtn.disabled = false;
    }
});

// ========================================
// Auth State Observer
// ========================================
onAuthStateChanged(auth, (user) => {
    if (user && window.location.pathname.includes('index.html')) {
        // User is already logged in, redirect to dashboard
        console.log('User already logged in, redirecting...');
        window.location.href = 'dashboard.html';
    }
});
