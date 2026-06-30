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

if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();

// ==========================================
// 2. НАСТРОЙКИ И СПИСКИ ПРОЕКТА
// ==========================================
const SERVERS_LIST_CONFIG = {
    "moscow": "🏰 Москва",
    "sochi": "🌴 Сочи",
    "spb": "⚓ Санкт-Петербург"
};

const LEADER_FACTIONS_LIST = [
    "Судебная Власть",
    "Правительство",
    "Федеральная служба безопасности",
    "МВД",
    "Министерство Обороны",
    "Министерство Здравоохранения",
    "Москва LIVE",
    "Арзамас LIVE",
    "Сочи LIVE",
    "СМИ",
    "ОПГ Тамбовское",
    "ОПГ Кавказское",
    "ОПГ Лыткаринское"
];

const FORUM_ROLES_GROUPS = {
    "Высшая Администрация": ["Руководство проекта", "Разработчик", "Основатель", "Спец. Администратор", "Главный Администратор", "Зам. Гл. Администратора"],
    "Управляющая Администрация": ["Куратор Форума", "Куратор Сервера", "Гл. Куратор за Гос. организациями", "Гл. Куратор за ОПГ"],
    "Игровая Администрация": ["Старший Администратор", "Администратор", "Младший Администратор", "Модератор", "Хелпер"],
    "Обычные роли": ["Пользователь", "Проверенный пользователь", "Премиум", "Заблокирован"]
};

// Список ролей, у которых есть доступ абсолютно ко ВСЕМУ и к админ-панели
const ALL_ADMIN_ROLES = ["Руководство проекта", "Разработчик", "Основатель", "Спец. Администратор", "Главный Администратор", "Зам. Гл. Администратора", "Куратор Форума"];

// Глобальное состояние
let currentServerId = '';
let currentCategoryId = '';
let currentFactionId = '';
let currentTopicId = '';
let currentProfileUid = '';
let allUsersDataLocal = {};

// ==========================================
// 3. НАВИГАЦИЯ И СТАТУС ОНЛАЙНА
// ==========================================
function backToHome() {
    currentServerId = '';
    currentCategoryId = '';
    currentFactionId = '';
    currentTopicId = '';
    showScreen('screen-forum');
    updateOnlineStatus(true);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.remove('hidden');
}

function updateOnlineStatus(isOnline) {
    if (!auth.currentUser) return;
    db.ref(`users/${auth.currentUser.uid}/status`).set(isOnline ? "online" : "offline");
}

function hasEditAccess() {
    if (!auth.currentUser || !allUsersDataLocal[auth.currentUser.uid]) return false;
    const currentUser = allUsersDataLocal[auth.currentUser.uid];
    
    // Администрация имеет доступ
    if (ALL_ADMIN_ROLES.includes(currentUser.role)) return true;

    // Лидеры / замы имеют доступ к своей фракции
    if (currentUser.isLeader || currentUser.isSubLeader) {
        if (currentUser.leaderServer === currentServerId && currentUser.leaderFaction === currentFactionId) {
            return true;
        }
    }
    return false;
}

// ==========================================
// 4. АВТОРИЗАЦИЯ И РЕГИСТРАЦИЯ
// ==========================================
function registerUser() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();

    if(!username || !email || !password) return alert("Заполните все поля регистрации!");

    auth.createUserWithEmailAndPassword(email, password).then((userCredential) => {
        const uid = userCredential.user.uid;
        db.ref(`users/${uid}`).set({
            uid: uid,
            username: username,
            email: email,
            role: "Пользователь",
            avatar: "",
            banner: "",
            bio: "Новичок на форуме RusCity",
            likes: 0,
            status: "online"
        }).then(() => {
            alert("Регистрация успешна!");
            backToHome();
        });
    }).catch(err => alert("Ошибка: " + err.message));
}

