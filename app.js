// ==========================================
// 0. КОНФИГУРАЦИЯ И ИНИЦИАЛИЗАЦИЯ FIREBASE
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

// ГРУППИРОВКА РОЛЕЙ
const FORUM_ROLES_GROUPS = {
    "Пользователи": ["Пользователь"],
    "Высшая Администрация": ["Руководство проекта", "Спец. Админ", "Главный админ", "Главный admina", "Заместитель главного admina", "Главный куратор", "Помощник главного куратора"],
    "Аппарат Президента": ["Президент РФ", "Полномочный представитель президента РФ"],
    "Органы Контроля и Суда": ["Генеральный прокурор РФ", "Председатель Верховного суда РФ"],
    "Министерство Обороны": ["Министр обороны", "Заместитель министра обороны"],
    "Министерство Внутренних Дел": ["Министр Внутренних дел", "Заместитель министра Внутренних дел"],
    "Министерство Юстиции": ["Министр Юстиции", "Заместитель министра Юстиции"],
    "Министерство Соц. Политики": ["Министр социальной политики и труда", "Заместитель министра социальной политики и труда"]
};

const LEADER_FACTIONS_LIST = [
    "Судебная Власть", "Прокуратура", "Следственный комитет", "Правительство",
    "Федеральная служба безопасности", "Армия", "МВД", "ГИБДД",
    "Федеральная служба исполнения наказаний", "Федеральная служба охраны", "Росгвардия",
    "Центральная городская больница 7", "Центральная городская больница 3",
    "Центр организации дорожного движение", "Москва LIVE"
];

const SERVERS_LIST_CONFIG = {
    "server1": "🏰 Москва",
    "server2": "🌴 Сочи",
    "server3": "⚓ Санкт-Петербург"
};

let currentServerId = null;
let currentCategoryId = null;
let currentFactionId = null;
let currentTopicId = null;
let currentUserData = null;

// ==========================================
// СУПЕР-ПРАВА И ДОСТУПЫ С УЧЕТОМ СЕРВЕРА
// ==========================================
function hasEditAccess() {
    if (!currentUserData) return false;
    const role = currentUserData.role;
    
    const superRoles = [
        "Руководство проекта", "Спец. Admin", "Спец. Админ", "Главный admina", "Главный админ",
        "Заместитель главного admina", "Главный куратор", "Помощник главного куратора", 
        "Президент РФ", "Полномочный представитель президента РФ"
    ];
    if (superRoles.includes(role)) return true;
    if (currentServerId === "info") return false;
    
    const currentFactionName = document.getElementById('current-faction-title') ? document.getElementById('current-faction-title').innerText.trim() : "";
    if (!currentFactionName) return false;

    if (role === "Председатель Верховного суда РФ") return currentFactionName.includes("Судебная Власть");
    if (role === "Генеральный прокурор РФ") return (currentFactionName.includes("Прокуратура") || currentFactionName.includes("Следственный комитет"));
    if (role === "Министр обороны" || role === "Заместитель министра обороны") return currentFactionName === "Армия";
    
    if (role === "Министр Внутренних дел" || role === "Заместитель министра Внутренних дел") return ["МВД", "ГИБДД", "Росгвардия"].includes(currentFactionName);
    if (role === "Министр Юстиции" || role === "Заместитель министра Юстиции") return ["Федеральная служба исполнения наказаний", "Федеральная служба охраны"].includes(currentFactionName);
    if (role === "Министр социальной политики и труда" || role === "Заместитель министра социальной политики и труда") return ["Центральная городская больница 7", "Центральная городская больница 3", "Центр организации дорожного движение"].includes(currentFactionName);
    
    if (currentUserData.isLeader || currentUserData.isSubLeader) {
        const leaderServer = currentUserData.leaderServer || "";
        const leaderFaction = currentUserData.leaderFaction ? currentUserData.leaderFaction.trim() : "";
        return (currentServerId === leaderServer && currentFactionName === leaderFaction);
    }
    return false;
}

