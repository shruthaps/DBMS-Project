const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:'
    ? 'http://localhost:3000/api'
    : 'https://digitaldetox-api.onrender.com/api';


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


document.getElementById('signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('signupName').value.trim();
    const email = document.getElementById('signupEmail').value.trim();
    const password = document.getElementById('signupPassword').value;


    if (!name || !email || !password) {
        return alert("All fields are required!");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return alert("Please enter a valid email address!");
    }

    if (password.length < 6) {
        return alert("Password must be at least 6 characters long!");
    }

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


document.getElementById('logoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    window.location.href = 'Index.html';
});


async function loadDashboard() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        window.location.href = 'Index.html';
        return;
    }

    try {

        const profileRes = await apiRequest('/profile');
        if (!profileRes || !profileRes.ok) return;
        const profileData = await profileRes.json();
        const user = profileData.profile;

        document.getElementById('userName').innerHTML = `👋 ${user.name}`;
        document.getElementById('levelName').innerHTML = user.level.name;
        document.getElementById('totalPoints').innerHTML = user.total_points;
        document.getElementById('currentStreak').innerHTML = `${user.current_streak} days`;
        document.getElementById('shields').innerHTML = user.shields_available;


        const progress = document.getElementById('levelProgress');
        if (progress) progress.style.width = `${profileData.level_progress_pct}%`;


        const limitsRes = await apiRequest('/limits');
        const logsRes = await apiRequest('/logs');
        let todayLogs = [];
        if (logsRes && logsRes.ok) {
            const logsData = await logsRes.json();
            todayLogs = logsData.logs || [];
        }

        if (limitsRes && limitsRes.ok) {
            const limits = await limitsRes.json();
            const limitsDiv = document.getElementById('appLimits');
            const submitSection = document.getElementById('usageSubmitSection');

            if (limits.length === 0) {
                limitsDiv.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--text-secondary);">No limits set. Add your first app above!</p>';
                if (submitSection) submitSection.style.display = 'none';
            } else {
                if (submitSection) submitSection.style.display = 'block';
                if (submitSection) submitSection.style.display = 'none';
                
                const hasSyncedToday = todayLogs.length > 0;
                
                limitsDiv.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 15px;">
                ${limits.map(limit => {
                    const loggedEntry = todayLogs.find(log => log.limit_id === limit.limit_id);
                    let statusHtml = '<span style="font-size: 0.8rem; color: var(--text-secondary);">Waiting for sync...</span>';
                    
                    if (loggedEntry) {
                        const isBreached = loggedEntry.limit_breached;
                        statusHtml = `
                            <span style="font-weight:bold;color:${isBreached ? '#ff4b2b' : '#00f2fe'};">
                                Detected: ${loggedEntry.actual_usage_min}m
                            </span><br>
                            <small style="color:var(--text-secondary);">${isBreached ? '⚠️ Breached' : '✅ Safe'}</small>
                        `;
                    }
                    
                    return `
                        <div class="limit-card" style="margin-bottom: 5px; width: 100%;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <span style="font-size: 1.2rem; font-weight: bold;">
                                            ${limit.app_name.includes('Instagram') ? '📸' : limit.app_name.includes('YouTube') ? '📺' : '📱'} ${limit.app_name}
                                        </span>
                                        <button onclick="deleteLimit(${limit.limit_id})" style="background: none; border: none; cursor: pointer; font-size: 1.1rem; padding: 5px;" title="Delete Limit">🗑️</button>
                                    </div>
                                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px;">
                                        Daily Limit: <span style="color: var(--accent-purple);">${limit.daily_limit_min} mins</span>
                                    </p>
                                </div>
                                <div id="status-${limit.limit_id}" style="text-align: right; background: rgba(255,255,255,0.03); padding: 10px; border-radius: 10px; min-width: 120px;">
                                    ${statusHtml}
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div style="margin-top: 30px; border-top: 1px solid var(--glass-border); padding-top: 20px; display: flex; flex-direction: column; align-items: flex-end;">
                <button id="syncBtn" onclick="simulateSync()" class="btn" style="width: auto; padding: 10px 20px; font-size: 0.9rem;" ${hasSyncedToday ? 'disabled' : ''}>
                    ${hasSyncedToday ? '✅ Synced for Today' : '🔄 Sync with Device Data'}
                </button>
                <p style="text-align: right; font-size: 0.75rem; color: var(--text-secondary); margin-top: 8px;">
                    Last synced: ${hasSyncedToday ? 'Today' : 'Never'}
                </p>
            </div>
        `;
            }
        }


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

        const myCouponsRes = await apiRequest('/coupons/mine');
        if (myCouponsRes && myCouponsRes.ok) {
            const myData = await myCouponsRes.json();
            const myCoupons = myData.coupons;
            const myCouponsDiv = document.getElementById('myCoupons');
            if (myCouponsDiv) {
                if (myCoupons.length === 0) {
                    myCouponsDiv.innerHTML = '<p style="color: var(--text-secondary); font-size: 0.9rem;">No coupons redeemed yet.</p>';
                } else {
                    myCouponsDiv.innerHTML = myCoupons.map(coupon => `
                        <div class="coupon-card" style="background: rgba(255,255,255,0.01); border: 1px dashed var(--glass-border); margin-bottom: 10px; padding: 12px 18px;">
                            <div>
                                <strong style="font-size: 0.95rem;">🎫 ${coupon.brand_name}</strong>
                                <div style="color: var(--success); font-size: 0.85rem; font-weight: bold; margin-top: 2px;">
                                    Code: <span style="font-family: monospace; font-size: 0.95rem; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; color: var(--accent-gold);">${coupon.redemption_code}</span>
                                </div>
                                <div style="color: var(--text-secondary); font-size: 0.75rem; margin-top: 4px;">
                                    ${coupon.discount_value} OFF · Exp: ${coupon.expiry_date ? new Date(coupon.expiry_date).toLocaleDateString() : 'Never'}
                                </div>
                            </div>
                        </div>
                    `).join('');
                }
            }
        }
    } catch (err) {
        console.error(err);
    }
}


async function redeemCoupon(couponId) {
    if (!confirm('Are you sure you want to spend your points to redeem this coupon?')) {
        return;
    }

    try {
        const res = await apiRequest(`/coupons/${couponId}/redeem`, {
            method: 'POST'
        });

        if (res && res.ok) {
            const data = await res.json();
            const red = data.redemption;
            
            alert(`🎉 Coupon redeemed successfully!\n\nBrand: ${red.brand_name}\nDiscount: ${red.discount_value} OFF\n\nYOUR REDEMPTION CODE:\n👉 ${red.redemption_code} 👈\n\nPoints remaining: ${red.points_remaining}`);
            
            loadDashboard();
        } else {
            const errData = await res.json();
            alert(`❌ Redemption failed: ${errData.message || 'Server error'}`);
        }
    } catch (err) {
        console.error('Error redeeming coupon:', err);
        alert('An error occurred while trying to redeem the coupon.');
    }
}


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


async function deleteLimit(limitId) {
    if (!confirm("Are you sure you want to delete this app limit?")) return;

    try {
        const response = await apiRequest(`/limits/${limitId}`, {
            method: 'DELETE'
        });

        if (response && response.ok) {
            loadDashboard();
        } else {
            alert('Failed to delete limit');
        }
    } catch (err) {
        alert('Error deleting limit');
    }
}


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




let _allUsers   = [];
let _myFriends  = [];
let _requests   = [];


function switchTab(name) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-bar button').forEach(b => b.classList.remove('active'));
    document.getElementById(`panel-${name}`).classList.add('active');
    document.getElementById(`tab-${name}`).classList.add('active');


    if (name === 'friends')   renderAllUsers();
    if (name === 'requests')  renderRequests();
    if (name === 'myfriends') renderMyFriends();
}


