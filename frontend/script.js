const API_BASE_URL = window.BACKEND_URL || `${window.location.protocol}//${window.location.hostname}:5000`;

let selectedTone = 1;
let isFeeding = false;

const elements = {
    deviceIp: document.getElementById('deviceIp'),
    updateIpBtn: document.getElementById('updateIpBtn'),
    foodAmount: document.getElementById('foodAmount'),
    foodAmountValue: document.getElementById('foodAmountValue'),
    volumeSlider: document.getElementById('volumeSlider'),
    volumeValue: document.getElementById('volumeValue'),
    feedBtn: document.getElementById('feedBtn'),
    playTestBtn: document.getElementById('playTestBtn'),
    chooseToneBtn: document.getElementById('chooseToneBtn'),
    toneBtns: document.querySelectorAll('.tone-btn'),

    statusText: document.getElementById('statusText'),
    statusFoodAmount: document.getElementById('statusFoodAmount'),
    statusVolume: document.getElementById('statusVolume'),
    statusTone: document.getElementById('statusTone'),
    statusFeeding: document.getElementById('statusFeeding'),
    todayFoodAmount: document.getElementById('todayFoodAmount'),

    profilePetName: document.getElementById('profilePetName'),
    profileBreed: document.getElementById('profileBreed'),
    profilePetImage: document.getElementById('profilePetImage'),
    logoutBtn: document.getElementById('logoutBtn'),

    openChatCard: document.getElementById('openChatCard'),
    aiChatPopup: document.getElementById('aiChatPopup'),
    closeChatBtn: document.getElementById('closeChatBtn'),
    chatMessages: document.getElementById('chatMessages'),
    chatInput: document.getElementById('chatInput'),
    sendChatBtn: document.getElementById('sendChatBtn'),

    calendarGrid: document.getElementById('calendarGrid'),
    barChart: document.getElementById('barChart'),
    lastFedTime: document.getElementById('lastFedTime'),
    weekTotal: document.getElementById('weekTotal'),
    weekAvg: document.getElementById('weekAvg'),
    weekFeedings: document.getElementById('weekFeedings')
};

function requireLogin() {
    const currentUserRaw = localStorage.getItem('pawportionCurrentUser');
    if (!currentUserRaw) {
        window.location.href = 'login.html';
        return null;
    }

    try {
        return JSON.parse(currentUserRaw);
    } catch (error) {
        localStorage.removeItem('pawportionCurrentUser');
        window.location.href = 'login.html';
        return null;
    }
}

function loadProfileCard() {
    const currentUser = requireLogin();
    if (!currentUser) return;

    elements.profilePetName.textContent = currentUser.petName || 'Pet';
    elements.profileBreed.textContent = currentUser.breed || 'Breed';
    elements.profilePetImage.src = currentUser.petImage || 'https://placehold.co/72x72/orange/white?text=🐶';
}

function setupAuthListeners() {
    if (!elements.logoutBtn) return;

    elements.logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('pawportionCurrentUser');
        window.location.href = 'login.html';
    });
}

function buildCalendar() {
    if (!elements.calendarGrid) return;
    const dayHeads = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const totalDays = new Date(year, month + 1, 0).getDate();

    const fragment = document.createDocumentFragment();

    dayHeads.forEach(day => {
        const head = document.createElement('span');
        head.textContent = day;
        head.className = 'head';
        fragment.appendChild(head);
    });

    for (let day = 1; day <= totalDays; day += 1) {
        const dateCell = document.createElement('span');
        dateCell.textContent = String(day);
        fragment.appendChild(dateCell);
    }

    elements.calendarGrid.innerHTML = '';
    elements.calendarGrid.appendChild(fragment);
}

function setupControlListeners() {
    elements.foodAmount.addEventListener('input', (event) => {
        elements.foodAmountValue.textContent = event.target.value;
    });

    elements.foodAmount.addEventListener('change', async (event) => {
        try {
            await apiCall('POST', '/api/food-amount', { amount: parseInt(event.target.value, 10) });
            await checkStatus();
        } catch (error) {
            console.error('Food amount update failed', error);
        }
    });

    elements.volumeSlider.addEventListener('input', (event) => {
        elements.volumeValue.textContent = event.target.value;
    });

    elements.volumeSlider.addEventListener('change', async (event) => {
        try {
            await apiCall('POST', '/api/volume', { level: parseInt(event.target.value, 10) });
            await checkStatus();
        } catch (error) {
            console.error('Volume update failed', error);
        }
    });

    elements.updateIpBtn.addEventListener('click', updateDeviceIP);
    elements.playTestBtn.addEventListener('click', playTestSound);
    elements.feedBtn.addEventListener('click', startFeeding);

    elements.chooseToneBtn.addEventListener('click', () => {
        const selectedBtn = document.querySelector('.tone-btn.active');
        if (selectedBtn) {
            selectTone(selectedBtn);
        }
    });

    elements.toneBtns.forEach((button) => {
        button.addEventListener('click', async () => {
            elements.toneBtns.forEach((item) => item.classList.remove('active'));
            button.classList.add('active');
            selectedTone = parseInt(button.dataset.tone, 10);
            // Immediately update status display and backend
            elements.statusTone.textContent = selectedTone;
            try {
                await apiCall('POST', '/api/tone', { tone: selectedTone });
            } catch (error) {
                console.error('Tone update failed', error);
            }
        });
    });
}