// ==========================================
// СЛУШАТЕЛЬ АВТОРИЗАЦИИ И СИСТЕМЫ ОНЛАЙНА
// ==========================================
auth.onAuthStateChanged(user => {
    const btnAdmin = document.getElementById('btn-admin-panel');
    const btnProfile = document.getElementById('btn-profile-edit');
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    
    if (user) {
        // Устанавливаем статус Онлайн в БД
        const userStatusRef = db.ref(`users/${user.uid}/status`);
        userStatusRef.set("online");
        // Если вкладка закроется — автоматически выставим offline
        userStatusRef.onDisconnect().set("offline");

        db.ref('users/' + user.uid).on('value', snapshot => {
            currentUserData = snapshot.val();
            if (!currentUserData) return;
            currentUserData.uid = user.uid;
            
            if (currentUserData.isBanned) {
                alert("Вы забанены на данном форуме!");
                auth.signOut();
                return;
            }
            
            if (authButtons) authButtons.style.display = 'none'; 
            if (userMenu) userMenu.classList.remove('hidden');
            if (btnProfile) btnProfile.classList.remove('hidden');
            
            if (document.getElementById('header-username')) document.getElementById('header-username').innerText = currentUserData.username || "Никнейм";
            if (document.getElementById('header-avatar')) document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            
            if (btnAdmin) {
                const allowedToAdmin = ["Руководство проекта", "Спец. Админ", "Главный admina", "Главный админ", "Заместитель главного admina", "Главный куратор"];
                if (allowedToAdmin.includes(currentUserData.role)) btnAdmin.classList.remove('hidden');
                else btnAdmin.classList.add('hidden');
            }
            updateActionButtonsVisibility();
        });
    } else {
        currentUserData = null;
        if (authButtons) authButtons.style.display = 'flex'; 
        if (userMenu) userMenu.classList.add('hidden');
        if (btnProfile) btnProfile.classList.add('hidden');
        if (btnAdmin) btnAdmin.classList.add('hidden');
        updateActionButtonsVisibility();
    }
});

// ==========================================
// ГИБКАЯ НАСТРОЙКА ПРОФИЛЯ С ПРОВОДНИКОМ
// ==========================================
function openProfileSettings() {
    if (!currentUserData) return alert("Вы должны быть авторизованы!");
    showScreen('screen-profile-edit');
    
    document.getElementById('edit-username').value = currentUserData.username || "";
    document.getElementById('edit-bio').value = currentUserData.bio || "";
    document.getElementById('file-avatar-input').value = "";
    document.getElementById('file-banner-input').value = "";
}

async function saveProfileSettings() {
    if (!auth.currentUser) return alert("Ошибка сессии!");
    
    const btnSave = document.getElementById('btn-save-profile');
    const newUsername = document.getElementById('edit-username').value.trim();
    const newBio = document.getElementById('edit-bio').value.trim();
    const avatarFile = document.getElementById('file-avatar-input').files[0];
    const bannerFile = document.getElementById('file-banner-input').files[0];

    if (!newUsername || !newUsername.lenght < 3) {
        return alert("Никнейм должен быть более 3 символов");
    }

    btnSave.innerText = "⏳ Сохранение...";
    btnSave.disabled = true;

    try {
        let avatarUrl = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
        let bannerUrl = currentUserData.banner || "";

        // Загрузка аватарки из проводника
        if (avatarFile) {
            const avatarRef = storage.ref(`avatars/${auth.currentUser.uid}_${Date.now()}`);
            await avatarRef.put(avatarFile);
            avatarUrl = await avatarRef.getDownloadURL();
        }

        // Загрузка баннера из проводника
        if (bannerFile) {
            const bannerRef = storage.ref(`banners/${auth.currentUser.uid}_${Date.now()}`);
            await bannerRef.put(bannerFile);
            bannerUrl = await bannerRef.getDownloadURL();
        }

        // Обновление всей карточки в Realtime DB
        await db.ref('users/' + auth.currentUser.uid).update({
            username: newUsername,
            bio: newBio,
            avatar: avatarUrl,
            banner: bannerUrl
        });

       showNotification("Никнейм успешно изменен!");
        showScreen('screen-forum');
    } catch (error) {
        alert("Произошла ошибка при загрузке: " + error.message);
    } finally {
        btnSave.innerText = "💾 Сохранить изменения";
        btnSave.disabled = false;
    }
}

