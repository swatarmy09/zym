// ========================================
// Dashboard Logic
// ========================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    doc,
    getDoc,
    collection,
    addDoc,
    getDocs,
    query,
    where,
    updateDoc,
    serverTimestamp,
    Timestamp,
    onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ========================================
// DOM Elements
// ========================================
const ownerNameEl = document.getElementById('ownerName');
const headerGymNameEl = document.getElementById('headerGymName');
const currentDateTimeEl = document.getElementById('currentDateTime');
const logoutBtn = document.getElementById('logoutBtn');

// Stats
const totalMembersEl = document.getElementById('totalMembers');
const activeMembersEl = document.getElementById('activeMembers');
const dueFeesMembersEl = document.getElementById('dueFeeMembers');
const todayAttendanceEl = document.getElementById('todayAttendance');
const monthlyRevenueEl = document.getElementById('monthlyRevenue');

// Quick Action Buttons
const addMemberBtn = document.getElementById('addMemberBtn');
const markAttendanceBtn = document.getElementById('markAttendanceBtn');
const viewDueFeesBtn = document.getElementById('viewDueFeesBtn');

// Modals
const addMemberModal = document.getElementById('addMemberModal');
const attendanceModal = document.getElementById('attendanceModal');
const dueFeesModal = document.getElementById('dueFeesModal');

// Modal Close Buttons
const closeAddMemberModal = document.getElementById('closeAddMemberModal');
const closeAttendanceModal = document.getElementById('closeAttendanceModal');
const closeDueFeesModal = document.getElementById('closeDueFeesModal');
const cancelAddMember = document.getElementById('cancelAddMember');

// Forms
const addMemberForm = document.getElementById('addMemberForm');
const searchMemberInput = document.getElementById('searchMember');

// Lists
const membersListEl = document.getElementById('membersList');
const dueFeesListEl = document.getElementById('dueFeesList');
const activityListEl = document.getElementById('activityList');

// Global Variables
let currentUser = null;
let gymMembers = [];
let attendanceToday = [];
let unsubscribeMembers = null;
let unsubscribeAttendance = null;

// ========================================
// Initialize Dashboard
// ========================================
function updateDateTime() {
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    currentDateTimeEl.textContent = now.toLocaleDateString('en-IN', options);
}

updateDateTime();
setInterval(updateDateTime, 60000); // Update every minute

// ========================================
// Load User Data
// ========================================
async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, 'gymOwners', user.uid));

        if (userDoc.exists()) {
            const data = userDoc.data();
            ownerNameEl.textContent = data.ownerName || data.email.split('@')[0];
            headerGymNameEl.textContent = data.gymName || 'Your Gym';
            console.log('✅ User data loaded:', data);
        } else {
            ownerNameEl.textContent = user.email.split('@')[0];
            headerGymNameEl.textContent = 'Your Gym';
        }

        // Initialize Realtime Listeners
        setupRealtimeListeners(user.uid);
    } catch (error) {
        console.error('Error loading user data:', error);
        headerGymNameEl.textContent = 'Your Gym';
    }
}

// ========================================
// ========================================
// Setup Realtime Listeners (Members & Attendance)
// ========================================
function setupRealtimeListeners(ownerId) {
    // 1. Members Listener
    if (unsubscribeMembers) unsubscribeMembers(); // Clear existing if any

    const membersQuery = query(
        collection(db, 'members'),
        where('ownerId', '==', ownerId)
    );

    unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
        gymMembers = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`✅ realtime update: ${gymMembers.length} members`);
        updateStats();
        updateRecentActivity();

        // Also update lists if modals are open
        if (attendanceModal.classList.contains('active')) {
            renderMembersList(searchMemberInput.value);
        }
        if (dueFeesModal.classList.contains('active')) {
            renderDueFeesList();
        }
    }, (error) => {
        console.error("Error listening to members:", error);
    });

    // 2. Attendance Listener
    if (unsubscribeAttendance) unsubscribeAttendance();

    const attendanceQuery = query(
        collection(db, 'attendance'),
        where('ownerId', '==', ownerId)
    );

    unsubscribeAttendance = onSnapshot(attendanceQuery, (snapshot) => {
        const allAttendance = snapshot.docs.map(doc => doc.data());

        // Filter for today client-side
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        attendanceToday = allAttendance.filter(record => {
            if (!record.date) return false;
            const recordDate = record.date.toDate ? record.date.toDate() : new Date(record.date);
            return recordDate >= today;
        });

        console.log(`✅ realtime update: ${attendanceToday.length} attendance records today`);
        updateStats();

        // Update list if modal open
        if (attendanceModal.classList.contains('active')) {
            renderMembersList(searchMemberInput.value);
        }
    }, (error) => {
        console.error("Error listening to attendance:", error);
    });
}

