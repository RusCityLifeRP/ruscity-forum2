// ==========================================
// 1. КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
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

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
const auth = firebase.auth();
const db = firebase.database();

// Базовые роли для выпадающего списка в админке
const ROLES = [
    "Пользователь", "Заместитель главного администратора форума", "Главный администратор форума",
    "Заместитель главного администратора", "Главный администратор", "Специальный администратор", "Руководство проекта"
];
const ADMIN_PANEL_ROLES = ["Руководство проекта", "Специальный администратор", "Главный администратор", "Заместитель главного администратора"];

let currentUserData = null;
let allUsersCache = {}; 
let selectedServerId = ""; 
let selectedCategoryId = "";
let selectedFactionId = ""; 
let selectedTopicId = ""; 
let base64Avatar = ""; 
let base64Banner = "";
let isGlobalInfoZone = false; 
let viewedProfileUid = "";

// ==========================================
// 1.5 ДИНАМИЧЕСКАЯ ПРОВЕРОЧНАЯ СИСТЕМА ПРАВ ЛИДЕРА
// ==========================================
function checkModerationRights() {
    if (!currentUserData) return false;
    
    // Руководство проекта имеет абсолютный доступ ко всем разделам и серверам
    if (currentUserData.role === "Руководство проекта") return true;

    // Очищаем заголовки страниц от смайликов и лишних пробелов для точного сопоставления ролей
    const currentServerName = document.getElementById('current-server-title') ? document.getElementById('current-server-title').innerText.replace(/[^а-яА-ЯёЁa-zA-Z0-9 ]/g, '').trim() : "";
    const currentFactionName = document.getElementById('current-faction-title') ? document.getElementById('current-faction-title').innerText.replace(/[^а-яА-ЯёЁa-zA-Z0-9 ]/g, '').trim() : "";

    // Шаблон проверяемой роли, например: "Москва LIVE Лидер Правительство"
    const expectedLeaderRole = `${currentServerName} Лидер ${currentFactionName}`;

    // Проверяем, совпадает ли роль лидера с текущим разделом
    if (currentUserData.role === expectedLeaderRole) {
        return true;
    }

    return false;
}

// ==========================================
// 2. СЛУШАТЕЛЬ СЕССИИ И РОЛЕЙ
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

            if (currentUserData.isBanned) {
                alert("🔴 Ваш аккаунт заблокирован на данном форуме!");
                auth.signOut().then(() => { location.reload(); });
                return;
            }

            if(document.getElementById('edit-username')) document.getElementById('edit-username').value = currentUserData.username || "";
            if(document.getElementById('profile-avatar-preview')) document.getElementById('profile-avatar-preview').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            if(document.getElementById('profile-banner-preview')) {
                const b = currentUserData.banner || "";
                document.getElementById('profile-banner-preview').style.backgroundImage = b ? `url('${b}')` : "none";
            }

            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (btnProfile) btnProfile.classList.remove('hidden');
            if (document.getElementById('header-username')) document.getElementById('header-username').innerText = currentUserData.username || "Пользователь";
            if (document.getElementById('header-avatar')) document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";

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

function updateAdminButtonsVisibility() {
    const isLeader = currentUserData && currentUserData.role === "Руководство проекта";
    const btnCreateFaction = document.getElementById('btn-show-create-faction');
    const btnCreateTopic = document.getElementById('btn-show-create-topic');
    
    if (btnCreateFaction) { if(isLeader && !isGlobalInfoZone) btnCreateFaction.classList.remove('hidden'); else btnCreateFaction.classList.add('hidden'); }
    if (btnCreateTopic) { if(isLeader) btnCreateTopic.classList.remove('hidden'); else btnCreateTopic.classList.add('hidden'); }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ==========================================
// 3. СТРАНИЦА НАСТРОЕК ПРОФИЛЯ
// ==========================================
function previewImage(input, previewId, isBanner = false) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { alert("Файл больше 2 МБ!"); return; }
    const r = new FileReader();
    r.onload = function(e) {
        if (isBanner) { base64Banner = e.target.result; document.getElementById(previewId).style.backgroundImage = `url('${e.target.result}')`; }
        else { base64Avatar = e.target.result; document.getElementById(previewId).src = e.target.result; }
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
        alert("Сохранено!");
        showScreen('screen-forum');
    });
}