// ==========================================
// СИСТЕМА ГЛОБАЛЬНОЙ СТАТИСТИКИ
// ==========================================
db.ref('users').on('value', snapshot => {
    const users = snapshot.val();
    if (!users) return;

    let onlineCount = 0;
    let usersArray = [];

    for (let uid in users) {
        if (users[uid].status === "online") onlineCount++;
        usersArray.push({ uid: uid, ...users[uid] });
    }

    // Выводим счетчик текущего онлайна
    if (document.getElementById('stats-online-count')) {
        document.getElementById('stats-online-count').innerText = `${onlineCount} чел.`;
    }

    // Сортируем по временной метке регистрации, чтобы найти первого и последнего
    usersArray.sort((a, b) => (a.registeredAt || 0) - (b.registeredAt || 0));

    if (usersArray.length > 0) {
        const firstUser = usersArray[0];
        const lastUser = usersArray[usersArray.length - 1];

        const firstEl = document.getElementById('stats-first-user');
        const lastEl = document.getElementById('stats-last-user');

        if (firstEl) {
            firstEl.innerText = firstUser.username;
            firstEl.onclick = () => openPublicProfile(firstUser.uid);
        }
        if (lastEl) {
            lastEl.innerText = lastUser.username;
            lastEl.onclick = () => openPublicProfile(lastUser.uid);
        }
    }
});

// ==========================================
// ПРОСМОТР ЧУЖИХ ПРОФИЛЕЙ ПОЛЬЗОВАТЕЛЕЙ
// ==========================================
let viewTargetUid = null;
function openPublicProfile(uid) {
    viewTargetUid = uid;
    showScreen('screen-public-profile');
    
    db.ref('users/' + uid).on('value', snapshot => {
        const user = snapshot.val(); 
        if (!user) return;

        document.getElementById('public-username').innerText = user.username || "Профиль";
        document.getElementById('public-avatar').src = user.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
        document.getElementById('public-bio').innerText = user.bio || "Описание профиля не заполнено.";
        
        let displayRole = user.role || "Пользователь";
        if (user.isLeader) displayRole += " [Лидер]";
        if (user.isSubLeader) displayRole += " [Заместитель]";
        document.getElementById('public-role').innerText = displayRole;
        
        const bannerEl = document.getElementById('public-banner');
        if (bannerEl) bannerEl.style.backgroundImage = user.banner ? `url('${user.banner}')` : 'none';
        document.getElementById('btn-profile-like').innerText = `❤️ Лайков: ${user.likes || 0}`;

        // Живой статус онлайна в чужом профиле
        const dot = document.getElementById('public-online-indicator');
        const txt = document.getElementById('public-online-text');
        if (user.status === "online") {
            dot.className = "status-dot status-online";
            txt.innerText = "В сети";
            txt.style.color = "var(--success-color)";
        } else {
            dot.className = "status-dot status-offline";
            txt.innerText = "Не в сети";
            txt.style.color = "var(--danger-color)";
        }
    });
    loadProfileComments();
}

// ==========================================
// ВСЕ ОСТАЛЬНЫЕ СТАНДАРТНЫЕ ФУНКЦИИ ФОРУМА
// ==========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function updateActionButtonsVisibility() {
    const hasAccess = hasEditAccess();
    const isHighAdmin = currentUserData && ["Руководство проекта", "Спец. Админ", "Главный admina", "Главный админ"].includes(currentUserData.role);
    
    const btnCreateFaction = document.getElementById('btn-show-create-faction');
    const btnCreateTopic = document.getElementById('btn-show-create-topic');
    const btnCreateSubtopic = document.getElementById('btn-show-create-subtopic');
    const adminEditorBlock = document.getElementById('topic-admin-editor-block');
    const btnDeleteTopic = document.getElementById('btn-delete-current-topic');
    
    if (btnCreateFaction) isHighAdmin ? btnCreateFaction.classList.remove('hidden') : btnCreateFaction.classList.add('hidden');
    if (btnCreateTopic) hasAccess ? btnCreateTopic.classList.remove('hidden') : btnCreateTopic.classList.add('hidden');
    if (btnCreateSubtopic) hasAccess ? btnCreateSubtopic.classList.remove('hidden') : btnCreateSubtopic.classList.add('hidden');
    if (adminEditorBlock) hasAccess ? adminEditorBlock.classList.remove('hidden') : adminEditorBlock.classList.add('hidden');
    if (btnDeleteTopic) hasAccess ? btnDeleteTopic.classList.remove('hidden') : btnDeleteTopic.classList.add('hidden');
}