function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();

    if(!email || !password) return alert("Введите данные для входа!");

    auth.signInWithEmailAndPassword(email, password).then(() => {
        alert("Вы успешно вошли!");
        backToHome();
    }).catch(err => alert("Ошибка: " + err.message));
}

function logout() {
    updateOnlineStatus(false);
    auth.signOut().then(() => {
        location.reload();
    });
}

// ==========================================
// 5. РАБОТА С ФОРУМОМ (СЕРВЕРА, ТЕМЫ)
// ==========================================
function loadForumData() {
    // Рендер серверов
    const serversList = document.getElementById('servers-list');
    if(serversList) {
        serversList.innerHTML = '';
        Object.keys(SERVERS_LIST_CONFIG).forEach(sId => {
            const card = document.createElement('div');
            card.className = 'forum-section-card item-clickable';
            card.innerHTML = `<div class="section-icon">🌐</div><div class="section-title">${SERVERS_LIST_CONFIG[sId]}</div>`;
            card.onclick = () => openServerCategories(sId);
            serversList.appendChild(card);
        });
    }

    // Исправленный рендер Важной информации (фикс undefined)
    db.ref('info_sections').on('value', snap => {
        const infoList = document.getElementById('info-sections-list');
        if(!infoList) return;
        infoList.innerHTML = '';
        const data = snap.val();
        if(!data) {
            infoList.innerHTML = '<div class="empty-notify">Важных объявлений пока нет.</div>';
            return;
        }
        for(let id in data) {
            const card = document.createElement('div');
            card.className = 'forum-section-card item-clickable';
            // Проверяем и title, и name на случай разных структур в базе
            const displayTitle = data[id].title || data[id].name || "Без названия";
            card.innerHTML = `<div class="section-icon">📢</div><div class="section-title">${displayTitle}</div>`;
            card.onclick = () => openTopic(id, true);
            infoList.appendChild(card);
        }
    });

    // Статистика
    db.ref('users').on('value', snap => {
        const users = snap.val() || {};
        allUsersDataLocal = users;
        
        let onlineCount = 0;
        let uKeys = Object.keys(users);
        
        uKeys.forEach(k => {
            if(users[k].status === 'online') onlineCount++;
        });
        
        if(document.getElementById('stats-online-count')) {
            document.getElementById('stats-online-count').innerText = `${onlineCount} чел.`;
        }

        if(uKeys.length > 0) {
            if(document.getElementById('stats-first-user')) {
                document.getElementById('stats-first-user').innerText = users[uKeys[0]].username || "Неизвестно";
                document.getElementById('stats-first-user').onclick = () => openPublicProfile(uKeys[0]);
            }
            if(document.getElementById('stats-last-user')) {
                document.getElementById('stats-last-user').innerText = users[uKeys[uKeys.length - 1]].username || "Неизвестно";
                document.getElementById('stats-last-user').onclick = () => openPublicProfile(uKeys[uKeys.length - 1]);
            }
        }
    });
}

function openServerCategories(serverId) {
    currentServerId = serverId;
    document.getElementById('current-server-title').innerText = SERVERS_LIST_CONFIG[serverId];
    showScreen('screen-categories');

    const catList = document.getElementById('categories-list');
    catList.innerHTML = `
        <div class="forum-section-card item-clickable" onclick="openFactions('gos', 'Государственные организации')">
            <div class="section-icon">🏛️</div><div class="section-title">Государственные организации</div>
        </div>
        <div class="forum-section-card item-clickable" onclick="openFactions('crime', 'Криминальные структуры')">
            <div class="section-icon">🥷</div><div class="section-title">Криминальные структуры</div>
        </div>
    `;
}

