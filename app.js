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

// Инициализируем приложение, если оно еще не инициализировано
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// ==========================================
// 1. ИЕРАРХИЯ ГОССТРУКТУР (LEADER_FACTIONS_LIST)
// ==========================================
const LEADER_FACTIONS_LIST = [
    "Судебная Власть",
    "Прокуратура",
    "Следственный комитет",
    "Правительство",
    "Федеральная служба безопасность",
    "Армия",
    "МВД",
    "ГИБДД",
    "Федеральная служба исполнения наказаний",
    "Федеральная служба охраны",
    "Росгвардия",
    "Центральная городская больница 7",
    "Центральная городская больница 3",
    "Центр организации дорожного движение",
    "Москва LIVE"
];

// Глобальные переменные навигации
let currentServerId = null;
let currentCategoryId = null;
let currentFactionId = null;
let currentTopicId = null;
let currentUserData = null;

// ==========================================
// 2. СЛУШАТЕЛЕ АВТОРИЗАЦИИ
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
                alert("Вы забанены на данном форуме!");
                auth.signOut();
                return;
            }
            
            if (authButtons) authButtons.style.display = 'none'; 
            if (userMenu) userMenu.classList.remove('hidden');
            if (btnProfile) btnProfile.classList.remove('hidden');
            
            if (document.getElementById('header-username')) {
                document.getElementById('header-username').innerText = currentUserData.username || "Никнейм";
            }
            if (document.getElementById('header-avatar')) {
                document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            }
            
            if (btnAdmin) {
                if (currentUserData.role === "Руководство проекта") {
                    btnAdmin.classList.remove('hidden');
                } else {
                    btnAdmin.classList.add('hidden');
                }
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
// 3. СИСТЕМА НАВИГАЦИИ И ЭКРАНОВ
// ==========================================
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
    window.scrollTo(0, 0);
}

function updateActionButtonsVisibility() {
    const isLeaderOrAdmin = currentUserData && (currentUserData.role === "Руководство проекта" || currentUserData.isLeader);
    const isAdmin = currentUserData && currentUserData.role === "Руководство проекта";
    
    const btnCreateFaction = document.getElementById('btn-show-create-faction');
    const btnCreateTopic = document.getElementById('btn-show-create-topic');
    const btnCreateSubtopic = document.getElementById('btn-show-create-subtopic');
    const adminEditorBlock = document.getElementById('topic-admin-editor-block');
    
    if (btnCreateFaction) {
        if (isAdmin) btnCreateFaction.classList.remove('hidden');
        else btnCreateFaction.classList.add('hidden');
    }
    if (btnCreateTopic) {
        if (isLeaderOrAdmin) btnCreateTopic.classList.remove('hidden');
        else btnCreateTopic.classList.add('hidden');
    }
    if (btnCreateSubtopic) {
        if (isLeaderOrAdmin) btnCreateSubtopic.classList.remove('hidden');
        else btnCreateSubtopic.classList.add('hidden');
    }
    if (adminEditorBlock) {
        if (isLeaderOrAdmin) adminEditorBlock.classList.remove('hidden');
        else adminEditorBlock.classList.add('hidden');
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadInfoSections();
    loadServers();
});

function loadInfoSections() {
    const container = document.getElementById('info-sections-list');
    if (!container) return;
    
    db.ref('info_sections').on('value', snapshot => {
        container.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            container.innerHTML = '<p class="empty-notify">Важной информации пока нет.</p>';
            return;
        }
        for (let id in data) {
            const sec = data[id];
            const div = document.createElement('div');
            div.className = 'forum-section-card item-clickable';
            div.innerHTML = `
                <div class="section-icon">📌</div>
                <div class="section-info">
                    <div class="section-title">${sec.name}</div>
                </div>
            `;
            div.onclick = () => {
                currentServerId = "info";
                currentCategoryId = "info";
                currentFactionId = id;
                openFactionScreen(sec.name);
            };
            container.appendChild(div);
        }
    });
}

