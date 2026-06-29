// ==========================================
// 1. ИНИЦИАЛИЗАЦИЯ И КОНФИГУРАЦИЯ FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyBdF1KOHXA0K4O213JdF9FDCnarx0bEBy8",
    authDomain: "ruscity-349e7.firebaseapp.com",
    databaseURL: "https://ruscity-349e7-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "ruscity-349e7",
    storageBucket: "ruscity-349e7.firebasestorage.app",
    messagingSenderId: "728638066749",
    appId: "1:728638066749:web:78b207bc6765e3dc685a54"
};

if (!firebase.apps.length) { 
    firebase.initializeApp(firebaseConfig); 
}
const auth = firebase.auth();
const db = firebase.database();

// Константы ролей
const ROLES = [
    "Пользователь", "Заместитель главного администратора форума", "Главный администратор форума",
    "Заместитель главного администратора", "Главный администратор", "Специальный администратор", "Руководство проекта"
];
const ADMIN_PANEL_ROLES = ["Руководство проекта", "Специальный администратор", "Главный администратор", "Заместитель главного администратора"];

// Глобальные переменные состояния приложения
let currentUserData = null;
let allUsersCache = {}; 
let selectedServerId = ""; 
let selectedCategoryId = "";
let selectedFactionId = ""; 
let base64Avatar = ""; 
let base64Banner = "";
let isGlobalInfoZone = false; 

// ==========================================
// 2. СЛУШАТЕЛЬ СЕССИИ И ПРОФИЛЯ ПОЛЬЗОВАТЕЛЯ
// ==========================================
auth.onAuthStateChanged(user => {
    const btnAdmin = document.getElementById('btn-admin-panel');
    const btnProfile = document.getElementById('btn-profile-edit');
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    
    if (user) {
        db.ref('users/' + user.uid).on('value', snapshot => {
            currentUserData = snapshot.val();
            if (!currentUserData) return;
            currentUserData.uid = user.uid;

            // СТРОГАЯ ПРОВЕРКА НА БАН ПРИ ВХОДЕ/АКТИВНОСТИ
            if (currentUserData.isBanned) {
                alert("🔴 Ваш аккаунт заблокирован на данном форуме!");
                auth.signOut().then(() => { location.reload(); });
                return;
            }

            // Синхронизация полей редактора профиля
            if(document.getElementById('edit-username')) document.getElementById('edit-username').value = currentUserData.username || "";
            if(document.getElementById('profile-avatar-preview')) document.getElementById('profile-avatar-preview').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            if(document.getElementById('profile-banner-preview')) {
                const b = currentUserData.banner || "";
                document.getElementById('profile-banner-preview').style.backgroundImage = b ? `url('${b}')` : "none";
            }

            // Переключение элементов шапки под авторизованного юзера
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (btnProfile) btnProfile.classList.remove('hidden');
            if (document.getElementById('header-username')) document.getElementById('header-username').innerText = currentUserData.username || "Пользователь";
            if (document.getElementById('header-avatar')) document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";

            // Отображение кнопки Админ-панели
            if (btnAdmin) {
                if (ADMIN_PANEL_ROLES.includes(currentUserData.role)) btnAdmin.classList.remove('hidden');
                else btnAdmin.classList.add('hidden');
            }
            updateAdminButtonsVisibility();
        });
    } else {
        currentUserData = null;
        if (authButtons) authButtons.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (btnAdmin) btnAdmin.classList.add('hidden');
        if (btnProfile) btnProfile.classList.add('hidden');
    }
});

// Видимость кнопок создания тем/фракций
function updateAdminButtonsVisibility() {
    const isLeader = currentUserData && currentUserData.role === "Руководство проекта";
    const btnCreateFaction = document.getElementById('btn-show-create-faction');
    const btnCreateTopic = document.getElementById('btn-show-create-topic');
    
    if (btnCreateFaction) { if(isLeader && !isGlobalInfoZone) btnCreateFaction.classList.remove('hidden'); else btnCreateFaction.classList.add('hidden'); }
    if (btnCreateTopic) { if(isLeader) btnCreateTopic.classList.remove('hidden'); else btnCreateTopic.classList.add('hidden'); }
}

// Переключение между экранами
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ==========================================
// 3. РАБОТА С ХРАНИЛИЩЕМ ПРОФИЛЯ (АВАТАР/БАННЕР)
// ==========================================
function previewImage(input, previewId, isBanner = false) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Файл превышает лимит 2 МБ!"); return; }
    const r = new FileReader();
    r.onload = function(e) {
        if (isBanner) { 
            base64Banner = e.target.result; 
            document.getElementById(previewId).style.backgroundImage = `url('${e.target.result}')`; 
        } else { 
            base64Avatar = e.target.result; 
            document.getElementById(previewId).src = e.target.result; 
        }
    };
    r.readAsDataURL(file);
}

