
// ========================================
// Billing & Subscription Logic
// ========================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    doc,
    getDoc,
    setDoc,
    collection,
    addDoc,
    serverTimestamp,
    getDocs,
    query,
    where,
    orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

let currentUser = null;

// ========================================
// Auth Check
// ========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        loadSubscription();
        loadBillingHistory();
    } else {
        window.location.href = 'index.html';
    }
});

// ========================================
// Load Current Subscription
// ========================================
async function loadSubscription() {
    if (!currentUser) return;

    try {
        const docRef = doc(db, 'subscriptions', currentUser.uid);
        const docSnap = await getDoc(docRef);

        let currentPlan = 'free'; // Default

        if (docSnap.exists()) {
            const data = docSnap.data();
            currentPlan = data.planId || 'free';
        }

        updateUI(currentPlan);
    } catch (error) {
        console.error("Error loading subscription:", error);
    }
}

// ========================================
// Update UI State
// ========================================
function updateUI(currentPlan) {
    // Reset all cards
    document.querySelectorAll('.plan-card').forEach(card => {
        card.classList.remove('active');
        const btn = card.querySelector('button');
        btn.textContent = 'Upgrade';
        btn.classList.add('upgrade');
        btn.classList.remove('current');
        btn.disabled = false;
    });

    // Highlight current plan
    if (currentPlan !== 'free') {
        const activeCard = document.getElementById(`plan-${currentPlan}`);
        if (activeCard) {
            activeCard.classList.add('active');
            const btn = activeCard.querySelector('button');
            btn.textContent = 'Current Plan';
            btn.classList.remove('upgrade');
            btn.classList.add('current');
            btn.disabled = true;
        }
    }
}

// ========================================
// Upgrade Plan (Mock Razorpay)
// ========================================
window.upgradePlan = async (planId, amount, limit) => {
    if (!currentUser) return;

    // Simulate Razorpay Checkout
    const options = {
        key: "rzp_test_123456789", // Mock Key
        amount: amount * 100, // Amount in paise
        currency: "INR",
        name: "GymOwner Pro",
        description: `Upgrade to ${planId.toUpperCase()} Plan`,
        image: "https://cdn-icons-png.flaticon.com/512/2964/2964514.png",
        handler: async function (response) {
            // Payment Success Handler
            console.log("Payment Successful:", response);
            await processSuccessfulPayment(planId, amount, limit, response.razorpay_payment_id);
        },
        prefill: {
            name: currentUser.displayName || "Gym Owner",
            email: currentUser.email,
            contact: "9999999999"
        },
        theme: {
            color: "#6366f1"
        }
    };

    // In a real app, we would open Razorpay here.
    // Since we can't key in real credentials, we'll simulate the success immediately for the demo.
    // const rzp1 = new Razorpay(options);
    // rzp1.open();

    const confirmed = confirm(`Mock Payment Gateway:\n\nProceed to pay ₹${amount} for ${planId.toUpperCase()} plan?`);

    if (confirmed) {
        // Simulate network delay
        document.body.style.cursor = 'wait';
        setTimeout(async () => {
            const mockPaymentId = 'pay_' + Math.random().toString(36).substr(2, 9);
            await processSuccessfulPayment(planId, amount, limit, mockPaymentId);
            document.body.style.cursor = 'default';
        }, 1500);
    }
};

// ========================================
// Process Payment
// ========================================
async function processSuccessfulPayment(planId, amount, limit, paymentId) {
    try {
        // 1. Update Subscription
        const subscriptionData = {
            planId: planId,
            memberLimit: limit,
            status: 'active',
            startDate: serverTimestamp(),
            // Set expiry to 30 days from now
            expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            updatedAt: serverTimestamp()
        };

        // Save to 'subscriptions' collection (or merge into user doc)
        await setDoc(doc(db, 'subscriptions', currentUser.uid), subscriptionData);

        // 2. Record Transaction History
        await addDoc(collection(db, 'billing_history'), {
            ownerId: currentUser.uid,
            planId: planId,
            amount: amount,
            paymentId: paymentId,
            status: 'success',
            date: serverTimestamp()
        });

        alert(`Upgrade Successful! You are now on the ${planId.toUpperCase()} plan. 🎉`);

        // Refresh UI
        loadSubscription();
        loadBillingHistory();

    } catch (error) {
        console.error("Error processing payment:", error);
        alert('Payment processed but failed to update subscription. Please contact support.');
    }
}

// ========================================
// Load Billing History
// ========================================
async function loadBillingHistory() {
    if (!currentUser) return;

    const historyBody = document.getElementById('billingHistoryBody');
    historyBody.innerHTML = '<tr><td colspan="5">Loading...</td></tr>';

    try {
        const q = query(
            collection(db, 'billing_history'),
            where('ownerId', '==', currentUser.uid),
            orderBy('date', 'desc')
        );

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            historyBody.innerHTML = '<tr><td colspan="5">No billing history found.</td></tr>';
            return;
        }

        historyBody.innerHTML = snapshot.docs.map(doc => {
            const data = doc.data();
            const date = data.date && data.date.toDate ? data.date.toDate().toLocaleDateString() : '-';

            return `
                <tr>
                    <td>${date}</td>
                    <td style="text-transform: capitalize;">${data.planId}</td>
                    <td>₹${data.amount}</td>
                    <td class="status-paid">Paid</td>
                    <td><button class="btn-text" onclick="alert('Invoice download not implemented in demo')">Download</button></td>
                </tr>
            `;
        }).join('');

    } catch (error) {
        console.error("Error loading history:", error);
        historyBody.innerHTML = '<tr><td colspan="5">Failed to load history.</td></tr>';
    }
}