// ========================================
// Update Stats
// ========================================
function updateStats() {
    // Total Members
    totalMembersEl.textContent = gymMembers.length;

    // Active Members (membership not expired)
    const activeMembers = gymMembers.filter(member => {
        if (!member.membershipEndDate || !member.membershipEndDate.toDate) return false;
        const endDate = member.membershipEndDate.toDate();
        return endDate > new Date();
    });
    activeMembersEl.textContent = activeMembers.length;

    // Due Fee Members (membership expired or ending in 7 days)
    const dueMembers = gymMembers.filter(member => {
        if (!member.membershipEndDate || !member.membershipEndDate.toDate) return true;
        const endDate = member.membershipEndDate.toDate();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return endDate <= sevenDaysFromNow;
    });
    dueFeesMembersEl.textContent = dueMembers.length;

    // Today's Attendance
    todayAttendanceEl.textContent = attendanceToday.length;

    // Monthly Revenue (calculate from members joined OR paid this month)
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyRevenue = gymMembers.reduce((total, member) => {
        let added = false;

        // 1. Check Joining Date
        if (member.joiningDate && member.joiningDate.toDate) {
            const joinDate = member.joiningDate.toDate();
            if (joinDate.getMonth() === currentMonth && joinDate.getFullYear() === currentYear) {
                total += (Number(member.feeAmount) || 0);
                added = true;
            }
        }

        // 2. Check Last Payment Date (if not already counted)
        if (!added && member.lastPaymentDate && member.lastPaymentDate.toDate) {
            const paymentDate = member.lastPaymentDate.toDate();
            if (paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear) {
                total += (Number(member.feeAmount) || 0);
            }
        }

        return total;
    }, 0);
    monthlyRevenueEl.textContent = `₹${monthlyRevenue.toLocaleString('en-IN')}`;
}

// ========================================
// Update Recent Activity
// ========================================
function updateRecentActivity() {
    if (gymMembers.length === 0) {
        activityListEl.innerHTML = `
            <div class="activity-item">
                <span class="activity-icon">👤</span>
                <div class="activity-details">
                    <p class="activity-text">No recent activity</p>
                    <p class="activity-time">Start by adding members</p>
                </div>
            </div>
        `;
        return;
    }

    // Show last 5 members
    const recentMembers = gymMembers.slice(-5).reverse();
    activityListEl.innerHTML = recentMembers.map(member => `
        <div class="activity-item">
            <span class="activity-icon">👤</span>
            <div class="activity-details">
                <p class="activity-text">${member.name} joined the gym</p>
                <p class="activity-time">${formatDate(member.joiningDate)}</p>
            </div>
        </div>
    `).join('');
}

function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return 'Recently';
    const date = timestamp.toDate();
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-IN');
}

// ========================================
// Modal Controls
// ========================================
function openModal(modal) {
    modal.classList.add('active');
}

function closeModal(modal) {
    modal.classList.remove('active');
}

// Add Member Modal
addMemberBtn.addEventListener('click', () => {
    openModal(addMemberModal);
    // Set today's date as default
    document.getElementById('joiningDate').valueAsDate = new Date();
});

closeAddMemberModal.addEventListener('click', () => closeModal(addMemberModal));
cancelAddMember.addEventListener('click', () => closeModal(addMemberModal));

// Attendance Modal
markAttendanceBtn.addEventListener('click', () => {
    openModal(attendanceModal);
    renderMembersList();
});

closeAttendanceModal.addEventListener('click', () => closeModal(attendanceModal));

// Due Fees Modal
viewDueFeesBtn.addEventListener('click', () => {
    openModal(dueFeesModal);
    renderDueFeesList();
});

closeDueFeesModal.addEventListener('click', () => closeModal(dueFeesModal));

// Close modal on outside click
[addMemberModal, attendanceModal, dueFeesModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal(modal);
        }
    });
});

// ========================================
// Add Member Form
// ========================================
addMemberForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const memberData = {
        name: document.getElementById('memberName').value.trim(),
        mobile: document.getElementById('memberMobile').value.trim(),
        email: document.getElementById('memberEmail').value.trim() || null,
        membershipPlan: document.getElementById('membershipPlan').value,
        joiningDate: Timestamp.fromDate(new Date(document.getElementById('joiningDate').value)),
        ownerId: currentUser.uid,
        createdAt: serverTimestamp()
    };

    // Calculate fee and end date based on plan
    const planPrices = {
        monthly: 1000,
        quarterly: 2700,
        yearly: 10000
    };
    const planDurations = {
        monthly: 30,
        quarterly: 90,
        yearly: 365
    };

    memberData.feeAmount = planPrices[memberData.membershipPlan];

    const endDate = new Date(document.getElementById('joiningDate').value);
    endDate.setDate(endDate.getDate() + planDurations[memberData.membershipPlan]);
    memberData.membershipEndDate = Timestamp.fromDate(endDate);

    try {
        await addDoc(collection(db, 'members'), memberData);
        console.log('✅ Member added successfully');

        // Close modal and reset form
        closeModal(addMemberModal);
        addMemberForm.reset();

        alert('Member added successfully! 🎉');
    } catch (error) {
        console.error('Error adding member:', error);
        alert('Failed to add member. Please try again.');
    }
});