function openFactions(catId, catName) {
    currentCategoryId = catId;
    document.getElementById('current-category-title').innerText = catName;
    showScreen('screen-factions');

    document.getElementById('btn-back-to-categories').onclick = () => openServerCategories(currentServerId);

    // Проверка доступа для создания разделов фракций
    if(auth.currentUser && allUsersDataLocal[auth.currentUser.uid]) {
        const role = allUsersDataLocal[auth.currentUser.uid].role;
        if(ALL_ADMIN_ROLES.includes(role)) {
            document.getElementById('btn-show-create-faction').classList.remove('hidden');
        } else {
            document.getElementById('btn-show-create-faction').classList.add('hidden');
        }
    }

    db.ref(`factions/${currentServerId}/${currentCategoryId}`).on('value', snap => {
        const facList = document.getElementById('factions-list');
        facList.innerHTML = '';
        const data = snap.val();
        if(!data) {
            facList.innerHTML = '<div class="empty-notify">Разделы фракций еще не созданы высшей администрацией.</div>';
            return;
        }
        for(let fId in data) {
            const card = document.createElement('div');
            card.className = 'forum-section-card item-clickable';
            card.innerHTML = `<div class="section-icon">📁</div><div class="section-title">${data[fId].name}</div>`;
            card.onclick = () => openTopicsList(fId, data[fId].name);
            facList.appendChild(card);
        }
    });
}

function toggleFactionForm() {
    document.getElementById('create-faction-form').classList.toggle('hidden');
}

// Позволяет админам создавать фракцию во внутренней базе под сервером
function createNewFaction() {
    const name = document.getElementById('new-faction-name').value.trim();
    if(!name) return alert("Введите имя раздела фракции!");
    
    db.ref(`factions/${currentServerId}/${currentCategoryId}`).push({ name: name }).then(() => {
        document.getElementById('new-faction-name').value = '';
        document.getElementById('create-faction-form').classList.add('hidden');
    });
}

function openTopicsList(factionId, factionName) {
    currentFactionId = factionId;
    document.getElementById('current-faction-title').innerText = factionName;
    showScreen('screen-topics');

    document.getElementById('btn-back-to-factions').onclick = () => openFactions(currentCategoryId, document.getElementById('current-category-title').innerText);

    if (hasEditAccess()) {
        document.getElementById('btn-show-create-topic').classList.remove('hidden');
    } else {
        document.getElementById('btn-show-create-topic').classList.add('hidden');
    }

    db.ref(`topics/${currentServerId}/${currentFactionId}`).on('value', snap => {
        const topicsList = document.getElementById('topics-list');
        topicsList.innerHTML = '';
        const data = snap.val();
        if(!data) {
            topicsList.innerHTML = '<div class="empty-notify">В данном разделе тем ещё нет. Будьте первым!</div>';
            return;
        }
        for(let tId in data) {
            const card = document.createElement('div');
            card.className = 'forum-section-card item-clickable';
            card.innerHTML = `<div class="section-icon">📄</div><div class="section-title">${data[tId].title || data[tId].name}</div>`;
            card.onclick = () => openTopic(tId, false);
            topicsList.appendChild(card);
        }
    });
}

function toggleTopicForm() {
    document.getElementById('create-topic-form').classList.toggle('hidden');
}

function createNewTopic() {
    const title = document.getElementById('new-topic-name').value.trim();
    if(!title) return alert("Введите название темы!");

    db.ref(`topics/${currentServerId}/${currentFactionId}`).push({
        title: title,
        content: "Редактируйте текст темы через встроенный редактор публикации ниже."
    }).then(() => {
        document.getElementById('new-topic-name').value = '';
        document.getElementById('create-topic-form').classList.add('hidden');
    });
}

function openTopic(topicId, isInfoSection = false) {
    currentTopicId = topicId;
    showScreen('screen-view-topic');

    const path = isInfoSection ? `info_sections/${topicId}` : `topics/${currentServerId}/${currentFactionId}/${topicId}`;

    if(hasEditAccess()) {
        document.getElementById('topic-admin-editor-block').classList.remove('hidden');
        document.getElementById('btn-delete-current-topic').classList.remove('hidden');
        document.getElementById('btn-show-create-subtopic').classList.remove('hidden');
    } else {
        document.getElementById('topic-admin-editor-block').classList.add('hidden');
        document.getElementById('btn-delete-current-topic').classList.add('hidden');
        document.getElementById('btn-show-create-subtopic').classList.add('hidden');
    }

    db.ref(path).on('value', snap => {
        const data = snap.val();
        if(!data) return;
        document.getElementById('topic-view-title').innerText = data.title || data.name || "Тема";
        document.getElementById('topic-view-content').innerHTML = data.content || "Текст отсутствует.";
        document.getElementById('editor-rich-content').innerHTML = data.content || "";
    });

    loadSubTopics();
}