function setupChatPopupListeners() {
    elements.openChatCard.addEventListener('click', openChatPopup);
    elements.closeChatBtn.addEventListener('click', closeChatPopup);

    elements.sendChatBtn.addEventListener('click', sendChatMessage);
    elements.chatInput.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendChatMessage();
        }
    });
}

function openChatPopup() {
    elements.aiChatPopup.classList.remove('hidden');
    elements.chatInput.focus();
}

function closeChatPopup() {
    elements.aiChatPopup.classList.add('hidden');
}

async function apiCall(method, endpoint, data = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (data) {
        options.body = JSON.stringify(data);
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

async function checkStatus() {
    try {
        const status = await apiCall('GET', '/api/status');
        const isOnline = status.status === 'online';
        elements.statusText.textContent = isOnline ? 'Connected' : 'Offline';
        elements.statusText.style.color = isOnline ? '#1f9d3a' : '#d62828';
        elements.statusText.style.fontWeight = '700';
        elements.statusFoodAmount.textContent = status.foodAmount ?? '-';
        elements.statusVolume.textContent = status.volumeLevel ?? '-';
        elements.statusTone.textContent = status.selectedTone ?? '-';
        elements.statusFeeding.textContent = status.isFeeding ? 'Feeding...' : 'Idle';
        isFeeding = Boolean(status.isFeeding);
    } catch (error) {
        elements.statusText.textContent = 'Offline';
        elements.statusText.style.color = '#d62828';
        elements.statusText.style.fontWeight = '700';
    }
}

function updatePieFromLogs(logs) {
    const pie = document.getElementById('fakePie');
    if (!pie) return;
    const today = new Date().toDateString();
    const todayLogs = (logs || []).filter(l => new Date(l.timestamp).toDateString() === today);
    const completed = todayLogs.filter(l => l.status === 'completed').length;
    const failed = todayLogs.filter(l => l.status === 'failed').length;
    const started = todayLogs.filter(l => l.status === 'started').length;
    const total = completed + failed + started;
    if (total === 0) return;
    const c = Math.round((completed / total) * 100);
    const f = Math.round((failed / total) * 100);
    const s = Math.round((started / total) * 100);
    pie.style.background = `conic-gradient(#ff8d2b 0 ${c}%, #ff5a00 ${c}% ${c + f}%, #ffb347 ${c + f}% ${c + f + s}%, #e65c00 ${c + f + s}% 100%)`;
}

function renderBarChart(dailyStats) {
    if (!elements.barChart) return;
    const days = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        days.push({
            label: d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2),
            dateStr: d.toISOString().slice(0, 10),
            total: 0
        });
    }
    (dailyStats || []).forEach(row => {
        const match = days.find(d => d.dateStr === String(row.date).slice(0, 10));
        if (match) match.total = Number(row.total_food) || 0;
    });
    const maxTotal = Math.max(...days.map(d => d.total), 1);
    elements.barChart.innerHTML = days.map(d => {
        const pct = d.total > 0 ? Math.max(Math.round((d.total / maxTotal) * 88), 10) : 2;
        return `<div class="bar-col">
            <span class="bar-amt">${d.total > 0 ? d.total : ''}</span>
            <div class="bar-fill" style="height:${pct}%"></div>
            <span class="bar-label">${d.label}</span>
        </div>`;
    }).join('');
}