// ========================================
// Render Members List for Attendance
// ========================================
function renderMembersList(searchTerm = '') {
    const filteredMembers = gymMembers.filter(member =>
        member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        member.mobile.includes(searchTerm)
    );

    if (filteredMembers.length === 0) {
        membersListEl.innerHTML = '<div class="empty-state"><p>No members found.</p></div>';
        return;
    }

    membersListEl.innerHTML = filteredMembers.map(member => {
        const hasAttendance = attendanceToday.some(att => att.memberId === member.id);
        return `
            <div class="member-item">
                <div class="member-info">
                    <p class="member-name">${member.name}</p>
                    <p class="member-mobile">${member.mobile}</p>
                </div>
                <button class="attendance-btn ${hasAttendance ? 'marked' : ''}" 
                        data-member-id="${member.id}"
                        ${hasAttendance ? 'disabled' : ''}>
                    ${hasAttendance ? '✓ Marked' : 'Mark'}
                </button>
            </div>
        `;
    }).join('');

    // Add event listeners to attendance buttons
    document.querySelectorAll('.attendance-btn:not([disabled])').forEach(btn => {
        btn.addEventListener('click', () => markAttendance(btn.dataset.memberId));
    });
}

searchMemberInput.addEventListener('input', (e) => {
    renderMembersList(e.target.value);
});

// ========================================
// Mark Attendance
// ========================================
async function markAttendance(memberId) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await addDoc(collection(db, 'attendance'), {
            memberId: memberId,
            ownerId: currentUser.uid,
            date: Timestamp.fromDate(today),
            timestamp: serverTimestamp()
        });

        console.log('✅ Attendance marked');

        console.log('✅ Attendance marked');
        // Data updates automatically via onSnapshot
    } catch (error) {
        console.error('Error marking attendance:', error);
        alert('Failed to mark attendance. Please try again.');
    }
}

// ========================================
// Render Due Fees List
// ========================================
function renderDueFeesList() {
    const dueMembers = gymMembers.filter(member => {
        if (!member.membershipEndDate) return true;
        const endDate = member.membershipEndDate.toDate();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return endDate <= sevenDaysFromNow;
    });

    if (dueMembers.length === 0) {
        dueFeesListEl.innerHTML = '<div class="empty-state"><p>No pending fees. All members are up to date! 🎉</p></div>';
        return;
    }

    dueFeesListEl.innerHTML = dueMembers.map(member => {
        const daysOverdue = member.membershipEndDate
            ? Math.ceil((new Date() - member.membershipEndDate.toDate()) / (1000 * 60 * 60 * 24))
            : 0;

        return `
            <div class="due-fee-item">
                <div class="due-fee-info">
                    <p class="due-fee-name">${member.name}</p>
                    <p class="due-fee-amount">₹${member.feeAmount || 0} • ${daysOverdue > 0 ? `${daysOverdue} days overdue` : 'Due soon'}</p>
                </div>
                <button class="collect-btn" data-member-id="${member.id}">Collect</button>
            </div>
        `;
    }).join('');

    // Add event listeners to collect buttons
    document.querySelectorAll('.collect-btn').forEach(btn => {
        btn.addEventListener('click', () => collectFee(btn.dataset.memberId));
    });
}

// ========================================
// Collect Fee (Renew Membership)
// ========================================
async function collectFee(memberId) {
    const member = gymMembers.find(m => m.id === memberId);
    if (!member) return;

    const confirmed = confirm(`Collect ₹${member.feeAmount} from ${member.name} and renew membership?`);
    if (!confirmed) return;

    try {
        const planDurations = {
            monthly: 30,
            quarterly: 90,
            yearly: 365
        };

        const newEndDate = new Date();
        newEndDate.setDate(newEndDate.getDate() + planDurations[member.membershipPlan]);

        await updateDoc(doc(db, 'members', memberId), {
            membershipEndDate: Timestamp.fromDate(newEndDate),
            lastPaymentDate: serverTimestamp()
        });

        console.log('✅ Fee collected and membership renewed');

        console.log('✅ Fee collected and membership renewed');
        // Data updates automatically via onSnapshot

        alert('Payment collected successfully! 💰');
    } catch (error) {
        console.error('Error collecting fee:', error);
        alert('Failed to process payment. Please try again.');
    }
}

// ========================================
// Logout Handler
// ========================================
logoutBtn.addEventListener('click', async () => {
    try {
        // Unsubscribe listeners
        if (unsubscribeMembers) unsubscribeMembers();
        if (unsubscribeAttendance) unsubscribeAttendance();

        await signOut(auth);
        console.log('✅ Logged out successfully');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
});

// ========================================
// Auth State Observer
// ========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        console.log('User logged in:', user.uid);
        loadUserData(user);
    } else {
        console.log('No user logged in, redirecting...');
        window.location.href = 'index.html';
    }
});