function loadServers() {
    const container = document.getElementById('servers-list');
    if (!container) return;
    
    db.ref('servers').on('value', snapshot => {
        container.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            db.ref('servers/server1').set({ name: "🏰 Москва" });
            return;
        }
        for (let id in data) {
            const server = data[id];
            const div = document.createElement('div');
            div.className = 'forum-section-card item-clickable';
            div.innerHTML = `
                <div class="section-icon">🌍</div>
                <div class="section-info">
                    <div class="section-title">${server.name}</div>
                </div>
            `;
            div.onclick = () => openServerCategories(id, server.name);
            container.appendChild(div);
        }
    });
}

function openServerCategories(serverId, serverName) {
    currentServerId = serverId;
    const title = document.getElementById('current-server-title');
    if (title) title.innerText = serverName;
    
    const container = document.getElementById('categories-list');
    container.innerHTML = '';
    
    const categories = [
        { id: 'gov', name: '🏢 Государственные организации', icon: '💼' },
        { id: 'crime', name: '🥷 Криминальные организации', icon: '🔪' },
        { id: 'civil', name: '👥 Гражданский раздел', icon: '💬' }
    ];
    
    categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'forum-section-card item-clickable';
        div.innerHTML = `
            <div class="section-icon">${cat.icon}</div>
            <div class="section-info">
                <div class="section-title">${cat.name}</div>
            </div>
        `;
        div.onclick = () => openCategoryFactions(cat.id, cat.name);
        container.appendChild(div);
    });
    
    showScreen('screen-categories');
}

function openCategoryFactions(catId, catName) {
    currentCategoryId = catId;
    const title = document.getElementById('current-category-title');
    if (title) title.innerText = catName;
    
    const btnBack = document.getElementById('btn-back-to-categories');
    if (btnBack) {
        btnBack.onclick = () => showScreen('screen-categories');
    }
    
    document.getElementById('create-faction-form').classList.add('hidden');
    updateActionButtonsVisibility();
    loadFactions();
    showScreen('screen-factions');
}

function loadFactions() {
    const container = document.getElementById('factions-list');
    if (!container) return;
    
    const path = `factions/${currentServerId}/${currentCategoryId}`;
    db.ref(path).on('value', snapshot => {
        container.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            container.innerHTML = '<p class="empty-notify">Разделов / организаций нет.</p>';
            return;
        }
        for (let id in data) {
            const fac = data[id];
            const div = document.createElement('div');
            div.className = 'forum-section-card item-clickable';
            div.innerHTML = `
                <div class="section-icon">📂</div>
                <div class="section-info">
                    <div class="section-title">${fac.name}</div>
                </div>
            `;
            div.onclick = () => {
                currentFactionId = id;
                openFactionScreen(fac.name);
            };
            container.appendChild(div);
        }
    });
}

function toggleFactionForm() {
    document.getElementById('create-faction-form').classList.toggle('hidden');
}

function createNewFaction() {
    const input = document.getElementById('new-faction-name');
    const name = input.value.trim();
    if (!name) return alert("Введите название фракции!");
    
    const path = `factions/${currentServerId}/${currentCategoryId}`;
    db.ref(path).push({ name: name }).then(() => {
        input.value = '';
        document.getElementById('create-faction-form').classList.add('hidden');
    });
}

function openFactionScreen(factionName) {
    const title = document.getElementById('current-faction-title');
    if (title) title.innerText = factionName;
    
    const btnBack = document.getElementById('btn-back-to-factions');
    if (btnBack) {
        btnBack.onclick = () => {
            if (currentServerId === "info") showScreen('screen-forum');
            else showScreen('screen-factions');
        };
    }
    
    document.getElementById('create-topic-form').classList.add('hidden');
    updateActionButtonsVisibility();
    loadTopics();
    showScreen('screen-topics');
}