async function loadChallengesPage() {
    await Promise.all([
        fetchChallenges(),
        fetchPeopleData()
    ]);
}


async function fetchPeopleData() {
    try {
        const [usersRes, friendsRes, reqRes] = await Promise.all([
            apiRequest('/friends/users'),
            apiRequest('/friends'),
            apiRequest('/friends/requests')
        ]);

        if (usersRes && usersRes.ok) {
            _allUsers = (await usersRes.json()).users || [];
        } else {

            const errBody = usersRes ? await usersRes.text() : 'no response';
            console.error('GET /friends/users failed:', usersRes?.status, errBody);
            const container = document.getElementById('allUsersList');
            if (container) container.innerHTML = `<p style="color:#ff4b2b;">⚠️ Could not load users (${usersRes?.status}): ${errBody}</p>`;
        }

        if (friendsRes && friendsRes.ok) _myFriends = (await friendsRes.json()).friends || [];
        if (reqRes && reqRes.ok)         _requests  = (await reqRes.json()).requests  || [];


        const badge = document.getElementById('reqBadge');
        if (badge) {
            badge.textContent = _requests.length;
            badge.style.display = _requests.length > 0 ? 'inline-flex' : 'none';
        }
    } catch (err) {
        console.error('fetchPeopleData error:', err);
        const container = document.getElementById('allUsersList');
        if (container) container.innerHTML = `<p style="color:#ff4b2b;">⚠️ JS error: ${err.message}</p>`;
    }
}