function backFromTopicView() {
    document.getElementById('topic-editor-inputs').classList.add('hidden');
    document.getElementById('create-subtopic-form').classList.add('hidden');
    if(currentFactionId) {
        openTopicsList(currentFactionId, document.getElementById('current-faction-title').innerText);
    } else {
        backToHome();
    }
}

function toggleTopicEditor() {
    document.getElementById('topic-editor-inputs').classList.toggle('hidden');
}

// Форматирование для встроенного текстового редактора
function formatText(cmd, val = null) {
    document.execCommand(cmd, false, val);
}

function saveTopicContent() {
    const html = document.getElementById('editor-rich-content').innerHTML;
    const path = currentFactionId ? `topics/${currentServerId}/${currentFactionId}/${currentTopicId}` : `info_sections/${currentTopicId}`;
    
    db.ref(path).update({ content: html }).then(() => {
        alert("Контент темы успешно обновлён!");
        document.getElementById('topic-editor-inputs').classList.add('hidden');
    });
}

function deleteCurrentTopic() {
    if(!confirm("Вы действительно хотите БЕЗВОЗВРАТНО удалить эту тему?")) return;
    const path = currentFactionId ? `topics/${currentServerId}/${currentFactionId}/${currentTopicId}` : `info_sections/${currentTopicId}`;
    
    db.ref(path).remove().then(() => {
        alert("Ветка удалена.");
        backFromTopicView();
    });
}

function loadSubTopics() {
    db.ref(`subtopics/${currentTopicId}`).on('value', snap => {
        const block = document.getElementById('subtopics-block');
        const list = document.getElementById('subtopics-list');
        list.innerHTML = '';
        const data = snap.val();
        if(!data) {
            block.classList.add('hidden');
            return;
        }
        block.classList.remove('hidden');
        for(let id in data) {
            const card = document.createElement('div');
            card.className = 'forum-section-card item-clickable';
            card.style.padding = '10px 15px';
            card.innerHTML = `<div class="section-icon" style="font-size:16px; min-width:30px; height:30px;">📂</div><div class="section-title" style="font-size:14px;">${data[id].title || data[id].name}</div>`;
            card.onclick = () => {
                currentFactionId = ''; 
                openTopic(id, false);
            };
            list.appendChild(card);
        }
    });
}

function toggleSubTopicForm() {
    document.getElementById('create-subtopic-form').classList.toggle('hidden');
}

function createNewSubTopic() {
    const title = document.getElementById('new-subtopic-name').value.trim();
    if(!title) return alert("Введите имя подтемы!");

    const ref = db.ref('info_sections').push();
    const newId = ref.key;

    ref.set({
        title: title,
        content: "Содержимое новой подтемы..."
    }).then(() => {
        db.ref(`subtopics/${currentTopicId}/${newId}`).set({ title: title }).then(() => {
            document.getElementById('new-subtopic-name').value = '';
            document.getElementById('create-subtopic-form').classList.add('hidden');
        });
    });
}