function loadTopics() {
    const container = document.getElementById('topics-list');
    if (!container) return;
    
    const path = `topics/${currentServerId}/${currentCategoryId}/${currentFactionId}`;
    db.ref(path).on('value', snapshot => {
        container.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            container.innerHTML = '<p class="empty-notify">В данном разделе тем еще нет.</p>';
            return;
        }
        for (let id in data) {
            const topic = data[id];
            const div = document.createElement('div');
            div.className = 'forum-section-card item-clickable';
            div.innerHTML = `
                <div class="section-icon">📌</div>
                <div class="section-info">
                    <div class="section-title">${topic.name}</div>
                </div>
            `;
            div.onclick = () => openTopicView(id, topic.name);
            container.appendChild(div);
        }
    });
}

function toggleTopicForm() {
    document.getElementById('create-topic-form').classList.toggle('hidden');
}

function createNewTopic() {
    const input = document.getElementById('new-topic-name');
    const name = input.value.trim();
    if (!name) return alert("Название темы пустое!");
    
    const path = `topics/${currentServerId}/${currentCategoryId}/${currentFactionId}`;
    db.ref(path).push({
        name: name,
        content: "Контент темы пуст. Отредактируйте его с помощью встроенного редактора."
    }).then(() => {
        input.value = '';
        document.getElementById('create-topic-form').classList.add('hidden');
    });
}

// ==========================================
// 4. ПРОСМОТР ТЕМЫ И ПОДТЕМЫ
// ==========================================
function openTopicView(topicId, topicName) {
    currentTopicId = topicId;
    const title = document.getElementById('topic-view-title');
    if (title) title.innerText = topicName;
    
    document.getElementById('create-subtopic-form').classList.add('hidden');
    document.getElementById('topic-editor-inputs').classList.add('hidden');
    
    updateActionButtonsVisibility();
    
    const path = `topics/${currentServerId}/${currentCategoryId}/${currentFactionId}/${currentTopicId}`;
    db.ref(path).on('value', snapshot => {
        const topic = snapshot.val();
        if (!topic) return;
        
        const contentBox = document.getElementById('topic-view-content');
        if (contentBox) contentBox.innerHTML = topic.content || "Нет содержимого";
        
        const richEditor = document.getElementById('editor-rich-content');
        if (richEditor) richEditor.innerHTML = topic.content || "";
    });
    
    loadSubTopics();
    showScreen('screen-view-topic');
}

function backFromTopicView() {
    showScreen('screen-topics');
}

function toggleSubTopicForm() {
    document.getElementById('create-subtopic-form').classList.toggle('hidden');
}

function createNewSubTopic() {
    const input = document.getElementById('new-subtopic-name');
    const name = input.value.trim();
    if (!name) return alert("Введите название подтемы!");
    
    const path = `subtopics/${currentTopicId}`;
    db.ref(path).push({
        name: name,
        content: "Контент подраздела пуст."
    }).then(() => {
        input.value = '';
        document.getElementById('create-subtopic-form').classList.add('hidden');
    });
}

function loadSubTopics() {
    const block = document.getElementById('subtopics-block');
    const container = document.getElementById('subtopics-list');
    if (!block || !container) return;
    
    db.ref(`subtopics/${currentTopicId}`).on('value', snapshot => {
        container.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            block.classList.add('hidden');
            return;
        }
        block.classList.remove('hidden');
        for (let id in data) {
            const sub = data[id];
            const div = document.createElement('div');
            div.className = 'forum-section-card item-clickable';
            div.style.background = '#1a202c';
            div.innerHTML = `
                <div class="section-icon">📁</div>
                <div class="section-info">
                    <div class="section-title" style="color:#60a5fa;">${sub.name}</div>
                </div>
            `;
            div.onclick = () => {
                openTopicView(id, sub.name);
            };
            container.appendChild(div);
        }
    });
}

function toggleTopicEditor() {
    document.getElementById('topic-editor-inputs').classList.toggle('hidden');
}

function formatText(command, value = null) {
    document.execCommand(command, false, value);
}