function saveProfileChanges() {
    if (!auth.currentUser) return;
    const name = document.getElementById('edit-username').value.trim();
    if (!name) return;
    const up = { username: name };
    if (base64Avatar) up.avatar = base64Avatar;
    if (base64Banner) up.banner = base64Banner;
    db.ref('users/' + auth.currentUser.uid).update(up).then(() => {
        alert("Изменения успешно сохранены!");
        showScreen('screen-forum');
    });
}

// ==========================================
// 4. ДИНАМИЧЕСКИЙ ДВИЖОК ФОРУМА (СТРУКТУРА)
// ==========================================
function loadServers() {
    const infoDiv = document.getElementById('info-sections-list');
    const serversDiv = document.getElementById('servers-list');
    
    if (infoDiv) {
        const infoCats = [
            { id: "rules", name: "📜 Правила проекта", desc: "Общие правила сервера, регламенты и положения для игроков" },
            { id: "laws", name: "⚖️ Законодательство", desc: "Конституция, кодексы, законы и нормативно-правочные акты" }
        ];
        infoDiv.innerHTML = "";
        infoCats.forEach(c => {
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #ff9f43"; 
            item.onclick = () => openFactionTopics(c.id, c.name, "info");
            item.innerHTML = `<h3>${c.name}</h3><p>${c.desc}</p>`;
            infoDiv.appendChild(item);
        });
    }

    if (!serversDiv) return;
    db.ref('servers').on('value', snap => {
        serversDiv.innerHTML = '';
        let servers = snap.val();
        if (!servers) {
            servers = { "moscow": { name: "Москва LIVE", hidden: false } };
            db.ref('servers').set(servers);
        }
        Object.keys(servers).forEach(id => {
            const s = servers[id];
            const isLeader = currentUserData && currentUserData.role === "Руководство проекта";
            if (s.hidden && !isLeader) return;
            const card = document.createElement('div');
            card.className = 'server-card-item';
            let btn = '';
            if (isLeader) {
                btn = `<button class="btn-admin-action" onclick="toggleHideServer('${id}', ${s.hidden || false}); event.stopPropagation();">${s.hidden ? 'Показать' : 'Скрыть'}</button>`;
            }
            card.innerHTML = `<div class="server-clickable-area" onclick="openServerCategories('${id}', '${s.name || id}', '🏰')"><h3>🏰 ${s.name || id}</h3><p>Перейти к разделам</p></div><div>${btn}</div>`;
            serversDiv.appendChild(card);
        });
    });
}

function openServerCategories(id, name, emoji) {
    selectedServerId = id;
    showScreen('screen-categories');
    if(document.getElementById('current-server-title')) document.getElementById('current-server-title').innerText = `${emoji} ${name}`;
    const div = document.getElementById('categories-list');
    if (!div) return;
    const cats = [
        { id: "gov", name: "🏢 Государственные организации", desc: "Официальные структуры и ведомства" },
        { id: "crime", name: "🥷 Криминальные организации", desc: "ОПГ и синдикаты" },
        { id: "reports", name: "🚫 Жалобы", desc: "Жалобы игроков и апелляции" }
    ];
    div.innerHTML = "";
    cats.forEach(c => {
        const item = document.createElement('div');
        item.className = 'forum-category-item';
        item.onclick = () => openCategoryFactions(c.id, c.name);
        item.innerHTML = `<h3>${c.name}</h3><p>${c.desc}</p>`;
        div.appendChild(item);
    });
}

function openCategoryFactions(catId, catName) {
    selectedCategoryId = catId;
    isGlobalInfoZone = false;
    showScreen('screen-factions');
    if(document.getElementById('create-faction-form')) document.getElementById('create-faction-form').classList.add('hidden');
    if(document.getElementById('current-category-title')) document.getElementById('current-category-title').innerText = catName;
    if(document.getElementById('btn-back-to-categories')) document.getElementById('btn-back-to-categories').onclick = () => showScreen('screen-categories');

    updateAdminButtonsVisibility();
    const ref = db.ref(`factions/${selectedServerId}/${selectedCategoryId}`);
    
    ref.on('value', snap => {
        const div = document.getElementById('factions-list');
        if (!div) return;
        div.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(fId => {
                const item = document.createElement('div');
                item.className = 'forum-category-item';
                item.style.borderLeft = "4px solid #3b82f6";
                item.onclick = () => openFactionTopics(fId, data[fId].name, "server");
                const icon = data[fId].icon || "🏢";
                item.innerHTML = `<h3>${icon} ${data[fId].name}</h3><p>Нажмите для просмотра тем</p>`;
                div.appendChild(item);
            });
        }
    });
}