document.addEventListener("DOMContentLoaded", () => {
    loadInfoSections();
    loadServers();
});

function loadInfoSections() {
    const container = document.getElementById('info-sections-list'); if (!container) return;
    db.ref('info_sections').on('value', snapshot => {
        container.innerHTML = ''; const data = snapshot.val();
        if (!data) { db.ref('info_sections').set({"rules": { name: "📜 Правила сервера" }, "laws": { name: "⚖️ Законодательство" }}); return; }
        for (let id in data) {
            const sec = data[id]; const div = document.createElement('div'); div.className = 'forum-section-card item-clickable'; 
            div.innerHTML = `<div class="section-icon">📌</div><div class="section-info"><div class="section-title">${sec.name}</div></div>`;
            div.onclick = () => { currentServerId = "info"; currentCategoryId = "info"; currentFactionId = id; openFactionScreen(sec.name); };
            container.appendChild(div);
        }
    });
}

function loadServers() {
    const container = document.getElementById('servers-list'); if (!container) return;
    db.ref('servers').on('value', snapshot => {
        container.innerHTML = ''; const data = snapshot.val();
        if (!data) { db.ref('servers').set({"server1": { name: "🏰 Москва" }, "server2": { name: "🌴 Сочи" }, "server3": { name: "⚓ Санкт-Петербург" }}); return; }
        for (let id in data) {
            const server = data[id]; const div = document.createElement('div'); div.className = 'forum-section-card item-clickable'; 
            div.innerHTML = `<div class="section-icon">🌍</div><div class="section-info"><div class="section-title">${server.name}</div></div>`;
            div.onclick = () => openServerCategories(id, server.name);
            container.appendChild(div);
        }
    });
}

function openServerCategories(serverId, serverName) {
    currentServerId = serverId;
    if (document.getElementById('current-server-title')) document.getElementById('current-server-title').innerText = serverName;
    const container = document.getElementById('categories-list'); container.innerHTML = '';
    const categories = [
        { id: 'gov', name: '🏢 Государственные организации', icon: '💼' },
        { id: 'crime', name: '🥷 Криминальные организации', icon: '🔪' },
        { id: 'civil', name: '👥 Гражданский раздел', icon: '💬' }
    ];
    categories.forEach(cat => {
        const div = document.createElement('div'); div.className = 'forum-section-card item-clickable';
        div.innerHTML = `<div class="section-icon">${cat.icon}</div><div class="section-info"><div class="section-title">${cat.name}</div></div>`;
        div.onclick = () => openCategoryFactions(cat.id, cat.name);
        container.appendChild(div);
    });
    showScreen('screen-categories');
}

function openCategoryFactions(catId, catName) {
    currentCategoryId = catId;
    if (document.getElementById('current-category-title')) document.getElementById('current-category-title').innerText = catName;
    if (document.getElementById('btn-back-to-categories')) document.getElementById('btn-back-to-categories').onclick = () => showScreen('screen-categories');
    document.getElementById('create-faction-form').classList.add('hidden');
    updateActionButtonsVisibility(); loadFactions(); showScreen('screen-factions');
}

function loadFactions() {
    const container = document.getElementById('factions-list'); if (!container) return;
    db.ref(`factions/${currentServerId}/${currentCategoryId}`).on('value', snapshot => {
        container.innerHTML = ''; const data = snapshot.val();
        if (!data) { container.innerHTML = '<p class="empty-notify">Разделов / организаций нет.</p>'; return; }
        for (let id in data) {
            const fac = data[id]; const div = document.createElement('div'); div.className = 'forum-section-card item-clickable';
            div.innerHTML = `<div class="section-icon">📂</div><div class="section-info"><div class="section-title">${fac.name}</div></div>`;
            div.onclick = () => { currentFactionId = id; openFactionScreen(fac.name); };
            container.appendChild(div);
        }
    });
}