// ==========================================
// 6. ПУБЛИЧНЫЕ ПРОФИЛИ И СТЕНА
// ==========================================
function openPublicProfile(uid) {
    currentProfileUid = uid;
    showScreen('screen-public-profile');
    
    db.ref(`users/${uid}`).on('value', snap => {
        const u = snap.val();
        if(!u) return;

        document.getElementById('public-banner').style.backgroundImage = u.banner ? `url(${u.banner})` : "none";
        document.getElementById('public-avatar').src = u.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
        document.getElementById('public-username').innerText = u.username || "Никнейм";
        document.getElementById('public-bio').innerText = u.bio || "Описание отсутствует.";
        document.getElementById('btn-profile-like').innerText = `❤️ Лайков: ${u.likes || 0}`;

        const dot = document.getElementById('public-online-indicator');
        const txt = document.getElementById('public-online-text');
        if(u.status === 'online') {
            dot.className = 'status-dot status-online';
            txt.innerText = 'В сети';
            txt.style.color = '#10b981';
        } else {
            dot.className = 'status-dot status-offline';
            txt.innerText = 'Не в сети';
            txt.style.color = '#ef4444';
        }

        let roleBadge = document.getElementById('public-role');
        if (u.isLeader) {
            roleBadge.innerHTML = `👑 Лидер ${u.leaderFaction} [${SERVERS_LIST_CONFIG[u.leaderServer] || u.leaderServer}]`;
            roleBadge.style.color = '#fbbf24';
        } else if (u.isSubLeader) {
            roleBadge.innerHTML = `📋 Зам. Лидера ${u.leaderFaction} [${SERVERS_LIST_CONFIG[u.leaderServer] || u.leaderServer}]`;
            roleBadge.style.color = '#60a5fa';
        } else {
            roleBadge.innerHTML = u.role || 'Пользователь';
            // Делаем красивую подсветку для руководства проекта
            if(u.role === "Руководство проекта") {
                roleBadge.style.color = '#60a5fa';
            } else {
                roleBadge.style.color = '#3b82f6';
            }
        }
    });

    loadProfileComments(uid);
}

function toggleProfileLike() {
    if(!auth.currentUser) return alert("Голосовать могут только авторизованные игроки!");
    if(auth.currentUser.uid === currentProfileUid) return alert("Вы не можете ставить лайки самому себе!");

    const likeRef = db.ref(`profile_likes/${currentProfileUid}/${auth.currentUser.uid}`);
    likeRef.once('value', snap => {
        const refUserLikes = db.ref(`users/${currentProfileUid}/likes`);
        if(snap.exists()) {
            likeRef.remove();
            refUserLikes.transaction(c => (c || 1) - 1);
        } else {
            likeRef.set(true);
            refUserLikes.transaction(c => (c || 0) + 1);
        }
    });
}

function sendProfileComment() {
    const text = document.getElementById('new-profile-comment').value.trim();
    if(!text || !auth.currentUser) return alert("Введите текст или войдите в аккаунт!");

    db.ref(`users/${auth.currentUser.uid}/username`).once('value', snap => {
        const senderName = snap.val() || "Аноним";
        db.ref(`profile_comments/${currentProfileUid}`).push({
            senderUid: auth.currentUser.uid,
            senderName: senderName,
            text: text,
            timestamp: firebase.database.ServerValue.TIMESTAMP
        }).then(() => {
            document.getElementById('new-profile-comment').value = '';
        });
    });
}

function loadProfileComments(uid) {
    db.ref(`profile_comments/${uid}`).on('value', snap => {
        const list = document.getElementById('profile-comments-list');
        list.innerHTML = '';
        const data = snap.val();
        if(!data) {
            list.innerHTML = '<div class="empty-notify">На стене пока нет ни одного сообщения. Оставьте первое!</div>';
            return;
        }
        for(let id in data) {
            const item = document.createElement('div');
            item.className = 'stats-item';
            item.style.textAlign = 'left';
            item.style.background = '#141b26';
            item.innerHTML = `
                <div style="font-weight:700; color:var(--primary-color); font-size:14px; cursor:pointer;" onclick="openPublicProfile('${data[id].senderUid}')">👤 ${data[id].senderName}</div>
                <div style="margin-top:5px; font-size:14px; color:#fff; word-break: break-word;">${data[id].text}</div>
            `;
            list.appendChild(item);
        }
    });
}