function saveTopicContent() {
    const richContent = document.getElementById('editor-rich-content').innerHTML;
    
    db.ref(`subtopics/${currentTopicId}`).once('value', snapshot => {
        if (snapshot.exists()) {
            db.ref(`subtopics/${currentTopicId}/content`).set(richContent).then(() => {
                alert("Контент подтемы сохранен!");
                document.getElementById('topic-editor-inputs').classList.add('hidden');
            });
        } else {
            db.ref(`topics/${currentServerId}/${currentCategoryId}/${currentFactionId}/${currentTopicId}/content`).set(richContent).then(() => {
                alert("Контент основной темы сохранен!");
                document.getElementById('topic-editor-inputs').classList.add('hidden');
            });
        }
    });
}

// ==========================================
// 5. РЕГИСТРАЦИЯ, ВХОД, КЛИЕНТСКАЯ ЧАСТЬ
// ==========================================
function registerUser() {
    const usernameInput = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value.trim();
    
    if (!usernameInput || !email || !password) return alert("Заполните все поля регистрации!");
    if (!usernameInput.includes("_")) return alert("Никнейм должен быть в формате Nick_Name!");
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(cred => {
            return db.ref('users/' + cred.user.uid).set({
                username: usernameInput,
                email: email,
                role: "Пользователь",
                isLeader: false,
                leaderFaction: "",
                avatar: "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png",
                banner: "",
                isBanned: false,
                likes: 0
            });
        })
        .then(() => {
            alert("Регистрация успешна!");
            showScreen('screen-forum');
        })
        .catch(err => alert("Ошибка регистрации: " + err.message));
}

function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value.trim();
    
    if (!email || !password) return alert("Введите данные аккаунта!");
    
    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            alert("Вы успешно вошли!");
            showScreen('screen-forum');
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
        })
        .catch(err => alert("Ошибка авторизации: " + err.message));
}

function toggleResetForm(show) {
    document.getElementById('reset-password-block').classList.toggle('hidden', !show);
}

function sendPasswordReset() {
    const email = document.getElementById('reset-email').value.trim();
    if (!email) return alert("Укажите ваш Email!");
    
    auth.sendPasswordResetEmail(email)
        .then(() => {
            alert("Ссылка отправлена на почту!");
            toggleResetForm(false);
        })
        .catch(err => alert("Ошибка: " + err.message));
}

// ==========================================
// 6. НАСТРОЙКИ СВОЕГО ПРОФИЛЯ
// ==========================================
function previewImage(input, previewId, isBanner = false) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        if (isBanner) {
            document.getElementById(previewId).style.backgroundImage = `url('${e.target.result}')`;
            document.getElementById(previewId).setAttribute('data-base64', e.target.result);
        } else {
            document.getElementById(previewId).src = e.target.result;
            document.getElementById(previewId).setAttribute('data-base64', e.target.result);
        }
    };
    reader.readAsDataURL(file);
}

function saveProfileChanges() {
    if (!auth.currentUser) return;
    
    const newName = document.getElementById('edit-username').value.trim();
    const avatarImg = document.getElementById('profile-avatar-preview');
    const bannerDiv = document.getElementById('profile-banner-preview');
    
    const updates = {};
    if (newName) {
        if (!newName.includes("_")) return alert("Новый ник должен содержать нижнее подчеркивание _");
        updates.username = newName;
    }
    
    const avBase64 = avatarImg.getAttribute('data-base64');
    if (avBase64) updates.avatar = avBase64;
    
    const bnBase64 = bannerDiv.getAttribute('data-base64');
    if (bnBase64) updates.banner = bnBase64;
    
    db.ref('users/' + auth.currentUser.uid).update(updates).then(() => {
        alert("Изменения профиля применены!");
        showScreen('screen-forum');
    });
}