function toggleFactionForm() { document.getElementById('create-faction-form').classList.toggle('hidden'); }
function createNewFaction() {
    const input = document.getElementById('new-faction-name'); const name = input.value.trim(); if (!name) return alert("Введите название фракции!");
    db.ref(`factions/${currentServerId}/${currentCategoryId}`).push({ name: name }).then(() => { input.value = ''; document.getElementById('create-faction-form').classList.add('hidden'); });
}

function openFactionScreen(factionName) {
    if (document.getElementById('current-faction-title')) document.getElementById('current-faction-title').innerText = factionName;
    if (document.getElementById('btn-back-to-factions')) document.getElementById('btn-back-to-factions').onclick = () => currentServerId === "info" ? showScreen('screen-forum') : showScreen('screen-factions');
    document.getElementById('create-topic-form').classList.add('hidden');
    updateActionButtonsVisibility(); loadTopics(); showScreen('screen-topics');
}

function loadTopics() {
    const container = document.getElementById('topics-list'); if (!container) return;
    db.ref(`topics/${currentServerId}/${currentCategoryId}/${currentFactionId}`).on('value', snapshot => {
        container.innerHTML = ''; const data = snapshot.val();
        if (!data) { container.innerHTML = '<p class="empty-notify">В данном разделе тем еще нет.</p>'; return; }
        for (let id in data) {
            const topic = data[id]; const div = document.createElement('div'); div.className = 'forum-section-card item-clickable';
            div.innerHTML = `<div class="section-icon">📌</div><div class="section-info" style="flex-grow: 1;"><div class="section-title">${topic.name}</div></div>`;
            if (hasEditAccess()) {
                const btnDel = document.createElement('button'); btnDel.innerText = '❌'; btnDel.style.background = 'none'; btnDel.style.border = 'none'; btnDel.style.cursor = 'pointer';
                btnDel.onclick = (e) => { e.stopPropagation(); deleteTopic(id); }; div.appendChild(btnDel);
            }
            div.onclick = () => openTopicView(id, topic.name); container.appendChild(div);
        }
    });
}

function toggleTopicForm() { document.getElementById('create-topic-form').classList.toggle('hidden'); }
function createNewTopic() {
    const input = document.getElementById('new-topic-name'); const name = input.value.trim(); if (!name) return alert("Название темы пустое!");
    db.ref(`topics/${currentServerId}/${currentCategoryId}/${currentFactionId}`).push({ name: name, content: "Контент темы пуст." }).then(() => { input.value = ''; document.getElementById('create-topic-form').classList.add('hidden'); });
}

function deleteTopic(id) {
    if (!confirm("Удалить тему?")) return;
    db.ref(`topics/${currentServerId}/${currentCategoryId}/${currentFactionId}/${id}`).remove();
    db.ref(`subtopics/${id}`).remove();
}

function deleteCurrentTopic() {
    if (!currentTopicId) return; if (!confirm("Удалить ветку?")) return;
    db.ref(`topics/${currentServerId}/${currentCategoryId}/${currentFactionId}/${currentTopicId}`).remove();
    db.ref(`subtopics/${currentTopicId}`).remove().then(() => backFromTopicView());
}

function openTopicView(topicId, topicName) {
    currentTopicId = topicId;
    if (document.getElementById('topic-view-title')) document.getElementById('topic-view-title').innerText = topicName;
    document.getElementById('create-subtopic-form').classList.add('hidden');
    document.getElementById('topic-editor-inputs').classList.add('hidden');
    updateActionButtonsVisibility();
    db.ref(`topics/${currentServerId}/${currentCategoryId}/${currentFactionId}/${currentTopicId}`).on('value', snapshot => {
        const topic = snapshot.val(); if (!topic) return;
        if (document.getElementById('topic-view-content')) document.getElementById('topic-view-content').innerHTML = topic.content || "Нет содержимого";
        if (document.getElementById('editor-rich-content')) document.getElementById('editor-rich-content').innerHTML = topic.content || "";
    });
    loadSubTopics(); showScreen('screen-view-topic');
}

