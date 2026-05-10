const API_BASE = 'http://localhost:3000/api';

// Helper function to handle fetch requests with authentication
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        window.location.href = 'Index.html';
        return null;
    }

    return response;
}

// ========== AUTH FUNCTIONS ==========
function showTab(tab) {
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const btns = document.querySelectorAll('.tab-btn');
    
    if (tab === 'login') {
        if (loginForm) loginForm.style.display = 'block';
        if (signupForm) signupForm.style.display = 'none';
        if (btns[0]) btns[0].classList.add('active');
        if (btns[1]) btns[1].classList.remove('active');
    } else {
        if (loginForm) loginForm.style.display = 'none';
        if (signupForm) signupForm.style.display = 'block';
        if (btns[0]) btns[0].classList.remove('active');
        if (btns[1]) btns[1].classList.add('active');
    }
}

// Login
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
        const response = await apiRequest('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response && response.ok) {
            const data = await response.json();
            localStorage.setItem('token', data.token);
            localStorage.setItem('userId', data.user.id);
            window.location.href = 'dashboard.html';
        } else {
            const error = await response.json();
            alert(error.message || 'Login failed!');
        }
    } catch (err) {
        alert('Could not connect to server.');
    }
});

// Signup
document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    
    try {
        const response = await apiRequest('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        
        if (response && response.ok) {
            alert('Account created! Please login.');
            showTab('login');
        } else {
            const error = await response.json();
            alert(error.message || 'Signup failed!');
        }
    } catch (err) {
        alert('Could not connect to server.');
    }
});

// Logout
document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = 'Index.html';
});

// ========== DASHBOARD FUNCTIONS ==========
async function loadDashboard() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'Index.html';
        return;
    }
    
    try {
        // Load user profile
        const profileRes = await apiRequest('/profile');
        if (!profileRes || !profileRes.ok) return;
        const profileData = await profileRes.json();
        const user = profileData.profile;
        
        document.getElementById('userName').innerHTML = `👋 ${user.name}`;
        document.getElementById('levelName').innerHTML = user.level.name;
        document.getElementById('totalPoints').innerHTML = user.total_points;
        document.getElementById('currentStreak').innerHTML = `${user.current_streak} days`;
        document.getElementById('shields').innerHTML = user.shields_available;
        
        // Progress Bar
        const progress = document.getElementById('levelProgress');
        if (progress) progress.style.width = `${profileData.level_progress_pct}%`;
        
        // Load app limits
        const limitsRes = await apiRequest('/limits');
        if (limitsRes && limitsRes.ok) {
            const limits = await limitsRes.json();
            const limitsDiv = document.getElementById('appLimits');
            const submitSection = document.getElementById('usageSubmitSection');

            if (limits.length === 0) {
                limitsDiv.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No limits set. Add your first app above!</p>';
                if (submitSection) submitSection.style.display = 'none';
            } else {
                if (submitSection) submitSection.style.display = 'block';
                limitsDiv.innerHTML = limits.map(limit => `
                    <div class="app-limit-card">
                        <div class="limit-info">
                            <span>📱 ${limit.app_name}</span>
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="color: var(--text-secondary);">⏰ ${limit.daily_limit_min} min</span>
                                <button onclick="deleteLimit(${limit.limit_id})" style="background:none; border:none; cursor:pointer; font-size: 1rem;">🗑️</button>
                            </div>
                        </div>
                        <div class="usage-input-group">
                            <label>Actual Usage:</label>
                            <input type="number" class="usage-input" data-limit-id="${limit.limit_id}" placeholder="0">
                            <span>min</span>
                        </div>
                    </div>
                `).join('');
            }
        }
        
        // Load active challenges
        const challengesRes = await apiRequest('/challenges/mine');
        if (challengesRes && challengesRes.ok) {
            const data = await challengesRes.json();
            const challenges = data.challenges;
            const challengesDiv = document.getElementById('activeChallenges');
            if (challenges.length === 0) {
                challengesDiv.innerHTML = '<p style="color: var(--text-secondary);">No active challenges.</p>';
            } else {
                challengesDiv.innerHTML = challenges.map(c => `
                    <div class="challenge-card">
                        <div>
                            <strong>🏆 ${c.title}</strong>
                            <div style="font-size: 0.8rem; color: var(--text-secondary);">${c.days_completed}/${c.target_days} days</div>
                        </div>
                        <span class="status-tag ${c.status.toLowerCase()}">${c.status}</span>
                    </div>
                `).join('');
            }
        }
        
        // Load coupons
        const couponsRes = await apiRequest('/coupons');
        if (couponsRes && couponsRes.ok) {
            const data = await couponsRes.json();
            const coupons = data.coupons;
            const couponsDiv = document.getElementById('availableCoupons');
            if (coupons.length === 0) {
                couponsDiv.innerHTML = '<p style="color: var(--text-secondary);">Unlock higher levels for rewards!</p>';
            } else {
                couponsDiv.innerHTML = coupons.map(coupon => `
                    <div class="coupon-card">
                        <div>
                            <strong>🎫 ${coupon.brand_name}</strong>
                            <div style="color: var(--accent-gold); font-size: 0.9rem;">${coupon.discount_value} OFF</div>
                        </div>
                        <button class="redeem-btn" onclick="redeemCoupon(${coupon.coupon_id})">Redeem</button>
                    </div>
                `).join('');
            }
        }
    } catch (err) {
        console.error(err);
    }
}