// ==========================================
// 7. ПУБЛИЧНЫЕ ПРОФИЛИ + СТЕНА + ЛАЙКИ
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
        
        const roleEl = document.getElementById('public-role');
        roleEl.innerText = user.role || "Пользователь";
        
        if (user.role === "Руководство проекта") roleEl.style.color = "#ef4444";
        else if (user.isLeader) roleEl.style.color = "#eab308";
        else roleEl.style.color = "#3b82f6";
        
        const bannerEl = document.getElementById('public-banner');
        if (user.banner) bannerEl.style.backgroundImage = `url('${user.banner}')`;
        else bannerEl.style.backgroundImage = 'none';
        
        const likesCount = user.likes || 0;
        document.getElementById('btn-profile-like').innerText = `❤️ Лайков профиля: ${likesCount}`;
    });
    
    loadProfileComments();
}

function toggleProfileLike() {
    if (!auth.currentUser) return alert("Войдите, чтобы оценивать профили!");
    if (auth.currentUser.uid === viewTargetUid) return alert("Нельзя лайкать свой же профиль!");
    
    const likeRef = db.ref(`profile_likes/${viewTargetUid}/${auth.currentUser.uid}`);
    const userLikesRef = db.ref(`users/${viewTargetUid}/likes`);
    
    likeRef.once('value', snapshot => {
        userLikesRef.transaction(currentLikes => {
            if (snapshot.exists()) {
                likeRef.remove();
                return (currentLikes || 1) - 1;
            } else {
                likeRef.set(true);
                return (currentLikes || 0) + 1;
            }
        });
    });
}

function sendProfileComment() {
    if (!auth.currentUser) return alert("Авторизуйтесь, чтобы оставлять записи!");
    const textInput = document.getElementById('new-profile-comment');
    const text = textInput.value.trim();
    if (!text) return alert("Введите текст сообщения!");
    
    const path = `profile_walls/${viewTargetUid}`;
    db.ref(path).push({
        senderUid: auth.currentUser.uid,
        senderName: currentUserData.username || "Аноним",
        senderAvatar: currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png",
        text: text,
        timestamp: firebase.database.ServerValue.TIMESTAMP
    }).then(() => {
        textInput.value = '';
    });
}

function loadProfileComments() {
    const container = document.getElementById('profile-comments-list');
    if (!container) return;
    
    db.ref(`profile_walls/${viewTargetUid}`).on('value', snapshot => {
        container.innerHTML = '';
        const data = snapshot.val();
        if (!data) {
            container.innerHTML = '<p class="empty-notify">На стене еще нет записей.</p>';
            return;
        }
        
        const keys = Object.keys(data).reverse();
        keys.forEach(key => {
            const comm = data[key];
            const div = document.createElement('div');
            div.className = 'forum-section-card';
            div.style.background = '#12171f';
            div.style.alignItems = 'flex-start';
            div.innerHTML = `
                <img src="${comm.senderAvatar}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                <div style="flex-grow:1;">
                    <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                        <span style="font-weight:600; color:#60a5fa; cursor:pointer;" onclick="openPublicProfile('${comm.senderUid}')">${comm.senderName}</span>
                        <button class="btn-logout" style="padding:2px 8px; font-size:11px; background:rgba(239,68,68,0.1); color:#ef4444; border:none; display:none;" id="del-comm-${key}">Удалить</button>
                    </div>
                    <p style="color:#cbd5e1; font-size:14px; white-space:pre-wrap;">${comm.text}</p>
                </div>
            `;
            
            container.appendChild(div);
            
            const delBtn = document.getElementById(`del-comm-${key}`);
            if (delBtn && currentUserData && (auth.currentUser.uid === viewTargetUid || currentUserData.role === "Руководство проекта")) {
                delBtn.style.display = 'block';
                delBtn.onclick = () => {
                    if (confirm("Удалить эту запись?")) {
                        db.ref(`profile_walls/${viewTargetUid}/${key}`).remove();
                    }
                };
            }
        });
    });
}

// ==========================================
// 8. АДМИН-ПАНЕЛЬ УПРАВЛЕНИЯ ПРОЕКТОМ
// ==========================================
let allUsersCache = {};