function backFromTopicView() { showScreen('screen-topics'); }
function toggleSubTopicForm() { document.getElementById('create-subtopic-form').classList.toggle('hidden'); }
function createNewSubTopic() {
    const input = document.getElementById('new-subtopic-name'); const name = input.value.trim(); if (!name) return alert("Заполните имя!");
    db.ref(`subtopics/${currentTopicId}`).push({ name: name, content: "Контент подраздела пуст." }).then(() => { input.value = ''; document.getElementById('create-subtopic-form').classList.add('hidden'); });
}

function loadSubTopics() {
    const block = document.getElementById('subtopics-block'); const container = document.getElementById('subtopics-list'); if (!block || !container) return;
    db.ref(`subtopics/${currentTopicId}`).on('value', snapshot => {
        container.innerHTML = ''; const data = snapshot.val(); if (!data) { block.classList.add('hidden'); return; }
        block.classList.remove('hidden');
        for (let id in data) {
            if(id === "content") continue;
            const sub = data[id]; const div = document.createElement('div'); div.className = 'forum-section-card item-clickable'; div.style.background = '#1a202c';
            div.innerHTML = `<div class="section-icon">📁</div><div class="section-info" style="flex-grow:1;"><div class="section-title" style="color:#60a5fa;">${sub.name}</div></div>`;
            if (hasEditAccess()) {
                const btnDelSub = document.createElement('button'); btnDelSub.innerText = '❌'; btnDelSub.style.background = 'none'; btnDelSub.style.border = 'none'; btnDelSub.style.cursor = 'pointer';
                btnDelSub.onclick = (e) => { e.stopPropagation(); if (confirm("Удалить подтему?")) db.ref(`subtopics/${currentTopicId}/${id}`).remove(); }; div.appendChild(btnDelSub);
            }
            div.onclick = () => openTopicView(id, sub.name); container.appendChild(div);
        }
    });
}

function toggleTopicEditor() { document.getElementById('topic-editor-inputs').classList.toggle('hidden'); }
function formatText(command, value = null) { document.execCommand(command, false, value); }
function saveTopicContent() {
    const richContent = document.getElementById('editor-rich-content').innerHTML;
    db.ref(`subtopics/${currentTopicId}`).once('value', snapshot => {
        if (snapshot.exists()) {
            db.ref(`subtopics/${currentTopicId}/content`).set(richContent).then(() => { alert("Контент подтемы сохранен!"); toggleTopicEditor(); });
        } else {
            db.ref(`topics/${currentServerId}/${currentCategoryId}/${currentFactionId}/${currentTopicId}/content`).set(richContent).then(() => { alert("Контент темы сохранен!"); toggleTopicEditor(); });
        }
    });
}

function registerUser() {
    const usernameInput = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    if (!usernameInput || !email || !password) return alert("Заполните все поля!");
    if (!usernameInput.length < 3) return alert("Формат должен быть Nick!");
    auth.createUserWithEmailAndPassword(email, password).then(cred => {
        return db.ref('users/' + cred.user.uid).set({
            username: usernameInput, email: email, role: "Пользователь", isLeader: false, isSubLeader: false,
            leaderFaction: "", leaderServer: "", avatar: "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png", banner: "", isBanned: false, likes: 0, bio: "", status: "online", registeredAt: firebase.database.ServerValue.TIMESTAMP
        });
    }).then(() => { alert("Успешно!"); showScreen('screen-forum'); }).catch(err => alert(err.message));
}

function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    if (!email || !password) return alert("Заполните поля!");
    auth.signInWithEmailAndPassword(email, password).then(cred => {
        db.ref(`users/${cred.user.uid}/status`).set("online");
        alert("Успешно вошли!"); showScreen('screen-forum');
    }).catch(err => alert(err.message));
}

