const API_BASE = 'http://localhost:5000/api'; // Change to your backend URL
let currentUser = null;

// ========== AUTH FUNCTIONS ==========
function showTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const btns = document.querySelectorAll('.tab-btn');
    
    if (tab === 'login') {
        loginForm.style.display = 'block';
        signupForm.style.display = 'none';
        btns[0].classList.add('active');
        btns[1].classList.remove('active');
    } else {
        loginForm.style.display = 'none';
        signupForm.style.display = 'block';
        btns[0].classList.remove('active');
        btns[1].classList.add('active');
    }
}

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const response = await fetch(${API_BASE}/login, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });
    
    if (response.ok) {
        const user = await response.json();
        currentUser = user;
        localStorage.setItem('userId', user.user_id);
        window.location.href = 'dashboard.html';
    } else {
        alert('Login failed!');
    }
});

// Signup
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    const response = await fetch(${API_BASE}/signup, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password })
    });
    
    if (response.ok) {
        alert('Account created! Please login.');
        showTab('login');
    } else {
        alert('Signup failed!');
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('userId');
    window.location.href = 'index.html';
});

// ========== DASHBOARD FUNCTIONS ==========
async function loadDashboard() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'index.html';
        return;
    }
    
    // Load user data
    const userRes = await fetch(${API_BASE}/user/${userId});
    const user = await userRes.json();
    document.getElementById('userName').innerHTML = 👋 ${user.name};
    document.getElementById('levelName').innerHTML = user.level_name || 'Bronze';
    document.getElementById('totalPoints').innerHTML = user.total_points;
    document.getElementById('currentStreak').innerHTML = ${user.current_streak} days;
    document.getElementById('shields').innerHTML = user.shields_available;
    
    // Load app limits
    const limitsRes = await fetch(${API_BASE}/app-limits/${userId});
    const limits = await limitsRes.json();
    const limitsDiv = document.getElementById('appLimits');
    limitsDiv.innerHTML = limits.map(limit => `
        <div class="app-limit-card">
            <span>📱 ${limit.app_name}</span>
            <span>⏰ ${limit.daily_limit_min} min/day</span>
        </div>
    `).join('');
    
    // Load challenges
    const challengesRes = await fetch(${API_BASE}/user-challenges/${userId});
    const challenges = await challengesRes.json();
    const challengesDiv = document.getElementById('activeChallenges');
    if (challenges.length === 0) {
        challengesDiv.innerHTML = '<p>No active challenges. Join one below!</p>';
    } else {
        challengesDiv.innerHTML = challenges.map(c => `
            <div class="challenge-card">
                <span>🏆 ${c.title}</span>
                <span>📅 ${c.days_completed}/${c.target_days} days</span>
                <span>${c.status}</span>
            </div>
        `).join('');
    }
    
    // Load coupons
    const couponsRes = await fetch(${API_BASE}/coupons/${userId});
    const coupons = await couponsRes.json();
    const couponsDiv = document.getElementById('availableCoupons');
    couponsDiv.innerHTML = coupons.map(coupon => `
        <div class="coupon-card">
            <span>🎫 ${coupon.brand_name} - ${coupon.discount_value} OFF</span>
            <span>⭐ ${coupon.points_required} pts</span>
            <button class="redeem-btn" onclick="redeemCoupon(${coupon.coupon_id})">Redeem</button>
        </div>
    `).join('');
}

// ========== CHALLENGES PAGE ==========
async function loadChallenges() {
    const userId = localStorage.getItem('userId');
    
    // Load all challenges
    const challengesRes = await fetch(${API_BASE}/challenges);
    const challenges = await challengesRes.json();
    const challengesDiv = document.getElementById('challengesList');
    challengesDiv.innerHTML = challenges.map(c => `
        <div class="challenge-card">
            <div>
                <strong>${c.title}</strong>
                <p>${c.description || ''}</p>
                <small>🎯 ${c.target_days} days | ⭐ ${c.bonus_points} bonus</small>
            </div>
            <button class="join-btn" onclick="joinChallenge(${c.challenge_id})">Join</button>
        </div>
    `).join('');
}

async function joinChallenge(challengeId) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(${API_BASE}/join-challenge, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, challenge_id: challengeId })
    });
    
    if (response.ok) {
        alert('Joined challenge successfully!');
        loadChallenges();
    } else {
        alert('Failed to join challenge');
    }
}

async function redeemCoupon(couponId) {
    const userId = localStorage.getItem('userId');
    const response = await fetch(${API_BASE}/redeem-coupon, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, coupon_id: couponId })
    });
    
    if (response.ok) {
        const data = await response.json();
        alert(Coupon redeemed! Code: ${data.redemption_code});
        loadDashboard();
    } else {
        alert('Not enough points!');
    }
}

// Load page-specific data
if (window.location.pathname.includes('dashboard.html')) {
    loadDashboard();
} else if (window.location.pathname.includes('challenges.html')) {
    loadChallenges();
}