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

// Базовые системные роли проекта
const ROLES = [
    "Пользователь", "Заместитель главного администратора форума", "Главный администратор форума",
    "Заместитель главного администратора", "Главный администратор", "Специальный администратор", "Руководство проекта"
];
// Список ролей, которые считаются Администрацией форума
const ADMIN_PANEL_ROLES = ["Руководство проекта", "Специальный администратор", "Главный администратор", "Заместитель главного администратора"];

// Твои точные фракции для выпадающего списка выдачи лидерства
const LEADER_FACTIONS_LIST = [
    "правительство", 
    "ГИБДД", 
    "ЦГБ7 -Центральная городская больница 7", 
    "ЦГБ3 - Центральная городская больница 3", 
    "ФСИН- Федеральная служба исполнения наказаний", 
    "Москва LIVE", 
    "ФСБ - Федеральная служба безопасности", 
    "Прокуратуры", 
    "следственного комитета", 
    "судебной власти", 
    "ФСО - Федеральная служба охраны", 
    "Росгвардии", 
    "Армии", 
    "ЦОДД - Центр организации дорожного движения", 
    "МВД"
];

let currentUserData = null;
let allUsersCache = {}; 
let serversCache = {}; 

// Глобальные переменные для точного отслеживания где находится пользователь
let selectedServerId = ""; 
let selectedServerName = ""; 
let selectedCategoryId = "";
let selectedFactionId = ""; 
let selectedFactionName = ""; 
let selectedTopicId = ""; 

let base64Avatar = ""; 
let base64Banner = "";
let isGlobalInfoZone = false; 
let viewedProfileUid = "";

// ==========================================
// 1.5 НАДЕЖНАЯ ПРОВЕРКА ПРАВ ЛИДЕРА
// ==========================================
function checkModerationRights() {
    if (!currentUserData) return false;
    
    // Руководство проекта может модерировать везде
    if (currentUserData.role === "Руководство проекта") return true;

    // В глобальных инфо-зонах лидеры не редактируют
    if (isGlobalInfoZone) return false;

    // Блокируем, если не определился сервер или фракция
    if (!selectedServerName || !selectedFactionName) return false;

    const userRoleLower = (currentUserData.role || "").toLowerCase().trim();
    const serverLower = selectedServerName.toLowerCase().trim();
    const factionLower = selectedFactionName.toLowerCase().trim();

    // Сверяем ключевые слова: город + слово "лидер" + название фракции
    if (userRoleLower.includes(serverLower) && userRoleLower.includes("лидер") && userRoleLower.includes(factionLower)) {
        return true;
    }

    return false;
}

// ==========================================
// 2. СЛУШАТЕЛЬ СЕССИИ И ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
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
    const isProjectAdmin = currentUserData && currentUserData.role === "Руководство проекта";
    const hasFactionRights = checkModerationRights(); 

    const btnCreateFaction = document.getElementById('btn-show-create-faction');
    const btnCreateTopic = document.getElementById('btn-show-create-topic');
    
    if (btnCreateFaction) { 
        if(isProjectAdmin && !isGlobalInfoZone) btnCreateFaction.classList.remove('hidden'); 
        else btnCreateFaction.classList.add('hidden'); 
    }
    
    if (btnCreateTopic) { 
        if(isProjectAdmin || hasFactionRights) btnCreateTopic.classList.remove('hidden'); 
        else btnCreateTopic.classList.add('hidden'); 
    }
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// ==========================================
// 2.5 СИСТЕМА АВТОРИЗАЦИИ И РЕГИСТРАЦИИ ИГРОКОВ
// ==========================================

// Функция Входа (Авторизации)
function loginUser() {
    const email = document.getElementById('login-email').value.trim(); 
    const pass = document.getElementById('login-password').value;
    if(!email || !pass) { alert("Заполните все поля для входа!"); return; }
    
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => { showScreen('screen-forum'); })
        .catch(err => alert("Ошибка входа: " + err.message));
}

// Функция Регистрации нового аккаунта
function registerUser() {
    const email = document.getElementById('reg-email').value.trim();
    const username = document.getElementById('reg-username').value.trim();
    const pass = document.getElementById('reg-password').value;

    if (!email || !username || !pass) {
        alert("Пожалуйста, заполните абсолютно все поля для регистрации!");
        return;
    }

    if (pass.length < 6) {
        alert("Пароль должен быть не менее 6 символов!");
        return;
    }

    // Создаем пользователя в Firebase Auth
    auth.createUserWithEmailAndPassword(email, pass)
        .then(userCredential => {
            const user = userCredential.user;
            
            // Записываем базовые данные нового игрока в Realtime Database
            db.ref('users/' + user.uid).set({
                username: username,
                role: "Пользователь",
                avatar: "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png",
                banner: "",
                isBanned: false,
                isMuted: false
            }).then(() => {
                alert("🎉 Регистрация успешно завершена! Добро пожаловать на форум.");
                showScreen('screen-forum');
                
                // Очищаем инпуты формы регистрации
                document.getElementById('reg-email').value = "";
                document.getElementById('reg-username').value = "";
                document.getElementById('reg-password').value = "";
            });
        })
        .catch(err => {
            alert("Ошибка при регистрации: " + err.message);
        });
}

function logout() { auth.signOut().then(() => { location.reload(); }); }

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
            item.onclick = () => {
                selectedServerName = ""; 
                selectedFactionName = "";
                openFactionTopics(c.id, c.name, "info");
            };
            item.innerHTML = `<div class="item-text-area"><h3>${c.name}</h3><p>${c.desc}</p></div>`;
            infoDiv.appendChild(item);
        });
    }

    if (!serversDiv) return;
    db.ref('servers').on('value', snap => {
        serversDiv.innerHTML = '';
        let servers = snap.val();
        if (!servers) {
            servers = { 
                "moscow": { name: "Москва", hidden: false },
                "sochi": { name: "Сочи", hidden: false },
                "spb": { name: "Санкт-Петербург", hidden: false }
            };
            db.ref('servers').set(servers);
        }
        serversCache = servers; 
        
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

// ... Остальной код логики форума (openServerCategories, openCategoryFactions, openFactionTopics, viewSelectedTopic, openPublicProfile, openAdminPanel и т.д.) остается без изменений ...

document.addEventListener("DOMContentLoaded", () => { loadServers(); });