async function fetchChallenges() {
    try {
        const res = await apiRequest('/challenges');
        if (!res || !res.ok) return;
        const { challenges } = await res.json();

        const solo  = challenges.filter(c => c.type !== 'GROUP');
        const group = challenges.filter(c => c.type === 'GROUP');

        const soloDiv  = document.getElementById('soloChallengesList');
        const groupDiv = document.getElementById('groupChallengesList');
        if (!soloDiv || !groupDiv) return;

        soloDiv.innerHTML = solo.length === 0
            ? '<p style="color:var(--text-secondary);grid-column:1/-1;">No solo challenges available right now.</p>'
            : solo.map(c => challengeCard(c)).join('');

        groupDiv.innerHTML = group.length === 0
            ? '<p style="color:var(--text-secondary);grid-column:1/-1;">No group challenges yet — create one with your friends!</p>'
            : group.map(c => challengeCard(c)).join('');

    } catch (err) {
        console.error('fetchChallenges error:', err);
    }
}

function challengeCard(c) {
    const isGroup = c.type === 'GROUP';
    return `
        <div class="challenge-card" style="position:relative;">
            <span class="challenge-type-badge ${isGroup ? 'badge-group' : 'badge-solo'}">${isGroup ? '👥 GROUP' : '🧘 SOLO'}</span>
            <div>
                <strong style="font-size:1rem;">${c.title}</strong>
                <p style="font-size:0.85rem;color:var(--text-secondary);margin-top:4px;">${c.description || ''}</p>
                <small style="color:var(--accent-purple);">🎯 ${c.target_days} days &nbsp;|&nbsp; ⭐ ${c.bonus_points} pts &nbsp;|&nbsp; 📱 ≤${c.target_limit_min} min/day</small>
                ${isGroup ? `<div class="group-members">👥 Group Challenge &nbsp;·&nbsp; ID: <b>${c.challenge_id}</b></div>` : ''}
            </div>
            <div style="margin-top:10px;">
                ${c.my_status
                    ? `<span class="status-tag in_progress">✅ Joined</span>`
                    : `<button class="join-btn" onclick="joinChallenge(${c.challenge_id})">Join</button>`
                }
            </div>
        </div>
    `;
}

async function joinChallenge(challengeId) {
    const res = await apiRequest(`/challenges/${challengeId}/join`, { method: 'POST' });
    if (res && res.ok) {
        alert('Joined! 🎉');
        fetchChallenges();
    } else {
        const d = await res.json();
        alert(d.message || 'Could not join.');
    }
}


function renderAllUsers() {
    const container = document.getElementById('allUsersList');
    if (!container) return;

    if (_allUsers.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No users found. (Check console for errors)</p>';
        return;
    }

    const q = (document.getElementById('peopleSearch')?.value || '').toLowerCase();

    const filtered = _allUsers.filter(u => u.name && u.name.toLowerCase().includes(q));

    if (filtered.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No users match your search.</p>';
        return;
    }

    container.innerHTML = filtered.map(u => personCard(u)).join('');
}

function filterPeople() { renderAllUsers(); }