// ==========================================
// 4. ИГРОВЫЕ СЕРВЕРЫ И КАТЕГОРИИ
// ==========================================
function loadServers() {
    const infoDiv = document.getElementById('info-sections-list');
    const serversDiv = document.getElementById('servers-list');
    
    if (infoDiv) {
        const infoCats = [
            { id: "rules", name: "📜 Правила проекта", desc: "Регламенты и положения проекта" },
            { id: "laws", name: "⚖️ Законодательство", desc: "Конституция и кодексы" }
        ];
        infoDiv.innerHTML = "";
        infoCats.forEach(c => {
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #ff9f43"; 
            item.onclick = () => openFactionTopics(c.id, c.name, "info");
            item.innerHTML = `<div class="item-text-area"><h3>${c.name}</h3><p>${c.desc}</p></div>`;
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
                btn = `<button class="btn-secondary" style="padding:5px 10px; font-size:12px;" onclick="toggleHideServer('${id}', ${s.hidden || false}); event.stopPropagation();">${s.hidden ? 'Показать' : 'Скрыть'}</button>`;
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
        { id: "gov", name: "🏢 Государственные организации", desc: "Структуры и ведомства" },
        { id: "crime", name: "🥷 Криминальные организации", desc: "ОПГ и синдикаты" },
        { id: "reports", name: "🚫 Жалобы", desc: "Обращения игроков" }
    ];
    div.innerHTML = "";
    cats.forEach(c => {
        const item = document.createElement('div');
        item.className = 'forum-category-item';
        item.onclick = () => openCategoryFactions(c.id, c.name);
        item.innerHTML = `<div class="item-text-area"><h3>${c.name}</h3><p>${c.desc}</p></div>`;
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
    db.ref(`factions/${selectedServerId}/${selectedCategoryId}`).on('value', snap => {
        const div = document.getElementById('factions-list');
        if (!div) return; div.innerHTML = "";
        const data = snap.val();
        
        if (!data) {
            div.innerHTML = "<p style='color:#a0aab8; text-align:center; padding: 20px;'>В этом разделе организаций пока нет.</p>";
            return;
        }

        Object.keys(data).forEach(fId => {
            const isLeader = currentUserData && currentUserData.role === "Руководство проекта";
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #3b82f6";
            item.onclick = () => openFactionTopics(fId, data[fId].name, "server");
            
            let deleteBtn = isLeader ? `<button class="btn-delete-item" onclick="deleteFaction('${fId}'); event.stopPropagation();">❌ Удалить</button>` : '';
            
            item.innerHTML = `
                <div class="item-text-area">
                    <h3>🏢 ${data[fId].name}</h3>
                    <p>Просмотр тем организации</p>
                </div>
                ${deleteBtn}
            `;
            div.appendChild(item);
        });
    });
}

function deleteFaction(fId) {
    if (!confirm("Вы уверены, что хотите безвозвратно удалить эту фракцию вместе со всеми темами?")) return;
    db.ref(`factions/${selectedServerId}/${selectedCategoryId}/${fId}`).remove();
    db.ref(`topics/${selectedServerId}/${selectedCategoryId}/${fId}`).remove();
}

// ==========================================
// 5. ДВИЖОК ТЕМ И ТЕКСТОВЫЙ РЕДАКТОР WORD
// ==========================================
function openFactionTopics(factionId, factionName, context = "server") {
    selectedFactionId = factionId;
    isGlobalInfoZone = (context === "info");
    showScreen('screen-topics');
    if(document.getElementById('create-topic-form')) document.getElementById('create-topic-form').classList.add('hidden');
    if(document.getElementById('current-faction-title')) document.getElementById('current-faction-title').innerText = factionName;
    
    const btnBack = document.getElementById('btn-back-to-factions');
    if (btnBack) btnBack.onclick = () => { if (isGlobalInfoZone) showScreen('screen-forum'); else showScreen('screen-factions'); };

    updateAdminButtonsVisibility();
    const div = document.getElementById('topics-list');
    if (!div) return;

    const dbPath = isGlobalInfoZone ? `global_topics/${selectedFactionId}` : `topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}`;

    db.ref(dbPath).on('value', snap => {
        div.innerHTML = "";
        const topics = snap.val();
        if (!topics) { div.innerHTML = "<p style='color:#a0aab8; text-align:center; padding: 20px;'>В этой ветке пока нет ни одной темы...</p>"; return; }
        
        Object.keys(topics).forEach(tId => {
            const topic = topics[tId];
            const isLeader = currentUserData && currentUserData.role === "Руководство проекта";
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #ff4b4b";
            item.onclick = () => viewSelectedTopic(tId, topic.title);
            
            let deleteBtn = isLeader ? `<button class="btn-delete-item" onclick="deleteTopic('${tId}'); event.stopPropagation();">❌ Удалить</button>` : '';
            
            item.innerHTML = `
                <div class="item-text-area">
                    <h3>📌 ${topic.title || topic}</h3>
                </div>
                ${deleteBtn}
            `;
            div.appendChild(item);
        });
    });
}

function viewSelectedTopic(tId, tTitle) {
    selectedTopicId = tId;
    showScreen('screen-view-topic');
    
    if(document.getElementById('topic-view-title')) document.getElementById('topic-view-title').innerText = tTitle;
    if(document.getElementById('topic-view-content')) document.getElementById('topic-view-content').innerHTML = "Загрузка контента публикации...";
    if(document.getElementById('topic-editor-inputs')) document.getElementById('topic-editor-inputs').classList.add('hidden');
    
    // ПРОВЕРКА ПРАВ: Панель открывается либо Руководству, либо действующему лидеру конкретно этой фракции
    const hasAccess = checkModerationRights();
    const adminBlock = document.getElementById('topic-admin-editor-block');
    if (adminBlock) { 
        if (hasAccess) adminBlock.classList.remove('hidden'); 
        else adminBlock.classList.add('hidden'); 
    }

    const basePath = isGlobalInfoZone ? `global_topics/${selectedFactionId}/${tId}` : `topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}/${tId}`;

    db.ref(basePath).on('value', snap => {
        const data = snap.val();
        if (!data) return;
        
        const content = data.content || "В данной теме пока нет опубликованного текста. Лидер организации или руководство проекта могут добавить его через панель редактирования ниже.";
        
        if(document.getElementById('topic-view-content')) document.getElementById('topic-view-content').innerHTML = content;
        if(document.getElementById('editor-rich-content')) document.getElementById('editor-rich-content').innerHTML = data.content || "";
    });
}

function toggleTopicEditor() {
    document.getElementById('topic-editor-inputs').classList.toggle('hidden');
}

function formatText(command, value = null) {
    document.execCommand(command, false, value);
    document.getElementById('editor-rich-content').focus();
}

function saveTopicContent() {
    if (!checkModerationRights()) {
        alert("У вас нет прав на редактирование и модерацию данного раздела фракции!");
        return;
    }
    if (currentUserData.isMuted) { alert("Вы замучены на форуме!"); return; }
    
    const text = document.getElementById('editor-rich-content').innerHTML;
    const basePath = isGlobalInfoZone ? `global_topics/${selectedFactionId}/${selectedTopicId}` : `topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}/${selectedTopicId}`;
    
    db.ref(basePath).update({ content: text }).then(() => {
        alert("Текст публикации успешно сохранен лидером раздела!");
        document.getElementById('topic-editor-inputs').classList.add('hidden');
    });
}

function deleteTopic(tId) {
    if (!confirm("Вы уверены, что хотите удалить эту тему?")) return;
    const dbPath = isGlobalInfoZone ? `global_topics/${selectedFactionId}/${tId}` : `topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}/${tId}`;
    db.ref(dbPath).remove();
}

function backFromTopicView() { showScreen('screen-topics'); }
function toggleFactionForm() { document.getElementById('create-faction-form').classList.toggle('hidden'); }
function toggleTopicForm() { document.getElementById('create-topic-form').classList.toggle('hidden'); }

function createNewFaction() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта" || isGlobalInfoZone) return;
    if (currentUserData.isMuted) { alert("Вы замучены!"); return; }
    const name = document.getElementById('new-faction-name').value.trim();
    if (!name) return;
    db.ref(`factions/${selectedServerId}/${selectedCategoryId}/fact_${Date.now()}`).set({ name: name }).then(() => {
        document.getElementById('new-faction-name').value = "";
        document.getElementById('create-faction-form').classList.add('hidden');
    });
}

function createNewTopic() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    if (currentUserData.isMuted) { alert("Вы замучены!"); return; }
    const name = document.getElementById('new-topic-name').value.trim();
    if (!name) return;
    
    const dbPath = isGlobalInfoZone ? `global_topics/${selectedFactionId}` : `topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}`;
    
    db.ref(dbPath).push({
        title: name,
        content: ""
    }).then(() => {
        document.getElementById('new-topic-name').value = "";
        document.getElementById('create-topic-form').classList.add('hidden');
    });
}

function toggleHideServer(id, stat) {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    db.ref('servers/' + id).update({ hidden: !stat });
}

// ==========================================
// 6. СТЕНЫ, КОММЕНТАРИИ И ЛАЙКИ ИГРОКОВ
// ==========================================
function openPublicProfile(uid) {
    viewedProfileUid = uid;
    showScreen('screen-public-profile');
    if(document.getElementById('new-profile-comment')) document.getElementById('new-profile-comment').value = "";

    db.ref(`users/${uid}`).on('value', snap => {
        const u = snap.val(); if (!u) return;
        if(document.getElementById('public-username')) document.getElementById('public-username').innerText = u.username || "Игрок";
        if(document.getElementById('public-role')) document.getElementById('public-role').innerText = u.role || "Пользователь";
        if(document.getElementById('public-avatar')) document.getElementById('public-avatar').src = u.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
        if(document.getElementById('public-banner')) document.getElementById('public-banner').style.backgroundImage = u.banner ? `url('${u.banner}')` : "none";
    });

    db.ref(`profile_likes/${uid}`).on('value', snap => {
        const likes = snap.val() || {}; const count = Object.keys(likes).length;
        if(document.getElementById('public-likes-count')) document.getElementById('public-likes-count').innerText = count;
        const btn = document.getElementById('btn-profile-like');
        if (btn && auth.currentUser) {
            if (likes[auth.currentUser.uid]) { btn.innerHTML = `❤️ Вы лайкнули! (${count})`; btn.style.background = "#be123c"; }
            else { btn.innerHTML = `❤️ Лайков: <span id="public-likes-count">${count}</span>`; btn.style.background = "#e11d48"; }
        }
    });

    db.ref(`profile_comments/${uid}`).on('value', snap => {
        const list = document.getElementById('profile-comments-list'); if (!list) return; list.innerHTML = "";
        const comments = snap.val();
        if (!comments) { list.innerHTML = "<p style='color:#8a99ad; text-align:center;'>Стена пуста.</p>"; return; }
        Object.keys(comments).forEach(cId => {
            const c = comments[cId]; const item = document.createElement('div'); item.className = "comment-item";
            item.innerHTML = `<div class="comment-header"><span class="comment-author" onclick="openPublicProfile('${c.authorUid}')">${c.authorName}</span><span style="color:#64748b;">${c.date}</span></div><div class="comment-text">${c.text}</div>`;
            list.appendChild(item);
        });
    });
}

function toggleProfileLike() {
    if (!auth.currentUser) { alert("Войдите!"); return; }
    if (currentUserData && currentUserData.isBanned) return;
    const ref = db.ref(`profile_likes/${viewedProfileUid}/${auth.currentUser.uid}`);
    ref.once('value', snap => { if (snap.exists()) ref.remove(); else ref.set(true); });
}

function sendProfileComment() {
    if (!auth.currentUser || !currentUserData) return;
    if (currentUserData.isBanned) return;
    if (currentUserData.isMuted) { alert("Вы замучены!"); return; }
    const input = document.getElementById('new-profile-comment'); const text = input.value.trim(); if (!text) return;
    const dateStr = new Date().toLocaleString("ru-RU", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' });
    
    db.ref(`profile_comments/${viewedProfileUid}`).push({
        authorUid: auth.currentUser.uid, authorName: currentUserData.username || "Игрок", text: text, date: dateStr
    }).then(() => { input.value = ""; });
}

// ==========================================
// 7. МОДЕРАЦИЯ И АДМИНИСТРИРОВАНИЕ
// ==========================================
function openAdminPanel() {
    showScreen('screen-admin');
    if(document.getElementById('admin-search-user')) document.getElementById('admin-search-user').value = "";
    db.ref('users').once('value', snap => { allUsersCache = snap.val() || {}; renderAdminUsers(allUsersCache); });
}

function renderAdminUsers(usersData) {
    const list = document.getElementById('admin-users-list'); if (!list) return; list.innerHTML = '';
    Object.keys(usersData).forEach(uid => {
        if (auth.currentUser && auth.currentUser.uid === uid) return;
        const u = usersData[uid]; const card = document.createElement('div');
        let statusClass = '', statusBadge = '<span class="status-badge" style="background:rgba(16,185,129,0.1); color:#10b981;">Активен</span>';
        
        if (u.isBanned) { statusClass = 'status-banned'; statusBadge = '<span class="status-badge" style="background:rgba(255,75,75,0.1); color:#ff4b4b;">ЗАБАНЕН</span>'; }
        else if (u.isMuted) { statusClass = 'status-muted'; statusBadge = '<span class="status-badge" style="background:rgba(255,159,67,0.1); color:#ff9f43;">МУТ ЧАТА</span>'; }

        card.className = `admin-user-card ${statusClass}`;
        
        let roleOptions = ROLES.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('');
        if (u.role && !ROLES.includes(u.role)) {
            roleOptions += `<option value="${u.role}" selected>${u.role}</option>`;
        }

        card.innerHTML = `
            <div class="admin-card-header">
                <div>
                    <strong class="clickable-profile-link" style="font-size:16px; color:#fff;" onclick="openPublicProfile('${uid}')">${u.username || 'Без имени'}</strong>
                    <span style="font-size:12px; color:#8a99ad; margin-left:10px;">(Роль: ${u.role || 'Пользователь'})</span>
                </div>
                ${statusBadge}
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; background:rgba(0,0,0,0.15); padding:10px; border-radius:6px;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:13px; color:#8a99ad;">Выбрать роль:</span>
                    <select onchange="updateUserRole('${uid}', this.value)" style="flex-grow:1;">${roleOptions}</select>
                </div>
                <div style="display:flex; align-items:center; gap:10px; border-top:1px solid rgba(255,255,255,0.05); padding-top:8px;">
                    <span style="font-size:13px; color:#ff4b4b; font-weight:600;">Назначить лидером вручную:</span>
                    <input type="text" placeholder="Пример: Москва LIVE Лидер Правительство" style="flex-grow:1; padding:5px 10px; font-size:12px;" id="custom-role-${uid}">
                    <button class="btn-primary" style="padding:5px 10px; font-size:12px;" onclick="assignCustomLeaderRole('${uid}')">Ок</button>
                </div>
            </div>
            <div class="admin-actions-grid">
                ${u.isBanned ? `<button class="btn-punish unban" onclick="setPunishment('${uid}', 'unban')">🔓 Разбанить</button>` : `<button class="btn-punish ban" onclick="setPunishment('${uid}', 'ban')">❌ Бан аккаунта</button>`}
                ${u.isMuted ? `<button class="btn-punish unmute" onclick="setPunishment('${uid}', 'unmute')">🔊 Снять мут</button>` : `<button class="btn-punish mute" onclick="setPunishment('${uid}', 'mute')">🔇 Выдать мут</button>`}
            </div>`;
        list.appendChild(card);
    });
}

function assignCustomLeaderRole(uid) {
    const input = document.getElementById(`custom-role-${uid}`);
    if (!input) return;
    const value = input.value.trim();
    if (!value) { alert("Укажите строку роли!"); return; }
    
    updateUserRole(uid, value);
    alert(`Пользователю успешно выдана роль: ${value}`);
    openAdminPanel(); 
}

function filterAdminUsers() {
    const query = document.getElementById('admin-search-user').value.toLowerCase().trim();
    if (!query) { renderAdminUsers(allUsersCache); return; }
    const filtered = {};
    Object.keys(allUsersCache).forEach(uid => {
        if ((allUsersCache[uid].username || '').toLowerCase().includes(query)) filtered[uid] = allUsersCache[uid];
    });
    renderAdminUsers(filtered);
}

function updateUserRole(uid, newRole) {
    if (!currentUserData || !ADMIN_PANEL_ROLES.includes(currentUserData.role)) return;
    db.ref(`users/${uid}`).update({ role: newRole }).then(() => { if (allUsersCache[uid]) allUsersCache[uid].role = newRole; });
}

function setPunishment(uid, type) {
    if (!currentUserData || !ADMIN_PANEL_ROLES.includes(currentUserData.role)) return;
    let updateData = {}, message = "";
    switch(type) {
        case 'ban': updateData = { isBanned: true }; message = "Забанен!"; break;
        case 'unban': updateData = { isBanned: false }; message = "Разбанен!"; break;
        case 'mute': updateData = { isMuted: true }; message = "Мут выдан!"; break;
        case 'unmute': updateData = { isMuted: false }; message = "Мут снят!"; break;
    }
    db.ref(`users/${uid}`).update(updateData).then(() => {
        alert(message);
        if (allUsersCache[uid]) { Object.assign(allUsersCache[uid], updateData); filterAdminUsers(); }
    });
}

// ==========================================
// 8. АВТОРИЗАЦИЯ И СБРОСЫ ПАРОЛЕЙ
// ==========================================
function loginUser() {
    const email = document.getElementById('login-email').value.trim(); const pass = document.getElementById('login-password').value;
    if(!email || !pass) return;
    auth.signInWithEmailAndPassword(email, pass).then(() => { showScreen('screen-forum'); }).catch(err => alert(err.message));
}

function toggleResetForm(show) {
    const block = document.getElementById('reset-password-block'); if (!block) return;
    if (show) block.classList.remove('hidden'); else block.classList.add('hidden');
}

function sendPasswordReset() {
    const email = document.getElementById('reset-email').value.trim(); if (!email) return;
    auth.sendPasswordResetEmail(email).then(() => { alert("Ссылка на почте!"); toggleResetForm(false); }).catch(err => alert(err.message));
}

function logout() { auth.signOut().then(() => { location.reload(); }); }
document.addEventListener("DOMContentLoaded", () => { loadServers(); });
