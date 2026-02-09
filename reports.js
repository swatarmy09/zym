
// ========================================
// Reports Logic
// ========================================

import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    where,
    Timestamp,
    orderBy,
    startAt,
    endAt
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// DOM Elements
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const reportTypeSelect = document.getElementById('reportType');
const generateBtn = document.getElementById('generateBtn');
const summaryCards = document.getElementById('summaryCards');
const tableHead = document.getElementById('tableHead');
const tableBody = document.getElementById('tableBody');

let currentUser = null;

// Initialize Date Inputs (Current Month)
function initFilters() {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    startDateInput.valueAsDate = firstDay;
    endDateInput.valueAsDate = lastDay;
}

// ========================================
// Auth Check
// ========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        initFilters();
        generateReport(); // Generate initial report
    } else {
        window.location.href = 'index.html';
    }
});

// ========================================
// Report Generation
// ========================================
generateBtn.addEventListener('click', generateReport);

async function generateReport() {
    if (!currentUser) return;

    generateBtn.textContent = 'Generating...';
    generateBtn.disabled = true;

    const startDate = new Date(startDateInput.value);
    const endDate = new Date(endDateInput.value);
    endDate.setHours(23, 59, 59, 999);

    const type = reportTypeSelect.value;

    try {
        if (type === 'financial') {
            await generateFinancialReport(startDate, endDate);
        } else if (type === 'attendance') {
            await generateAttendanceReport(startDate, endDate);
        } else if (type === 'renewals') {
            await generateRenewalsReport(startDate, endDate);
        }
    } catch (error) {
        console.error("Error generating report:", error);
        alert('Failed to generate report. Please try again.');
    } finally {
        generateBtn.textContent = 'Generate Report';
        generateBtn.disabled = false;
    }
}