function updateWeeklyStats(dailyStats, logs) {
    const weekTotal = (dailyStats || []).reduce((s, r) => s + (Number(r.total_food) || 0), 0);
    const weekFeedings = (dailyStats || []).reduce((s, r) => s + (Number(r.feeding_count) || 0), 0);
    const activeDays = (dailyStats || []).filter(r => Number(r.feeding_count) > 0).length;
    const weekAvg = activeDays > 0 ? Math.round(weekTotal / activeDays) : 0;
    if (elements.weekTotal) elements.weekTotal.textContent = weekTotal;
    if (elements.weekAvg) elements.weekAvg.textContent = weekAvg;
    if (elements.weekFeedings) elements.weekFeedings.textContent = weekFeedings;
    const completedLogs = (logs || []).filter(l => l.status === 'completed');
    if (completedLogs.length > 0 && elements.lastFedTime) {
        const last = new Date(completedLogs[0].timestamp);
        elements.lastFedTime.textContent = last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
}

async function loadTodayAmount() {
    try {
        const currentUser = requireLogin();
        if (!currentUser) return;
        const uid = currentUser.id;
        const [logs, dailyStatsUser, dailyStatsDevice] = await Promise.all([
            apiCall('GET', `/api/feeding/logs?limit=200&userId=${uid}`),
            apiCall('GET', `/api/feeding/stats/daily?days=7&userId=${uid}`).catch(() => []),
            apiCall('GET', '/api/feeding/stats/daily?days=7').catch(() => [])
        ]);
        const today = new Date().toDateString();
        const total = logs
            .filter((entry) => entry.status === 'completed' && new Date(entry.timestamp).toDateString() === today)
            .reduce((sum, entry) => sum + Number(entry.food_amount || 0), 0);

        elements.todayFoodAmount.textContent = total;
        updatePieFromLogs(logs);
        const chartStats = (dailyStatsUser && dailyStatsUser.length > 0) ? dailyStatsUser : dailyStatsDevice;
        renderBarChart(chartStats);
        updateWeeklyStats(chartStats, logs);
    } catch (error) {
        elements.todayFoodAmount.textContent = '0';
    }
}

async function updateDeviceIP() {
    const ip = elements.deviceIp.value.trim();
    if (!ip) return;

    try {
        await apiCall('POST', '/api/device/ip', { ip });
        localStorage.setItem('deviceIP', ip);
    } catch (error) {
        console.error('IP update failed', error);
    }
}

async function selectTone(button) {
    const tone = parseInt(button.dataset.tone, 10);
    selectedTone = tone;
    try {
        await apiCall('POST', '/api/tone', { tone });
        elements.statusTone.textContent = tone;
        await checkStatus();
    } catch (error) {
        console.error('Tone update failed', error);
    }
}

async function playTestSound() {
    try {
        await apiCall('POST', '/api/play-sound', {});
    } catch (error) {
        console.error('Play sound failed', error);
    }
}

async function startFeeding() {
    if (isFeeding) return;

    const currentUser = requireLogin();
    if (!currentUser) return;

    const amount = parseInt(elements.foodAmount.value, 10);
    const volume = parseInt(elements.volumeSlider.value, 10);
    if (!amount || amount <= 0) return;

    try {
        isFeeding = true;
        elements.statusFeeding.textContent = 'Feeding...';
        elements.feedBtn.disabled = true;

        // Push all selected values and update status panel immediately
        await apiCall('POST', '/api/food-amount', { amount });
        elements.statusFoodAmount.textContent = amount;

        await apiCall('POST', '/api/tone', { tone: selectedTone });
        elements.statusTone.textContent = selectedTone;

        await apiCall('POST', '/api/volume', { level: volume });
        elements.statusVolume.textContent = volume;

        await apiCall('POST', '/api/feed', { amount, tone: selectedTone, userId: currentUser.id });
        elements.statusFeeding.textContent = 'Feeding...';

        await loadTodayAmount();
    } catch (error) {
        console.error('Feed failed', error);
        elements.statusFeeding.textContent = 'Error';
    } finally {
        isFeeding = false;
        elements.feedBtn.disabled = false;
        // Sync actual state from device after a short delay
        setTimeout(checkStatus, 2000);
    }
}

function addChatMessage(role, text) {
    const message = document.createElement('div');
    message.className = `msg ${role}`;
    message.textContent = text;
    elements.chatMessages.appendChild(message);
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

async function sendChatMessage() {
    const userText = elements.chatInput.value.trim();
    if (!userText) return;

    addChatMessage('user', userText);
    elements.chatInput.value = '';
    elements.sendChatBtn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: userText })
        });

        if (!response.ok) {
            const errorPayload = await response.json().catch(() => ({}));
            throw new Error(errorPayload.error || `AI HTTP ${response.status}`);
        }

        const data = await response.json();
        const botReply = data?.reply || 'I could not generate a response right now.';
        addChatMessage('bot', botReply);
    } catch (error) {
        addChatMessage('bot', `Unable to connect to AI right now. ${error.message}`);
    } finally {
        elements.sendChatBtn.disabled = false;
        elements.chatInput.focus();
    }
}

function initialize() {
    loadProfileCard();
    setupAuthListeners();
    buildCalendar();
    setupControlListeners();
    setupChatPopupListeners();

    const savedIP = localStorage.getItem('deviceIP');
    if (savedIP) {
        elements.deviceIp.value = savedIP;
        updateDeviceIP().catch((error) => {
            console.error('Initial device IP sync failed', error);
        });
    }

    checkStatus();
    loadTodayAmount();

    setInterval(checkStatus, 5000);
    setInterval(loadTodayAmount, 30000);
}

document.addEventListener('DOMContentLoaded', initialize);