function personCard(u) {
    const displayName = u.name || 'Unknown User';
    const initial = displayName.charAt(0).toUpperCase();
    let actionHtml = '';

    if (u.friendship_status === 'ACCEPTED') {
        actionHtml = `<button class="friend-btn friends">✅ Friends</button>`;
    } else if (u.friendship_status === 'PENDING' && u.request_direction === 'me') {
        actionHtml = `<button class="friend-btn pending">⏳ Request Sent</button>`;
    } else if (u.friendship_status === 'PENDING' && u.request_direction === 'them') {
        actionHtml = `
            <button class="friend-btn accept"  onclick="acceptRequest(${u.friendship_id}, ${u.user_id})">✔ Accept</button>
            <button class="friend-btn decline" onclick="declineRequest(${u.friendship_id}, ${u.user_id})">✖ Decline</button>
        `;
    } else {
        actionHtml = `<button class="friend-btn add" onclick="sendFriendRequest(${u.user_id})">+ Add Friend</button>`;
    }

    return `
        <div class="person-card" id="person-${u.user_id}">
            <div style="display:flex;align-items:center;gap:12px;">
                <div class="person-avatar">${initial}</div>
                <div>
                    <div class="person-name">${displayName}</div>
                    <div class="person-meta">
                        <span>🏅 ${u.level_name || 'Bronze'}</span>
                        <span>⭐ ${u.total_points || 0} pts</span>
                        <span>🔥 ${u.current_streak || 0}d</span>
                    </div>
                </div>
            </div>
            <div class="person-actions" style="display:flex;flex-wrap:wrap;gap:8px;">
                ${actionHtml}
            </div>
        </div>
    `;
}


function renderRequests() {
    const container = document.getElementById('requestsList');
    if (!container) return;

    if (_requests.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No pending requests.</p>';
        return;
    }

    container.innerHTML = _requests.map(r => `
        <div class="person-card" id="req-${r.friendship_id}">
            <div style="display:flex;align-items:center;gap:12px;">
                <div class="person-avatar">${r.name.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="person-name">${r.name}</div>
                    <div class="person-meta">
                        <span>🏅 ${r.level_name || 'Bronze'}</span>
                        <span>⭐ ${r.total_points || 0} pts</span>
                    </div>
                </div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button class="friend-btn accept"  onclick="acceptRequest(${r.friendship_id}, ${r.user_id})">✔ Accept</button>
                <button class="friend-btn decline" onclick="declineRequest(${r.friendship_id}, ${r.user_id})">✖ Decline</button>
            </div>
        </div>
    `).join('');
}


function renderMyFriends() {
    const container = document.getElementById('myFriendsList');
    if (!container) return;

    if (_myFriends.length === 0) {
        container.innerHTML = '<p style="color:var(--text-secondary);">No friends yet — find people and send requests!</p>';
        return;
    }

    container.innerHTML = _myFriends.map(f => `
        <div class="person-card">
            <div style="display:flex;align-items:center;gap:12px;">
                <div class="person-avatar">${f.name.charAt(0).toUpperCase()}</div>
                <div>
                    <div class="person-name">${f.name}</div>
                    <div class="person-meta">
                        <span>🏅 ${f.level_name || 'Bronze'}</span>
                        <span>⭐ ${f.total_points || 0} pts</span>
                        <span>🔥 ${f.current_streak || 0}d streak</span>
                    </div>
                </div>
            </div>
            <span class="friend-btn friends" style="cursor:default;">✅ Friends</span>
        </div>
    `).join('');
}