function openProfileSettings() {
    if(!auth.currentUser) return;
    showScreen('screen-profile-edit');
    db.ref(`users/${auth.currentUser.uid}`).once('value', snap => {
        const data = snap.val();
        if(!data) return;
        document.getElementById('nickname').value = data.username || "";
        document.getElementById('edit-bio').value = data.bio || "";
    });
}

function saveProfileSettings() {
    const user = auth.currentUser;
    if(!user) return;

    const name = document.getElementById('nickname').value.trim();
    const bio = document.getElementById('edit-bio').value.trim();
    const avatarFile = document.getElementById('file-avatar-input').files[0];
    const bannerFile = document.getElementById('file-banner-input').files[0];

    if(!name) return alert("Имя не может быть пустым!");

    document.getElementById('btn-save-profile').innerText = "⏳ Загрузка файлов...";
    
    let updates = { username: name, bio: bio };

    const uploadPromise = (file, type) => {
        if(!file) return Promise.resolve(null);
        const ref = storage.ref(`users_assets/${user.uid}/${type}_${Date.now()}`);
        return ref.put(file).then(() => ref.getDownloadURL());
    };

    Promise.all([uploadPromise(avatarFile, 'avatar'), uploadPromise(bannerFile, 'banner')]).then(([avaUrl, banUrl]) => {
        if(avaUrl) updates.avatar = avaUrl;
        if(banUrl) updates.banner = banUrl;

        db.ref(`users/${user.uid}`).update(updates).then(() => {
            alert("Ваш профиль был успешно обновлён!");
            document.getElementById('btn-save-profile').innerText = "💾 Сохранить изменения";
            openPublicProfile(user.uid);
        });
    }).catch(err => alert("Ошибка хранилища: " + err.message));
}

