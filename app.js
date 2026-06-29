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
            if (document.getElementById('header-avatar')) {
                document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            }

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
    
    if (btnCreateFaction) { if(isLeader) btnCreateFaction.classList.remove('hidden'); else btnCreateFaction.classList.add('hidden'); }
    if (btnCreateTopic) { if(isLeader) btnCreateTopic.classList.remove('hidden'); else btnCreateTopic.classList.add('hidden'); }
}

// ПРЕВЬЮ КАРТИНОК ИЗ ПРОВОДНИКА
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

// СЕРВЕРЫ
function loadServers() {
    const div = document.getElementById('servers-list');
    if (!div) return;
    db.ref('servers').on('value', snap => {
        div.innerHTML = '';
        const servers = snap.val();
        if (!servers) return;
        Object.keys(servers).forEach(id => {
            const s = servers[id];
            const isLeader = currentUserData && currentUserData.role === "Руководство проекта";
            if (s.hidden && !isLeader) return;

            let emoji = "🎮";
            if (id.includes('moscow') || (s.name && s.name.includes('Москва'))) emoji = "🏰";

            const card = document.createElement('div');
            card.className = 'server-card-item';
            if(s.hidden) card.style.opacity = "0.5";

            let btn = '';
            if (isLeader) {
                btn = `<button class="btn-admin-action" onclick="toggleHideServer('${id}', ${s.hidden || false}); event.stopPropagation();">${s.hidden ? 'Показать' : 'Скрыть'}</button>`;
            }
            card.innerHTML = `<div class="server-clickable-area" onclick="openServerCategories('${id}', '${s.name || id}', '${emoji}')"><h3>${emoji} ${s.name || id}</h3><p>Перейти к разделам</p></div><div>${btn}</div>`;
            div.appendChild(card);
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
        { id: "reports", name: "🚫 Жалобы", desc: "Жалобы на игроков, админов, лидеров" }
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

// ЭКРАН ОРГАНИЗАЦИЙ (УРОВЕНЬ 2)
function openCategoryFactions(catId, catName) {
    selectedCategoryId = catId;
    showScreen('screen-factions');
    document.getElementById('create-faction-form').classList.add('hidden');
    if(document.getElementById('current-category-title')) document.getElementById('current-category-title').innerText = catName;
    if(document.getElementById('btn-back-to-categories')) document.getElementById('btn-back-to-categories').onclick = () => showScreen('screen-categories');

    updateAdminButtonsVisibility();
    const div = document.getElementById('factions-list');
    if (!div) return;

    db.ref(`factions/${selectedServerId}/${selectedCategoryId}`).on('value', snap => {
        div.innerHTML = "";
        let data = snap.val();
        
        // ПЕРЕЗАПИСЬ / ПЕРВИЧНОЕ СОЗДАНИЕ С КОРРЕКТНЫМ ИМЕНЕМ «Москва LIVE»
        if (!data || (data && data.liva && data.liva.name !== "Москва LIVE")) {
            if (catId === "gov") {
                data = {
                    "sud": { name: "Судебная Власть (Суд)" },
                    "gibdd": { name: "Управление ГИБДД" },
                    "cgb3": { name: "Городская Hospital №3 (ЦГБ 3)" },
                    "cgb7": { name: "Городская Hospital №7 (ЦГБ 7)" },
                    "codd": { name: "Центр Организации Дорожного Движения (ЦОДД)" },
                    "liva": { name: "Москва LIVE" }, // Исправлено на LIVE
                    "mvd": { name: "Управление Внутренних Дел (МВД)" },
                    "fsb": { name: "Федеральная Служба Безопасности (ФСБ)" }
                };
                db.ref(`factions/${selectedServerId}/${selectedCategoryId}`).set(data);
            } else if (!data) {
                data = { "ops": { name: "Базовая ОПГ" } };
            }
        }

        Object.keys(data).forEach(fId => {
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #3b82f6";
            item.onclick = () => openFactionTopics(fId, data[fId].name);
            item.innerHTML = `<h3>🏢 ${data[fId].name}</h3><p>Нажмите, чтобы войти внутрь организации и просмотреть темы</p>`;
            div.appendChild(item);
        });
    });
}

// ЭКРАН ТЕМ ВНУТРИ КОНКРЕТНОЙ ОРГАНИЗАЦИИ (УРОВЕНЬ 3)
function openFactionTopics(factionId, factionName) {
    selectedFactionId = factionId;
    showScreen('screen-topics');
    document.getElementById('create-topic-form').classList.add('hidden');
    if(document.getElementById('current-faction-title')) document.getElementById('current-faction-title').innerText = factionName;
    if(document.getElementById('btn-back-to-factions')) document.getElementById('btn-back-to-factions').onclick = () => showScreen('screen-factions');

    updateAdminButtonsVisibility();
    const div = document.getElementById('topics-list');
    if (!div) return;

    db.ref(`topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}`).on('value', snap => {
        div.innerHTML = "";
        const topics = snap.val();

        if (!topics) {
            div.innerHTML = "<p style='color:#a0aab8; text-align:center; padding: 20px;'>В этой организации еще нет тем. Руководство может создать первую!</p>";
            return;
        }

        Object.values(topics).forEach(topicName => {
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #ff4b4b";
            item.onclick = () => alert(`Открываем тему: ${topicName}`);
            item.innerHTML = `<h3>📌 ${topicName}</h3><p>Перейти к обсуждению и заявлениям</p>`;
            div.appendChild(item);
        });
    });
}

function toggleFactionForm() { document.getElementById('create-faction-form').classList.toggle('hidden'); }
function toggleTopicForm() { document.getElementById('create-topic-form').classList.toggle('hidden'); }

function createNewFaction() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    const name = document.getElementById('new-faction-name').value.trim();
    if (!name) return;
    const fId = "fact_" + Date.now();
    db.ref(`factions/${selectedServerId}/${selectedCategoryId}/${fId}`).set({ name: name }).then(() => {
        document.getElementById('new-faction-name').value = "";
        document.getElementById('create-faction-form').classList.add('hidden');
    });
}

function createNewTopic() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    const name = document.getElementById('new-topic-name').value.trim();
    if (!name) return;

    db.ref(`topics/${selectedServerId}/${selectedCategoryId}/${selectedFactionId}`).push(name).then(() => {
        document.getElementById('new-topic-name').value = "";
        document.getElementById('create-topic-form').classList.add('hidden');
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
function showScreen(id) { document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden')); const t = document.getElementById(id); if (t) t.classList.remove('hidden'); }
function loginUser() { const e = document.getElementById('login-email').value; const p = document.getElementById('login-password').value; auth.signInWithEmailAndPassword(e, p).then(() => showScreen('screen-forum')); }
function logout() { auth.signOut().then(() => location.reload()); }

document.addEventListener("DOMContentLoaded", () => { loadServers(); });