// ========== LOG USAGE ==========
document.getElementById('submitUsageBtn')?.addEventListener('click', async () => {
    const inputs = document.querySelectorAll('.usage-input');
    const logs = Array.from(inputs).map(input => ({
        limit_id: parseInt(input.dataset.limitId),
        actual_usage_min: parseInt(input.value || 0)
    }));

    const date = new Date().toISOString().split('T')[0];

    try {
        const response = await apiRequest('/logs/submit', {
            method: 'POST',
            body: JSON.stringify({ date, logs })
        });

        if (response && response.ok) {
            const result = await response.json();
            let msg = `Usage logged! You earned ${result.summary.points_earned_today} points.`;
            if (result.summary.streak.shield_used) msg += "\n🛡️ A shield was used to protect your streak!";
            if (result.summary.level_up.leveled_up) msg += `\n✨ LEVELED UP to ${result.summary.level_up.new_level}!`;
            
            alert(msg);
            loadDashboard();
        } else {
            const error = await response.json();
            alert(error.message || 'Submission failed');
        }
    } catch (err) {
        alert('Error submitting logs');
    }
});

// ========== DELETE LIMIT ==========
async function deleteLimit(limitId) {
    if (!confirm("Are you sure you want to delete this app limit?")) return;

    try {
        const response = await apiRequest(`/limits/${limitId}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            loadDashboard(); // Refresh
        } else {
            alert('Failed to delete limit');
        }
    } catch (err) {
        alert('Error deleting limit');
    }
}

// ========== MODAL FUNCTIONS ==========
const modal = document.getElementById('limitModal');
document.getElementById('openLimitModal')?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
});

function closeModal() {
    if (modal) modal.style.display = 'none';
}

document.getElementById('saveLimitBtn')?.addEventListener('click', async () => {
    const name = document.getElementById('newAppName').value;
    const limit = document.getElementById('newAppLimit').value;
    
    if (!name || !limit) return;

    const response = await apiRequest('/limits', {
        method: 'POST',
        body: JSON.stringify({ app_name: name, daily_limit_min: parseInt(limit) })
    });

    if (response && response.ok) {
        closeModal();
        loadDashboard();
    } else {
        alert('Failed to save limit');
    }
});

// ========== CHALLENGES PAGE ==========
async function loadChallenges() {
    try {
        const challengesRes = await apiRequest('/challenges');
        if (!challengesRes || !challengesRes.ok) return;
        const data = await challengesRes.json();
        const challenges = data.challenges;
        
        const challengesDiv = document.getElementById('challengesList');
        challengesDiv.innerHTML = challenges.map(c => `
            <div class="challenge-card">
                <div>
                    <strong>${c.title}</strong>
                    <p style="font-size: 0.9rem; color: var(--text-secondary);">${c.description || ''}</p>
                    <small>🎯 ${c.target_days} days | ⭐ ${c.bonus_points} pts</small>
                </div>
                ${c.my_status ? 
                    `<span class="status-tag in_progress">Joined</span>` : 
                    `<button class="join-btn" onclick="joinChallenge(${c.challenge_id})">Join</button>`
                }
            </div>
        `).join('');
    } catch (err) {
        console.error(err);
    }
}

async function joinChallenge(challengeId) {
    const response = await apiRequest(`/challenges/${challengeId}/join`, { method: 'POST' });
    if (response && response.ok) {
        alert('Joined!');
        loadChallenges();
    }
}

async function redeemCoupon(couponId) {
    const response = await apiRequest(`/coupons/${couponId}/redeem`, { method: 'POST' });
    if (response && response.ok) {
        const data = await response.json();
        alert(`Redeemed! Code: ${data.redemption.redemption_code}`);
        loadDashboard();
    } else {
        const error = await response.json();
        alert(error.message);
    }
}

window.onload = () => {
    if (window.location.pathname.includes('dashboard.html')) {
        loadDashboard();
    } else if (window.location.pathname.includes('challenges.html')) {
        loadChallenges();
    }
};