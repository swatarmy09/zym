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
    onSnapshot,
    setDoc
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

// Attendance Modal Elements
const attendanceDateEl = document.getElementById('attendanceDate');
const selectedCountEl = document.getElementById('selectedCount');
const totalCountEl = document.getElementById('totalCount');
const saveAttendanceBtn = document.getElementById('saveAttendanceBtn');

// Global Variables
let currentUser = null;
let gymMembers = [];
let attendanceToday = [];
let unsubscribeMembers = null;
let unsubscribeAttendance = null;
let selectedAttendance = new Set(); // Track selected members for attendance

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
    updateAttendanceDate();
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

    // Check Subscription Limit
    const canAdd = await checkSubscriptionLimit();
    if (!canAdd) {
        alert('⚠️ Member limit reached! Please upgrade your plan to add more members.');
        window.location.href = 'billing.html';
        return;
    }

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
        const memberRef = await addDoc(collection(db, 'members'), memberData);
        console.log('✅ Member added successfully');

        // Record Initial Payment
        await addDoc(collection(db, 'payments'), {
            memberId: memberRef.id,
            memberName: memberData.name,
            amount: memberData.feeAmount,
            type: 'New Membership',
            plan: memberData.membershipPlan,
            date: memberData.joiningDate, // Use joining date for initial payment
            ownerId: currentUser.uid,
            createdAt: serverTimestamp()
        });

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
// Update Attendance Date Display
// ========================================
function updateAttendanceDate() {
    const today = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    };
    attendanceDateEl.textContent = today.toLocaleDateString('en-IN', options);
}

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
        totalCountEl.textContent = '0';
        selectedCountEl.textContent = '0';
        return;
    }

    // Update total count
    totalCountEl.textContent = filteredMembers.length;

    membersListEl.innerHTML = filteredMembers.map(member => {
        const hasAttendance = attendanceToday.some(att => att.memberId === member.id);
        const isChecked = selectedAttendance.has(member.id) || hasAttendance;

        return `
            <div class="attendance-member-item ${isChecked ? 'checked' : ''} ${hasAttendance ? 'already-marked' : ''}" 
                 data-member-id="${member.id}"
                 onclick="toggleAttendance('${member.id}', ${hasAttendance})">
                <div class="attendance-checkbox-wrapper">
                    <input type="checkbox" 
                           class="attendance-checkbox" 
                           id="attendance-${member.id}"
                           data-member-id="${member.id}"
                           ${isChecked ? 'checked' : ''}
                           ${hasAttendance ? 'disabled' : ''}
                           onclick="event.stopPropagation()">
                </div>
                <div class="attendance-member-details">
                    <p class="attendance-member-name">${member.name}</p>
                    <p class="attendance-member-mobile">📱 ${member.mobile}</p>
                </div>
                ${hasAttendance ? '<span class="attendance-status-badge marked">Already Marked</span>' : ''}
            </div>
        `;
    }).join('');

    // Add event listeners to checkboxes
    document.querySelectorAll('.attendance-checkbox:not([disabled])').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            e.stopPropagation();
            const memberId = checkbox.dataset.memberId;
            toggleAttendance(memberId, false);
        });
    });

    // Update selected count
    updateSelectedCount();
}

searchMemberInput.addEventListener('input', (e) => {
    renderMembersList(e.target.value);
});

// ========================================
// Toggle Attendance Selection
// ========================================
function toggleAttendance(memberId, alreadyMarked) {
    if (alreadyMarked) return; // Don't allow toggling already marked attendance

    const checkbox = document.getElementById(`attendance-${memberId}`);
    if (!checkbox) return;

    if (selectedAttendance.has(memberId)) {
        selectedAttendance.delete(memberId);
        checkbox.checked = false;
    } else {
        selectedAttendance.add(memberId);
        checkbox.checked = true;
    }

    // Update UI
    const memberItem = checkbox.closest('.attendance-member-item');
    if (memberItem) {
        memberItem.classList.toggle('checked', checkbox.checked);
    }

    updateSelectedCount();
}

// Make toggleAttendance globally accessible
window.toggleAttendance = toggleAttendance;

// ========================================
// Update Selected Count
// ========================================
function updateSelectedCount() {
    const alreadyMarkedCount = attendanceToday.length;
    const newlySelectedCount = selectedAttendance.size;
    const totalPresent = alreadyMarkedCount + newlySelectedCount;

    selectedCountEl.textContent = totalPresent;
}