async function sendFriendRequest(userId) {
    const res = await apiRequest(`/friends/request/${userId}`, { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    if (res.ok) {

        const u = _allUsers.find(x => x.user_id === userId);
        if (u) { u.friendship_status = 'PENDING'; u.request_direction = 'me'; }
        renderAllUsers();
    }
}

async function acceptRequest(friendshipId, userId) {
    const res = await apiRequest(`/friends/accept/${friendshipId}`, { method: 'POST' });
    const data = await res.json();
    if (res.ok) {

        await fetchPeopleData();
        renderRequests();
        renderMyFriends();
        renderAllUsers();
        populateFriendsCheckList();
        alert('Friend added! 🎉');
    } else {
        alert(data.message);
    }
}

async function declineRequest(friendshipId, userId) {
    const res = await apiRequest(`/friends/decline/${friendshipId}`, { method: 'POST' });
    if (res.ok) {
        _requests = _requests.filter(r => r.friendship_id !== friendshipId);
        renderRequests();
        const badge = document.getElementById('reqBadge');
        if (badge) {
            badge.textContent = _requests.length;
            badge.style.display = _requests.length > 0 ? 'inline-flex' : 'none';
        }
    }
}


function openCreateGroupModal() {
    populateFriendsCheckList();
    document.getElementById('createGroupModal').style.display = 'flex';
}
function closeCreateGroupModal() {
    document.getElementById('createGroupModal').style.display = 'none';
}

function populateFriendsCheckList() {
    const list = document.getElementById('friendsCheckList');
    if (!list) return;

    if (_myFriends.length === 0) {
        list.innerHTML = '<p class="no-friends-msg">You have no friends yet. Add some from the "Find People" tab first!</p>';
        return;
    }

    list.innerHTML = _myFriends.map(f => `
        <label class="friend-check-item">
            <input type="checkbox" name="friendSelect" value="${f.user_id}">
            <div class="person-avatar" style="width:34px;height:34px;font-size:1rem;">${f.name.charAt(0).toUpperCase()}</div>
            <div>
                <div class="fc-name">${f.name}</div>
                <div class="fc-meta">⭐ ${f.total_points || 0} pts &nbsp;·&nbsp; 🔥 ${f.current_streak || 0}d</div>
            </div>
        </label>
    `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    const token = localStorage.getItem('token');

    const isAuthPage = path.endsWith('Index.html') || path.endsWith('/') || path === '' || !path.includes('.html');
    if (isAuthPage && token) {
        window.location.href = 'dashboard.html';
        return;
    }

    if (path.includes('dashboard')) {
        loadDashboard();
    } else if (path.includes('challenges')) {
        loadChallengesPage();
    }
});


const createGroupForm = document.getElementById('createGroupForm');
if (createGroupForm) {
    createGroupForm.onsubmit = async (e) => {
        e.preventDefault();


        const checked = [...document.querySelectorAll('input[name="friendSelect"]:checked')];
        const invited_member_ids = checked.map(cb => parseInt(cb.value));

        const body = {
            title:             document.getElementById('groupTitle').value,
            group_name:        document.getElementById('groupName').value,
            target_days:       parseInt(document.getElementById('groupDays').value),
            target_limit_min:  parseInt(document.getElementById('groupLimit').value),
            bonus_points:      parseInt(document.getElementById('groupBonus').value) || 100,
            invited_member_ids
        };

        try {
            const res = await apiRequest('/challenges/group', {
                method: 'POST',
                body: JSON.stringify(body)
            });
            const data = await res.json();
            if (res.ok) {
                alert(`🎉 ${data.message}\nChallenge ID: ${data.challenge_id} — share it with others too!`);
                closeCreateGroupModal();
                createGroupForm.reset();
                fetchChallenges();
            } else {
                alert(data.message || 'Could not create group challenge.');
            }
        } catch (err) {
            alert('Error creating group challenge.');
        }
    };
}


async function simulateSync() {
    const syncBtn = document.getElementById('syncBtn');
    const cards = document.querySelectorAll('.limit-card');

    syncBtn.disabled = true;
    syncBtn.innerHTML = '🔍 Scanning Device for Usage Data…';

    await new Promise(r => setTimeout(r, 2000));

    const logs = [];

    cards.forEach(card => {
        const statusDiv = card.querySelector('[id^="status-"]');
        if (!statusDiv) return;
        const limitId = statusDiv.id.replace('status-', '');

        const limitText  = card.querySelector('p').innerText;
        const limitValue = parseInt(limitText.match(/\d+/)[0]);
        const simulatedUsage = Math.floor(limitValue * (0.5 + Math.random()));
        const isBreached = simulatedUsage > limitValue;

        statusDiv.innerHTML = `
            <span style="font-weight:bold;color:${isBreached ? '#ff4b2b' : '#00f2fe'};">
                Detected: ${simulatedUsage}m
            </span><br>
            <small style="color:var(--text-secondary);">${isBreached ? '⚠️ Breached' : '✅ Safe'}</small>
        `;

        logs.push({ limit_id: parseInt(limitId), actual_usage_min: simulatedUsage });
    });

    try {
        const date = new Date().toISOString().split('T')[0];
        const response = await apiRequest('/logs/submit', {
            method: 'POST',
            body: JSON.stringify({ date, logs })
        });

        if (response && response.ok) {
            syncBtn.innerHTML = '✅ Sync Complete!';
            setTimeout(() => {
                alert('Device data synced! Points and streaks updated.');
                loadDashboard();
            }, 1000);
        } else {
            const data = await response.json();
            alert(data.message || 'Sync failed. Please try again.');
            syncBtn.disabled = false;
            syncBtn.innerHTML = '🔄 Sync with Device Data';
        }
    } catch (err) {
        alert('Connection error during sync.');
        syncBtn.disabled = false;
        syncBtn.innerHTML = '🔄 Sync with Device Data';
    }
}