// ==========================================
// 7. АДМИН-ЦЕНТР И УПРАВЛЕНИЕ ПРАВАМИ
// ==========================================
function renderAdminUsersList(usersData) {
    const container = document.getElementById('admin-users-list'); if (!container) return; container.innerHTML = '';
    const searchVal = document.getElementById('admin-search-user') ? document.getElementById('admin-search-user').value.toLowerCase().trim() : "";
    allUsersDataLocal = usersData;

    for (let uid in usersData) {
        const u = usersData[uid];
        if (searchVal && u.username && !u.username.toLowerCase().includes(searchVal)) continue;

        const card = document.createElement('div'); card.className = 'forum-section-card'; card.style.background = '#1e2530'; card.style.flexDirection = 'column'; card.style.alignItems = 'stretch'; card.style.gap = '15px';
        
        let roleOptionsHtml = '';
        for (let groupName in FORUM_ROLES_GROUPS) {
            roleOptionsHtml += `<optgroup label="📂 ${groupName}">`;
            FORUM_ROLES_GROUPS[groupName].forEach(r => { roleOptionsHtml += `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`; });
            roleOptionsHtml += `</optgroup>`;
        }

        let forumRoleBadge = `<b style="color:#a855f7;">${u.role || 'Пользователь'}</b>`;
        let currentStatusText = `<span style="color: #8a99ad;">Обычный пользователь</span>`;
        
        if (u.isLeader) {
            const serverName = SERVERS_LIST_CONFIG[u.leaderServer] || u.leaderServer;
            forumRoleBadge = `<b style="color: #fbbf24;">👑 Лидер ${u.leaderFaction} (${serverName})</b>`;
            currentStatusText = `<span style="color: #fbbf24; font-weight: bold;">Управление фракцией активно</span>`;
        } else if (u.isSubLeader) {
            const serverName = SERVERS_LIST_CONFIG[u.leaderServer] || u.leaderServer;
            forumRoleBadge = `<b style="color: #60a5fa;">📋 Зам. Лидера ${u.leaderFaction} (${serverName})</b>`;
            currentStatusText = `<span style="color: #60a5fa; font-weight: bold;">Управление фракцией активно</span>`;
        } else if (u.role === "Руководство проекта") {
            forumRoleBadge = `<b style="color: #60a5fa;">🛡️ Руководство проекта</b>`;
        }
        
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; justify-content:space-between; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${u.avatar || 'https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png'}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
                    <div>
                        <div style="font-weight:600; color:#fff; font-size:15px; cursor:pointer;" onclick="openPublicProfile('${uid}')">${u.username} ${u.isBanned ? '<span style="color:#ef4444;">[БАН]</span>' : ''}</div>
                        <div style="font-size:12px; color:#8a99ad;">Ранг на форуме: ${forumRoleBadge}</div>
                        <div style="font-size:12px; margin-top: 3px; color: #8a99ad;">Статус прав: ${currentStatusText}</div>
                    </div>
                </div>
                <div style="display:flex; gap:8px; flex-wrap: wrap;">
                    <select onchange="updateUserRole('${uid}', this.value)" style="background:#12171f; color:#fff; border:1px solid #475569; padding:6px; border-radius:4px; font-size:12px;">${roleOptionsHtml}</select>
                    <button class="btn-primary" onclick="startAssignLeader('${uid}', '${u.username}')" style="background:#2563eb; font-size:12px; padding:6px 12px;">👑 Назначить Руководителем</button>
                    ${(u.isLeader || u.isSubLeader) ? `<button class="btn-primary" onclick="removeLeaderRights('${uid}')" style="background:#b91c1c; font-size:12px; padding:6px 12px;">Снять права</button>` : ''}
                    <button class="btn-primary" onclick="toggleUserBan('${uid}', ${u.isBanned || false})" style="background:${u.isBanned ? '#10b981' : '#7f1d1d'}; font-size:12px; padding:6px 12px;">${u.isBanned ? 'Разбанить' : 'Забанить'}</button>
                </div>
            </div>
            
            <div id="assign-block-${uid}" class="hidden" style="background: #111827; padding: 15px; border-radius: 6px; border: 1px solid #3b82f6; margin-top: 10px;">
                <h4 style="color: #3b82f6; margin-bottom: 10px; font-size: 14px;">Настройка прав управления для ${u.username}:</h4>
                <div style="display: flex; flex-direction: column; gap: 12px;">
                    <div>
                        <label style="color: #cbd5e1; font-size: 12px; display:block; margin-bottom:4px;">1. Выберите сервер:</label>
                        <select id="assign-server-${uid}" style="background:#1f2937; color:#fff; border:1px solid #4b5563; padding:6px; border-radius:4px; width:100%;">
                            <option value="">-- Выберите сервер из списка --</option>
                            ${Object.keys(SERVERS_LIST_CONFIG).map(sId => `<option value="${sId}">${SERVERS_LIST_CONFIG[sId]}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="color: #cbd5e1; font-size: 12px; display:block; margin-bottom:4px;">2. Выберите должность:</label>
                        <select id="assign-type-${uid}" style="background:#1f2937; color:#fff; border:1px solid #4b5563; padding:6px; border-radius:4px; width:100%;">
                            <option value="leader">👑 Лидер организации</option>
                            <option value="subleader">📋 Заместитель лидера</option>
                        </select>
                    </div>
                    <div>
                        <label style="color: #cbd5e1; font-size: 12px; display:block; margin-bottom:4px;">3. Выберите государственную / криминальную фракцию:</label>
                        <select id="assign-faction-${uid}" style="background:#1f2937; color:#fff; border:1px solid #4b5563; padding:6px; border-radius:4px; width:100%;">
                            <option value="">-- Выберите фракцию из списка --</option>
                            ${LEADER_FACTIONS_LIST.map(fac => `<option value="${fac}">${fac}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:flex; gap: 10px; margin-top: 5px;">
                        <button class="btn-primary" onclick="confirmLeaderAssignment('${uid}')" style="background:#10b981; padding: 8px 16px; width: 100%; font-weight:bold;">✅ Подтвердить назначение</button>
                        <button class="btn-primary" onclick="cancelLeaderAssignment('${uid}')" style="background:#4b5563; padding: 8px 16px;">Отмена</button>
                    </div>
                </div>
            </div>
        `;
        container.appendChild(card);
    }
}

function startAssignLeader(uid, username) {
    document.querySelectorAll('[id^="assign-block-"]').forEach(b => b.classList.add('hidden'));
    const targetBlock = document.getElementById(`assign-block-${uid}`);
    if (targetBlock) targetBlock.classList.remove('hidden');
}

function cancelLeaderAssignment(uid) {
    const targetBlock = document.getElementById(`assign-block-${uid}`);
    if (targetBlock) targetBlock.classList.add('hidden');
}

function confirmLeaderAssignment(uid) {
    const server = document.getElementById(`assign-server-${uid}`).value;
    const type = document.getElementById(`assign-type-${uid}`).value;
    const faction = document.getElementById(`assign-faction-${uid}`).value;

    if (!server) return alert("Пожалуйста, выберите сервер на Шаге 1!");
    if (!faction) return alert("Пожалуйста, выберите фракцию на Шаге 3!");

    const isLeaderRole = (type === 'leader');
    
    db.ref(`users/${uid}`).update({
        isLeader: isLeaderRole,
        isSubLeader: !isLeaderRole,
        leaderServer: server,
        leaderFaction: faction
    }).then(() => {
        alert("Права управления успешно обновлены!");
        cancelLeaderAssignment(uid);
    }).catch(err => alert("Ошибка: " + err.message));
}

function removeLeaderRights(uid) {
    if (!confirm("Вы уверены, что хотите снять права руководителя?")) return;
    db.ref(`users/${uid}`).update({
        isLeader: false,
        isSubLeader: false,
        leaderServer: null,
        leaderFaction: null
    }).then(() => alert("Права сняты."));
}

function updateUserRole(uid, newRole) {
    db.ref(`users/${uid}/role`).set(newRole);
}

function toggleUserBan(uid, currentBanStatus) {
    db.ref(`users/${uid}/isBanned`).set(!currentBanStatus);
}

// Фильтр поиска по никнейму
function filterAdminUsers() {
    renderAdminUsersList(allUsersDataLocal);
}

function openAdminPanel() {
    showScreen('screen-admin');
    db.ref('users').on('value', snap => {
        renderAdminUsersList(snap.val() || {});
    });
}

// ==========================================
// 8. СЛУШАТЕЛИ FIREBASE AUTH И ПЕРВИЧНЫЙ ЗАПУСК
// ==========================================
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('auth-buttons').classList.add('hidden');
        document.getElementById('user-menu').classList.remove('hidden');
        
        db.ref(`users/${user.uid}`).on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                if (data.isBanned) {
                    alert("Ваш аккаунт заблокирован на форуме!");
                    auth.signOut();
                    return;
                }
                document.getElementById('header-username').innerText = data.username || "Без никнейма";
                document.getElementById('header-avatar').src = data.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
                
                // Проверяем роль на доступ к кнопке "Админ-центр"
                if (ALL_ADMIN_ROLES.includes(data.role)) {
                    document.getElementById('btn-admin-panel').classList.remove('hidden');
                    document.getElementById('btn-profile-edit').classList.remove('hidden');
                } else {
                    document.getElementById('btn-admin-panel').classList.add('hidden');
                    document.getElementById('btn-profile-edit').classList.remove('hidden');
                }
            }
        });
        updateOnlineStatus(true);
    } else {
        document.getElementById('auth-buttons').classList.remove('hidden');
        document.getElementById('user-menu').classList.add('hidden');
        document.getElementById('btn-admin-panel').classList.add('hidden');
        document.getElementById('btn-profile-edit').classList.add('hidden');
    }
});

window.addEventListener('beforeunload', () => {
    updateOnlineStatus(false);
});

// Первичный запуск функций
loadForumData();