// ========================================
// Save Attendance (Bulk)
// ========================================
async function saveAttendance() {
    if (selectedAttendance.size === 0) {
        alert('⚠️ Please select at least one member to mark attendance.');
        return;
    }

    const confirmMsg = `Mark attendance for ${selectedAttendance.size} member(s)?`;
    if (!confirm(confirmMsg)) return;

    try {
        saveAttendanceBtn.disabled = true;
        saveAttendanceBtn.innerHTML = '<span>Saving...</span>';

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Save all selected attendance records
        const promises = Array.from(selectedAttendance).map(memberId => {
            return addDoc(collection(db, 'attendance'), {
                memberId: memberId,
                ownerId: currentUser.uid,
                date: Timestamp.fromDate(today),
                timestamp: serverTimestamp()
            });
        });

        await Promise.all(promises);

        console.log(`✅ Attendance marked for ${selectedAttendance.size} members`);

        // Clear selection
        selectedAttendance.clear();

        // Show success message
        alert(`✅ Attendance saved successfully for ${promises.length} member(s)!`);

        // Data updates automatically via onSnapshot
        // Re-render will happen automatically
    } catch (error) {
        console.error('Error saving attendance:', error);
        alert('❌ Failed to save attendance. Please try again.');
    } finally {
        saveAttendanceBtn.disabled = false;
        saveAttendanceBtn.innerHTML = '<span class="btn-icon">✓</span><span>Save Attendance</span>';
    }
}

// Save Attendance Button Event Listener
saveAttendanceBtn.addEventListener('click', saveAttendance);

