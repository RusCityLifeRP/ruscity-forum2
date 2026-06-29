// CONFIG FIREBASE
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

const ROLES = [
    "Пользователь", "Заместитель главного администратора форума", "Главный администратор форума",
    "Заместитель главного администратора", "Главный администратор", "Специальный администратор", "Руководство проекта"
];
const ADMIN_PANEL_ROLES = ["Руководство проекта", "Специальный администратор", "Главный администратор", "Заместитель главного администратора"];

let currentUserData = null;
let selectedServerId = ""; 
let selectedCategoryId = "";
let selectedFactionId = ""; 
let base64Avatar = ""; 
let base64Banner = "";
let isGlobalInfoZone = false; 

// СЛУШАТЕЛЬ АВТОРИЗАЦИИ
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

// ПЕРЕКЛЮЧЕНИЕ ЭКРАНОВ
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ПРОФИЛЬ
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
        alert("Успешно сохранено!");
        showScreen('screen-forum');
    });
}

// ЗАГРУЗКА ГЛАВНОЙ СТРАНИЦЫ (СЕРВЕРЫ + ГЛОБАЛЬНЫЕ ВКЛАДКИ)
function loadServers() {
    const infoDiv = document.getElementById('info-sections-list');
    const serversDiv = document.getElementById('servers-list');
    
    if (infoDiv) {
        const infoCats = [
            { id: "rules", name: "📜 Правила проекта", desc: "Общие правила сервера, регламенты и положения для игроков" },
            { id: "laws", name: "⚖️ Законодательство", desc: "Конституция, кодексы, законы и нормативно-правовые акты" }
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
        { id: "reports", name: "🚫 Жалобы", desc: "Жалобы" }
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

// СПИСОК ОРГАНИЗАЦИЙ С ЗАЩИТОЙ ОТ ДУБЛЕЙ
function openCategoryFactions(catId, catName) {
    selectedCategoryId = catId;
    isGlobalInfoZone = false;
    showScreen('screen-factions');
    document.getElementById('create-faction-form').classList.add('hidden');
    if(document.getElementById('current-category-title')) document.getElementById('current-category-title').innerText = catName;
    if(document.getElementById('btn-back-to-categories')) document.getElementById('btn-back-to-categories').onclick = () => showScreen('screen-categories');

    updateAdminButtonsVisibility();
    const ref = db.ref(`factions/${selectedServerId}/${selectedCategoryId}`);
    
    ref.once('value', snap => {
        if (!snap.exists() && catId === "gov") {
            const defaultGovList = {
                "fact_1": { name: "Правительство", icon: "🏛️" },
                "fact_2": { name: "Прокуратура", icon: "⚖️" },
                "fact_3": { name: "Следственный комитет", icon: "🔍" },
                "fact_4": { name: "Судебная власть", icon: "🔨" },
                "fact_5": { name: "Федеральная служба охраны", icon: "🛡️" },
                "fact_6": { name: "Росгвардия", icon: "💂" },
                "fact_7": { name: "Армия", icon: "🪖" },
                "fact_8": { name: "Центр организации дорожного движение", icon: "🟢" },
                "fact_9": { name: "МВД", icon: "🚓" },
                "fact_10": { name: "ГИБДД", icon: "🚨" },
                "fact_11": { name: "Центральная городская больница 7", icon: "🏥" },
                "fact_12": { name: "Центральная городская больница 3", icon: "🏥" },
                "fact_13": { name: "Федеральная служба исполнения наказаний", icon: "⛓️" },
                "fact_14": { name: "Москва LIVE", icon: "📻" },
                "fact_15": { name: "Федеральная служба безопасности", icon: "🦅" }
            };
            ref.set(defaultGovList);
        } else if (!snap.exists() && catId === "crime") {
            ref.set({ "ops": { name: "Базовая ОПГ", icon: "🥷" } });
        }
    });

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

// ОТКРЫТИЕ ТЕМ (РАБОТАЕТ И ДЛЯ СЕРВЕРОВ, И ДЛЯ ПРАВИЛ/ЗАКОНОВ)
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

function createNewFaction() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта" || isGlobalInfoZone) return;
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

function openAdminPanel() {
    showScreen('screen-admin');
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    db.ref('users').once('value', snap => {
        list.innerHTML = '';
        const users = snap.val();
        if (!users) return;
        Object.keys(users).forEach(uid => {
            const u = users[uid];
            const div = document.createElement('div');
            div.className = 'admin-user-item';
            let opts = ROLES.map(r => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${r}</option>`).join('');
            div.innerHTML = `<div><strong>${u.username || 'Без имени'}</strong></div><div><select onchange="updateUserRole('${uid}', this.value)">${opts}</select></div>`;
            list.appendChild(div);
        });
    });
}

function updateUserRole(uid, r) { db.ref('users/' + uid).update({ role: r }); }

function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const pass = document.getElementById('login-password').value;
    
    if(!email || !pass) {
        alert("Пожалуйста, заполните все поля!");
        return;
    }
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => { showScreen('screen-forum'); })
        .catch(err => { alert("Ошибка авторизации: " + err.message); });
}

function logout() { auth.signOut().then(() => { location.reload(); }); }

document.addEventListener("DOMContentLoaded", () => { loadServers(); });