function renderAdminUsersList(usersData) {
    const container = document.getElementById('admin-users-list');
    container.innerHTML = '';
    
    for (let uid in usersData) {
        const u = usersData[uid];
        const card = document.createElement('div');
        card.className = 'forum-section-card';
        card.style.background = '#1e2530';
        card.style.flexDirection = 'column';
        card.style.alignItems = 'stretch';
        card.style.gap = '15px';
        
        let optionsHtml = `<option value="">-- Без фракции --</option>`;
        LEADER_FACTIONS_LIST.forEach(f => {
            optionsHtml += `<option value="${f}" ${u.leaderFaction === f ? 'selected' : ''}>${f}</option>`;
        });
        
        card.innerHTML = `
            <div style="display:flex; align-items:center; gap:15px; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:12px;">
                    <img src="${u.avatar || 'https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png'}" style="width:45px; height:45px; border-radius:50%; object-fit:cover;">
                    <div>
                        <div style="font-weight:600; color:#fff; font-size:15px;">${u.username} ${u.isBanned ? '<span style="color:#ef4444;">[БАН]</span>' : ''}</div>
                        <div style="font-size:12px; color:#8a99ad;">Роль: <b style="color:#60a5fa;">${u.role || 'Пользователь'}</b></div>
                    </div>
                </div>
                <div style="display:flex; gap:8px;">
                    <button class="btn-primary" onclick="setAdminRole('${uid}', 'Руководство проекта')" style="background:#ef4444; font-size:12px; padding:6px 12px;">Выдать ГА</button>
                    <button class="btn-secondary" onclick="setAdminRole('${uid}', 'Пользователь')" style="font-size:12px; padding:6px 12px;">Сбросить в Пользователя</button>
                    <button class="btn-primary" onclick="toggleUserBan('${uid}', ${u.isBanned || false})" style="background:${u.isBanned ? '#10b981' : '#b91c1c'}; font-size:12px; padding:6px 12px;">
                        ${u.isBanned ? 'Разбанить' : 'Забанить'}
                    </button>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:15px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; justify-content:space-between;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="chk-lead-${uid}" ${u.isLeader ? 'checked' : ''} onchange="toggleLeaderStatus('${uid}', this.checked)">
                    <label for="chk-lead-${uid}" style="color:#cbd5e1; font-size:13px; cursor:pointer;">Назначить Лидером Организации</label>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:13px; color:#8a99ad;">Фракция:</span>
                    <select onchange="assignLeaderFaction('${uid}', this.value)" style="background:#12171f; color:#fff; border:1px solid #334155; padding:5px; border-radius:4px; font-size:13px;">
                        ${optionsHtml}
                    </select>
                </div>
            </div>
        `;
        container.appendChild(card);
    }
}

function loadAdminUsers() {
    const container = document.getElementById('admin-users-list');
    if (!container) return;
    
    db.ref('users').on('value', snapshot => {
        allUsersCache = snapshot.val() || {};
        renderAdminUsersList(allUsersCache);
    });
}

function filterAdminUsers() {
    const val = document.getElementById('admin-search-user').value.toLowerCase().trim();
    if (!val) return renderAdminUsersList(allUsersCache);
    
    const filtered = {};
    for (let uid in allUsersCache) {
        if (allUsersCache[uid].username && allUsersCache[uid].username.toLowerCase().includes(val)) {
            filtered[uid] = allUsersCache[uid];
        }
    }
    renderAdminUsersList(filtered);
}

function setAdminRole(uid, role) {
    db.ref(`users/${uid}/role`).set(role).then(() => alert("Роль пользователя успешно изменена!"));
}

function toggleUserBan(uid, currentBanStatus) {
    db.ref(`users/${uid}/isBanned`).set(!currentBanStatus).then(() => alert("Статус блокировки изменен!"));
}

function toggleLeaderStatus(uid, isLeader) {
    db.ref(`users/${uid}/isLeader`).set(isLeader);
}

function assignLeaderFaction(uid, factionName) {
    db.ref(`users/${uid}`).update({
        leaderFaction: factionName,
        isLeader: factionName !== "" 
    }).then(() => alert("Фракция лидера привязана!"));
}