function openFactionTopics(factionId, factionName, context = "server") {
    selectedFactionId = factionId;
    isGlobalInfoZone = (context === "info");
    
    showScreen('screen-topics');
    if(document.getElementById('create-topic-form')) document.getElementById('create-topic-form').classList.add('hidden');
    if(document.getElementById('current-faction-title')) document.getElementById('current-faction-title').innerText = factionName;
    
    const btnBack = document.getElementById('btn-back-to-factions');
    if (btnBack) {
        btnBack.onclick = () => {
            if (isGlobalInfoZone) showScreen('screen-forum');
            else showScreen('screen-factions');
        };
    }

    updateAdminButtonsVisibility();
    const div = document.getElementById('topics-list');
    if (!div) return;

    const dbPath = isGlobalInfoZone 
        ? `global_topics/${selectedFactionId}` 
        : `topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}`;

    db.ref(dbPath).on('value', snap => {
        div.innerHTML = "";
        const topics = snap.val();
        if (!topics) {
            div.innerHTML = "<p style='color:#a0aab8; text-align:center; padding: 20px;'>В этом разделе еще нет тем.</p>";
            return;
        }
        Object.values(topics).forEach(topicName => {
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #ff4b4b";
            item.onclick = () => alert(`Открываем тему: ${topicName}`);
            item.innerHTML = `<h3>📌 ${topicName}</h3>`;
            div.appendChild(item);
        });
    });
}

function toggleFactionForm() { document.getElementById('create-faction-form').classList.toggle('hidden'); }
function toggleTopicForm() { document.getElementById('create-topic-form').classList.toggle('hidden'); }

// ПРОВЕРКА НА МУТ ПРИ СОЗДАНИИ ДАННЫХ
function createNewFaction() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта" || isGlobalInfoZone) return;
    if (currentUserData.isMuted) { alert("Вы замучены! Действие отклонено."); return; }
    
    const name = document.getElementById('new-faction-name').value.trim();
    if (!name) return;
    const fId = "fact_" + Date.now();
    db.ref(`factions/${selectedServerId}/${selectedCategoryId}/${fId}`).set({ name: name, icon: "🏢" }).then(() => {
        document.getElementById('new-faction-name').value = "";
        document.getElementById('create-faction-form').classList.add('hidden');
    });
}

function createNewTopic() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    if (currentUserData.isMuted) { alert("Вы замучены! Невозможно создать тему."); return; }

    const name = document.getElementById('new-topic-name').value.trim();
    if (!name) return;

    const dbPath = isGlobalInfoZone 
        ? `global_topics/${selectedFactionId}` 
        : `topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}`;

    db.ref(dbPath).push(name).then(() => {
        document.getElementById('new-topic-name').value = "";
        if(document.getElementById('create-topic-form')) document.getElementById('create-topic-form').classList.add('hidden');
    });
}

function toggleHideServer(id, stat) {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    db.ref('servers/' + id).update({ hidden: !stat });
}

// ==========================================
// 5. МОДЕРНИЗИРОВАННАЯ АДМИНКА И НАКАЗАНИЯ
// ==========================================
function openAdminPanel() {
    showScreen('screen-admin');
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    
    if(document.getElementById('admin-search-user')) document.getElementById('admin-search-user').value = "";

    db.ref('users').once('value', snap => {
        allUsersCache = snap.val() || {};
        renderAdminUsers(allUsersCache);
    });
}