// ========================================
// Financial Report
// ========================================
async function generateFinancialReport(start, end) {
    // Query 'payments' collection
    const q = query(
        collection(db, 'payments'),
        where('ownerId', '==', currentUser.uid),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
        orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    const payments = snapshot.docs.map(doc => doc.data());

    // Calculate Totals
    const totalRevenue = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const totalTransactions = payments.length;
    const averageTransaction = totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(2) : 0;

    // Render Cards
    renderCards([
        { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, subtitle: 'Gross Income' },
        { title: 'Transactions', value: totalTransactions, subtitle: 'Count' },
        { title: 'Avg. Transaction', value: `₹${averageTransaction}`, subtitle: 'Per Member' }
    ]);

    // Render Table Header
    renderTableHeader(['Date', 'Member Name', 'Type', 'Plan', 'Amount']);

    // Render Table Body
    if (payments.length === 0) {
        renderEmptyTable('No financial records found for this period.');
    } else {
        tableBody.innerHTML = payments.map(p => `
            <tr>
                <td>${formatDate(p.date)}</td>
                <td>${p.memberName || 'Unknown'}</td>
                <td><span class="status-badge income">${p.type}</span></td>
                <td>${p.plan || '-'}</td>
                <td><strong>₹${(Number(p.amount) || 0).toLocaleString('en-IN')}</strong></td>
            </tr>
        `).join('');
    }
}

// ========================================
// Attendance Report
// ========================================
async function generateAttendanceReport(start, end) {
    // 1. Fetch Attendance Records
    const attendanceQuery = query(
        collection(db, 'attendance'),
        where('ownerId', '==', currentUser.uid),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
        orderBy('date', 'desc')
    );

    // 2. Fetch Total Active Members (Snapshot at current time - limitation of current data model)
    // ideally we would track member count history, but for now we use current count as approximation
    // or we fetch all members created before end date
    const membersQuery = query(
        collection(db, 'members'),
        where('ownerId', '==', currentUser.uid),
        where('joiningDate', '<=', Timestamp.fromDate(end))
    );

    const [attSnapshot, membersSnapshot] = await Promise.all([
        getDocs(attendanceQuery),
        getDocs(membersQuery)
    ]);

    const attendanceRecords = attSnapshot.docs.map(doc => doc.data());
    const totalMembers = membersSnapshot.size;

    // Calculate Metrics
    const totalVisits = attendanceRecords.length;

    // Unique members who visited
    const uniqueVisitors = new Set(attendanceRecords.map(r => r.memberId)).size;

    // Calculate Attendance % (Avg visits per day / Total Members)
    // Days in range
    const daysDiff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const avgDailyVisits = (totalVisits / daysDiff).toFixed(1);
    const attendanceRate = totalMembers > 0 ? ((uniqueVisitors / totalMembers) * 100).toFixed(1) : 0;

    // Render Cards
    renderCards([
        { title: 'Total Check-ins', value: totalVisits, subtitle: 'Visits' },
        { title: 'Active Members', value: uniqueVisitors, subtitle: 'Visited at least once' },
        { title: 'Avg. Daily Visits', value: avgDailyVisits, subtitle: 'Check-ins / Day' }
    ]);

    // Render Table Header
    renderTableHeader(['Date', 'Member Check-ins', 'Unique Members', 'Overview']);

    // Aggregate by Date for Table
    const dailyStats = {};
    attendanceRecords.forEach(r => {
        const dateKey = formatDate(r.date);
        if (!dailyStats[dateKey]) {
            dailyStats[dateKey] = { visits: 0, members: new Set() };
        }
        dailyStats[dateKey].visits++;
        dailyStats[dateKey].members.add(r.memberId);
    });

    // Render Table Body
    if (Object.keys(dailyStats).length === 0) {
        renderEmptyTable('No attendance records found.');
    } else {
        tableBody.innerHTML = Object.entries(dailyStats)
            .sort((a, b) => new Date(b[0]) - new Date(a[0])) // Sort descending by date
            .map(([date, stats]) => `
            <tr>
                <td>${date}</td>
                <td>${stats.visits}</td>
                <td>${stats.members.size}</td>
                <td>
                    <div style="background: #e5e7eb; border-radius: 4px; height: 6px; width: 100px;">
                        <div style="background: #6366f1; height: 100%; border-radius: 4px; width: ${Math.min(100, (stats.members.size / totalMembers) * 100)}%"></div>
                    </div>
                </td>
            </tr>
        `).join('');
    }
}

// ========================================
// Renewals Report
// ========================================
async function generateRenewalsReport(start, end) {
    // Reuse payments collection, filter by 'Renewal'
    const q = query(
        collection(db, 'payments'),
        where('ownerId', '==', currentUser.uid),
        where('type', '==', 'Renewal'),
        where('date', '>=', Timestamp.fromDate(start)),
        where('date', '<=', Timestamp.fromDate(end)),
        orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    const renewals = snapshot.docs.map(doc => doc.data());

    // Calculate Totals
    const totalRenewedAmount = renewals.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalRenewals = renewals.length;

    // Render Cards
    renderCards([
        { title: 'Total Renewals', value: totalRenewals, subtitle: 'Members Renewed' },
        { title: 'Renewal Revenue', value: `₹${totalRenewedAmount.toLocaleString('en-IN')}`, subtitle: 'From Renewals' },
        { title: 'Conversion Rate', value: 'N/A', subtitle: 'Requires expiry data' } // Placeholder for future enhancement
    ]);

    // Render Table Header
    renderTableHeader(['Date', 'Member Name', 'Plan', 'Amount Paid']);

    // Render Table Body
    if (renewals.length === 0) {
        renderEmptyTable('No renewals found for this period.');
    } else {
        tableBody.innerHTML = renewals.map(r => `
            <tr>
                <td>${formatDate(r.date)}</td>
                <td>${r.memberName || 'Unknown'}</td>
                <td><span class="status-badge income">${r.plan}</span></td>
                <td><strong>₹${(Number(r.amount) || 0).toLocaleString('en-IN')}</strong></td>
            </tr>
        `).join('');
    }
}

// ========================================
// Helpers
// ========================================
function renderCards(data) {
    summaryCards.innerHTML = data.map(card => `
        <div class="summary-card">
            <h3>${card.title}</h3>
            <p class="summary-value">${card.value}</p>
            <p class="summary-sub">${card.subtitle}</p>
        </div>
    `).join('');
}

function renderTableHeader(headers) {
    tableHead.innerHTML = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
}

function renderEmptyTable(message) {
    tableBody.innerHTML = `
        <tr>
            <td colspan="100%" style="text-align: center; padding: 40px; color: #6b7280;">
                ${message}
            </td>
        </tr>
    `;
}

function formatDate(timestamp) {
    if (!timestamp || !timestamp.toDate) return '-';
    return timestamp.toDate().toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}