function logout() {
    if (auth.currentUser) db.ref(`users/${auth.currentUser.uid}/status`).set("offline");
    auth.signOut().then(() => showScreen('screen-forum'));
}

function toggleProfileLike() {
    if (!auth.currentUser) return alert("Войдите на форум!"); if (auth.currentUser.uid === viewTargetUid) return alert("Нельзя лайкать себя!");
    const likeRef = db.ref(`profile_likes/${viewTargetUid}/${auth.currentUser.uid}`);
    const userLikesRef = db.ref(`users/${viewTargetUid}/likes`);
    likeRef.once('value', snapshot => {
        userLikesRef.transaction(currentLikes => {
            if (snapshot.exists()) { likeRef.remove(); return (currentLikes || 1) - 1; } 
            else { likeRef.set(true); return (currentLikes || 0) + 1; }
        });
    });
}

function sendProfileComment() {
    if (!auth.currentUser) return alert("Авторизуйтесь!");
    const textInput = document.getElementById('new-profile-comment'); const text = textInput.value.trim(); if (!text) return alert("Текст пуст!");
    db.ref(`profile_walls/${viewTargetUid}`).push({
        senderUid: auth.currentUser.uid, senderName: currentUserData.username || "Аноним",
        senderAvatar: currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png", text: text, timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => { textInput.value = ''; });
}

function loadProfileComments() {
    const container = document.getElementById('profile-comments-list'); if (!container) return;
    db.ref(`profile_walls/${viewTargetUid}`).on('value', snapshot => {
        container.innerHTML = ''; const data = snapshot.val();
        if (!data) { container.innerHTML = '<p class="empty-notify">На стене еще нет записей.</p>'; return; }
        Object.keys(data).reverse().forEach(key => {
            const comm = data[key]; const div = document.createElement('div'); div.className = 'forum-section-card'; div.style.background = '#12171f';
            div.innerHTML = `
                <img src="${comm.senderAvatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <div style="flex-grow:1;">
                    <div style="display:flex; justify-content:space-between;">
                        <span style="font-weight:600; color:#60a5fa; cursor:pointer;" onclick="openPublicProfile('${comm.senderUid}')">${comm.senderName}</span>
                        <button class="btn-logout" style="padding:2px 8px; font-size:11px; background:rgba(239,68,68,0.1); color:#ef4444; border:none; display:none;" id="del-comm-${key}">Удалить</button>
                    </div>
                    <p style="color:#cbd5e1; font-size:14px; white-space:pre-wrap; margin-top:5px;">${comm.text}</p>
                </div>`;
            container.appendChild(div);
            const delBtn = document.getElementById(`del-comm-${key}`);
            if (delBtn && currentUserData && (auth.currentUser.uid === viewTargetUid || currentUserData.role === "Руководство проекта")) {
                delBtn.style.display = 'block'; delBtn.onclick = () => { if (confirm("Удалить?")) db.ref(`profile_walls/${viewTargetUid}/${key}`).remove(); };
            }
        });
    });
}

// АДМИН-ЦЕНТР
let allUsersCache = {};
function openAdminPanel() {
    const allowed = ["Руководство проекта", "Спец. Админ", "Главный admina", "Главный админ", "Заместитель главного admina", "Главный куратор"];
    if (!currentUserData || !allowed.includes(currentUserData.role)) return alert("Доступ запрещен!");
    showScreen('screen-admin'); loadAdminUsers();
}
function loadAdminUsers() { db.ref('users').on('value', snapshot => { allUsersCache = snapshot.val() || {}; renderAdminUsersList(allUsersCache); }); }
function renderAdminUsersList(usersData) {
    const container = document.getElementById('admin-users-list'); container.innerHTML = '';
    for (let uid in usersData) {
        const u = usersData[uid]; const card = document.createElement('div'); card.className = 'forum-section-card'; card.style.background = '#1e2530'; card.style.flexDirection = 'column'; card.style.alignItems = 'stretch'; card.style.gap = '15px';
        let roleOptionsHtml = '';
        for (let groupName in FORUM_ROLES_GROUPS) {
            roleOptionsHtml += `<optgroup label="📂 ${groupName}">`;
            FORUM_ROLES_GROUPS[groupName].forEach(r => { roleOptionsHtml += `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`; });
            roleOptionsHtml += `</optgroup>`;
        }
        let factionOptionsHtml = `<option value="">-- Без фракции --</option>`;
        LEADER_FACTIONS_LIST.forEach(f => { factionOptionsHtml += `<option value="${f}" ${u.leaderFaction === f ? 'selected' : ''}>${f}</option>`; });
        let serverOptionsHtml = `<option value="">-- Без сервера --</option>`;
        for (let sId in SERVERS_LIST_CONFIG) { serverOptionsHtml += `<option value="${sId}" ${u.leaderServer === sId ? 'selected' : ''}>${SERVERS_LIST_CONFIG[sId]}</option>`; }
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; justify-content:space-between; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${u.avatar || 'https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png'}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
                    <div>
                        <div style="font-weight:600; color:#fff; font-size:15px; cursor:pointer;" onclick="openPublicProfile('${uid}')">${u.username} ${u.isBanned ? '<span style="color:#ef4444;">[БАН]</span>' : ''}</div>
                        <div style="font-size:12px; color:#8a99ad;">Роль: <b style="color:#60a5fa;">${u.role || 'Пользователь'}</b></div>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <select onchange="updateUserRole('${uid}', this.value)" style="background:#12171f; color:#fff; border:1px solid #475569; padding:6px; border-radius:4px; font-size:12px;">${roleOptionsHtml}</select>
                    <button class="btn-primary" onclick="toggleUserBan('${uid}', ${u.isBanned || false})" style="background:${u.isBanned ? '#10b981' : '#b91c1c'}; font-size:12px; padding:6px 12px;">${u.isBanned ? 'Разбанить' : 'Забанить'}</button>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; background:rgba(0,0,0,0.2); padding:12px; border-radius:6px;">
                <div style="display:flex; gap:20px; flex-wrap:wrap;">
                    <label style="color:#cbd5e1; font-size:13px; cursor:pointer;"><input type="checkbox" ${u.isLeader ? 'checked' : ''} onchange="updateLeaderStatus('${uid}', 'isLeader', this.checked)"> 👑 Лидер</label>
                    <label style="color:#cbd5e1; font-size:13px; cursor:pointer;"><input type="checkbox" ${u.isSubLeader ? 'checked' : ''} onchange="updateLeaderStatus('${uid}', 'isSubLeader', this.checked)"> 📋 Заместитель</label>
                </div>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <select onchange="updateUserServer('${uid}', this.value)" style="background:#12171f; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:13px;">${serverOptionsHtml}</select>
                    <select onchange="updateUserFaction('${uid}', this.value)" style="background:#12171f; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:13px;">${factionOptionsHtml}</select>
                </div>
            </div>`;
        container.appendChild(card);
    }
}
function filterAdminUsers() {
    const val = document.getElementById('admin-search-user').value.toLowerCase().trim(); if (!val) return renderAdminUsersList(allUsersCache);
    const filtered = {}; for (let uid in allUsersCache) { if (allUsersCache[uid].username && allUsersCache[uid].username.toLowerCase().includes(val)) filtered[uid] = allUsersCache[uid]; }
    renderAdminUsersList(filtered);
}
function updateUserRole(uid, newRole) { db.ref(`users/${uid}/role`).set(newRole); }
function toggleUserBan(uid, currentBanStatus) { db.ref(`users/${uid}/isBanned`).set(!currentBanStatus); }
function updateLeaderStatus(uid, field, value) { db.ref(`users/${uid}/${field}`).set(value); }
function updateUserFaction(uid, factionName) { db.ref(`users/${uid}/leaderFaction`).set(factionName); }
function updateUserServer(uid, serverId) { db.ref(`users/${uid}/leaderServer`).set(serverId); }
function showNotification(message) {
    const container = document.getElementById('notification-container');
    const toast = document.createElement('div');
    toast.className = 'toast-success';
    toast.innerHTML = `<span>✅</span> ${message}`;
    
    container.appendChild(toast);

    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(20px)';
        toast.style.transition = 'all 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}