function renderAdminUsers(usersData) {
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    list.innerHTML = '';

    Object.keys(usersData).forEach(uid => {
        const u = usersData[uid];
        if (auth.currentUser && auth.currentUser.uid === uid) return; // Пропуск себя

        const card = document.createElement('div');
        let statusClass = '';
        let statusBadge = '<span class="status-badge" style="background: rgba(16,185,129,0.1); color: #10b981;">Активен</span>';
        
        if (u.isBanned) {
            statusClass = 'status-banned';
            statusBadge = '<span class="status-badge" style="background: rgba(255,75,75,0.1); color: #ff4b4b;">ЗАБАНЕН</span>';
        } else if (u.isMuted) {
            statusClass = 'status-muted';
            statusBadge = '<span class="status-badge" style="background: rgba(255,159,67,0.1); color: #ff9f43;">МУТ ЧАТА</span>';
        }

        card.className = `admin-user-card ${statusClass}`;
        let roleOptions = ROLES.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('');

        card.innerHTML = `
            <div class="admin-card-header">
                <div>
                    <strong style="font-size: 16px; color: #fff;">${u.username || 'Без имени'}</strong>
                    <span style="font-size: 12px; color: #8a99ad; margin-left: 10px;">(Роль: ${u.role || 'Пользователь'})</span>
                </div>
                ${statusBadge}
            </div>
            <div style="display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px;">
                <span style="font-size: 13px; color: #8a99ad;">Изменить роль:</span>
                <select onchange="updateUserRole('${uid}', this.value)" style="flex-grow: 1;">${roleOptions}</select>
            </div>
            <div class="admin-actions-grid">
                ${u.isBanned 
                    ? `<button class="btn-punish unban" onclick="setPunishment('${uid}', 'unban')">🔓 Разбанить</button>` 
                    : `<button class="btn-punish ban" onclick="setPunishment('${uid}', 'ban')">❌ Бан аккаунта</button>`
                }
                ${u.isMuted 
                    ? `<button class="btn-punish unmute" onclick="setPunishment('${uid}', 'unmute')">🔊 Снять мут</button>` 
                    : `<button class="btn-punish mute" onclick="setPunishment('${uid}', 'mute')">🔇 Выдать мут</button>`
                }
            </div>
        `;
        list.appendChild(card);
    });
}

// Живой поиск
function filterAdminUsers() {
    const query = document.getElementById('admin-search-user').value.toLowerCase().trim();
    if (!query) {
        renderAdminUsers(allUsersCache);
        return;
    }
    const filtered = {};
    Object.keys(allUsersCache).forEach(uid => {
        const username = (allUsersCache[uid].username || '').toLowerCase();
        if (username.includes(query)) { filtered[uid] = allUsersCache[uid]; }
    });
    renderAdminUsers(filtered);
}

function updateUserRole(uid, newRole) {
    if (!currentUserData || !ADMIN_PANEL_ROLES.includes(currentUserData.role)) return;
    db.ref(`users/${uid}`).update({ role: newRole }).then(() => {
        if (allUsersCache[uid]) allUsersCache[uid].role = newRole;
    });
}

function setPunishment(uid, type) {
    if (!currentUserData || !ADMIN_PANEL_ROLES.includes(currentUserData.role)) {
        alert("У вас недостаточно прав!");
        return;
    }
    let updateData = {};
    let message = "";

    switch(type) {
        case 'ban': updateData = { isBanned: true }; message = "Пользователь заблокирован!"; break;
        case 'unban': updateData = { isBanned: false }; message = "Пользователь разблокирован!"; break;
        case 'mute': updateData = { isMuted: true }; message = "Пользователю выдан мут!"; break;
        case 'unmute': updateData = { isMuted: false }; message = "Мут чата снят!"; break;
    }

    db.ref(`users/${uid}`).update(updateData).then(() => {
        alert(message);
        if (allUsersCache[uid]) {
            Object.assign(allUsersCache[uid], updateData);
            filterAdminUsers();
        }
    }).catch(err => alert("Ошибка: " + err.message));
}

// ==========================================
// 6. АВТОРИЗАЦИЯ И СБРОС ДОСТУПА
// ==========================================
function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    if(!email || !pass) { alert("Заполните все поля!"); return; }
    
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => { showScreen('screen-forum'); })
        .catch(err => { alert("Ошибка входа: " + err.message); });
}

function toggleResetForm(show) {
    const block = document.getElementById('reset-password-block');
    if (!block) return;
    if (show) block.classList.remove('hidden');
    else block.classList.add('hidden');
}

function sendPasswordReset() {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) { alert("Введите Email!"); return; }

    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert(`Ссылка отправлена на: ${email}\nПройдите по ней для смены пароля.`);
            document.getElementById('reset-email').value = "";
            toggleResetForm(false);
            if (auth.currentUser) { auth.signOut().then(() => { location.reload(); }); } 
            else { showScreen('screen-login'); }
        })
        .catch(err => { alert("Ошибка: " + err.message); });
}

function logout() { auth.signOut().then(() => { location.reload(); }); }

// Инициализация при загрузке страницы
document.addEventListener("DOMContentLoaded", () => { loadServers(); });