// ========================================
// Render Due Fees List
// ========================================
// ========================================
// Render Fee & Renewal List
// ========================================
function renderDueFeesList() {
    // Sort logic: members with nearest expiry first
    const sortedMembers = [...gymMembers].sort((a, b) => {
        const dateA = a.membershipEndDate ? a.membershipEndDate.toDate() : new Date(0);
        const dateB = b.membershipEndDate ? b.membershipEndDate.toDate() : new Date(0);
        return dateA - dateB;
    });

    // Filter logic: show expired or expiring soon (within 7 days)
    const dueMembers = sortedMembers.filter(member => {
        if (!member.membershipEndDate) return true;
        const endDate = member.membershipEndDate.toDate();
        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        return endDate <= sevenDaysFromNow;
    });

    if (dueMembers.length === 0) {
        dueFeesListEl.innerHTML = `
            <div class="empty-state">
                <span style="font-size: 48px;">🎉</span>
                <p>No pending fees. All members are up to date!</p>
            </div>`;
        return;
    }

    dueFeesListEl.innerHTML = dueMembers.map(member => {
        const endDate = member.membershipEndDate ? member.membershipEndDate.toDate() : null;
        const now = new Date();

        let daysDiff = 0;
        let statusClass = '';
        let statusText = '';
        let statusIcon = '';

        if (endDate) {
            const timeDiff = endDate - now;
            daysDiff = Math.ceil(timeDiff / (1000 * 60 * 60 * 24)); // Round up to handle partial days correctly

            if (daysDiff < 0) {
                statusClass = 'overdue';
                statusText = `${Math.abs(daysDiff)} days Overdue`;
                statusIcon = '⚠️';
            } else if (daysDiff === 0) {
                statusClass = 'warning';
                statusText = 'Expires Today';
                statusIcon = '🕒';
            } else {
                statusClass = 'warning';
                statusText = `${daysDiff} days Left`;
                statusIcon = '⏳';
            }
        } else {
            statusClass = 'overdue';
            statusText = 'No Active Plan';
            statusIcon = '❓';
        }

        const formattedDate = endDate ? endDate.toLocaleDateString('en-IN', {
            day: 'numeric', month: 'short', year: 'numeric'
        }) : 'N/A';

        // WhatsApp Reminder Message
        const message = encodeURIComponent(
            `Hello ${member.name}, your gym membership at ${headerGymNameEl.textContent} expires on ${formattedDate}. Please renew to continue your fitness journey! 🏋️‍♂️`
        );
        const whatsappLink = `https://wa.me/91${member.mobile}?text=${message}`;

        return `
            <div class="fee-card ${statusClass}">
                <div class="fee-info-main">
                    <p class="fee-member-name">${member.name}</p>
                    <p class="fee-member-plan">${member.membershipPlan} Plan • ₹${member.feeAmount || 0}</p>
                </div>
                
                <div class="fee-status-section">
                    <span class="status-pill ${statusClass}">
                        ${statusIcon} ${statusText}
                    </span>
                    <p class="expiry-date">Exp: ${formattedDate}</p>
                </div>

                <div class="fee-actions">
                    <button class="action-btn-sm remind" onclick="window.open('${whatsappLink}', '_blank')">
                        <span class="btn-icon">💬</span> Reminder
                    </button>
                    <button class="action-btn-sm pay" onclick="collectFee('${member.id}')">
                        <span class="btn-icon">💰</span> Mark Paid
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

// Make collectFee available globally for onclick handler
window.collectFee = collectFee;

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

        // Record Renewal Payment
        await addDoc(collection(db, 'payments'), {
            memberId: memberId,
            memberName: member.name,
            amount: member.feeAmount,
            type: 'Renewal',
            plan: member.membershipPlan,
            date: serverTimestamp(),
            ownerId: currentUser.uid,
            createdAt: serverTimestamp()
        });

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
// Logout logic moved to settings.js

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

// ========================================
// WhatsApp Settings Logic
// ========================================
const settingsBtn = document.getElementById('whatsappSettingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettingsModal = document.getElementById('closeSettingsModal');
const cancelSettings = document.getElementById('cancelSettings');
const settingsForm = document.getElementById('settingsForm');

// Form Elements
const absentEnabled = document.getElementById('absentEnabled');
const absentTime = document.getElementById('absentTime');
const absentTemplate = document.getElementById('absentTemplate');

const feeDueEnabled = document.getElementById('feeDueEnabled');
const feeDueTime = document.getElementById('feeDueTime');
const feeDueTemplate = document.getElementById('feeDueTemplate');

const motivationEnabled = document.getElementById('motivationEnabled');
const motivationTime = document.getElementById('motivationTime');
const motivationTemplate = document.getElementById('motivationTemplate');

// Open Modal
if (settingsBtn) {
    settingsBtn.addEventListener('click', async () => {
        openModal(settingsModal);
        await loadSettings();
    });
}

// Close Modal
if (closeSettingsModal) closeSettingsModal.addEventListener('click', () => closeModal(settingsModal));
if (cancelSettings) cancelSettings.addEventListener('click', () => closeModal(settingsModal));
if (settingsModal) {
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeModal(settingsModal);
        }
    });
}

// Load Settings
async function loadSettings() {
    if (!currentUser) return;

    try {
        const docRef = doc(db, 'settings', currentUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // Absent Reminder
            if (absentEnabled) absentEnabled.checked = data.absent?.enabled || false;
            if (absentTime) absentTime.value = data.absent?.time || '09:00';
            if (absentTemplate) absentTemplate.value = data.absent?.template || '';

            // Fee Due Reminder
            if (feeDueEnabled) feeDueEnabled.checked = data.feeDue?.enabled || false;
            if (feeDueTime) feeDueTime.value = data.feeDue?.time || '10:00';
            if (feeDueTemplate) feeDueTemplate.value = data.feeDue?.template || '';

            // Motivation Message
            if (motivationEnabled) motivationEnabled.checked = data.motivation?.enabled || false;
            if (motivationTime) motivationTime.value = data.motivation?.time || '08:00';
            if (motivationTemplate) motivationTemplate.value = data.motivation?.template || '';
        }
    } catch (error) {
        console.error("Error loading settings:", error);
    }
}

// Save Settings
if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!currentUser) return;

        const settingsData = {
            absent: {
                enabled: absentEnabled.checked,
                time: absentTime.value,
                template: absentTemplate.value
            },
            feeDue: {
                enabled: feeDueEnabled.checked,
                time: feeDueTime.value,
                template: feeDueTemplate.value
            },
            motivation: {
                enabled: motivationEnabled.checked,
                time: motivationTime.value,
                template: motivationTemplate.value
            },
            updatedAt: serverTimestamp()
        };

        try {
            const btn = settingsForm.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.textContent = 'Saving...';
            btn.disabled = true;

            await setDoc(doc(db, 'settings', currentUser.uid), settingsData, { merge: true });

            alert('Settings saved successfully! ✅');
            closeModal(settingsModal);
        } catch (error) {
            console.error("Error saving settings:", error);
            alert('Failed to save settings. Please try again.');
        } finally {
            const btn = settingsForm.querySelector('button[type="submit"]');
            btn.textContent = 'Save Settings';
            btn.disabled = false;
        }
    });
}
// ========================================
// Check Subscription Limit
// ========================================
async function checkSubscriptionLimit() {
    if (!currentUser) return false;

    try {
        const docRef = doc(db, 'subscriptions', currentUser.uid);
        const docSnap = await getDoc(docRef);

        let memberLimit = 50; // Default limit for free/basic

        if (docSnap.exists()) {
            const data = docSnap.data();
            memberLimit = data.memberLimit || 50;

            // Check expiry
            if (data.expiryDate && data.expiryDate.toDate() < new Date()) {
                alert('⚠️ Your subscription has expired. Please renew to continue.');
                window.location.href = 'billing.html';
                return false;
            }
        }

        return gymMembers.length < memberLimit;
    } catch (error) {
        console.error("Error checking limit:", error);
        return true; // Allow on error to avoid blocking valid users if DB issue
    }
}
}
