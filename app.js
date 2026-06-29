// КОНФИГУРАЦИЯ FIREBASE (ТВОИ АКТУАЛЬНЫЕ ДАННЫЕ)
const firebaseConfig = {
    apiKey: "AIzaSyBdF1KOHXA0K4O213JdF9FDCnarx0bEBy8",
    authDomain: "ruscity-349e7.firebaseapp.com",
    databaseURL: "https://ruscity-349e7-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "ruscity-349e7",
    storageBucket: "ruscity-349e7.firebasestorage.app",
    messagingSenderId: "728638066749",
    appId: "1:728638066749:web:78b207bc6765e3dc685a54"
};

// Инициализация Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
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
let base64Avatar = ""; // Строковые кеши для загруженных картинок
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
            
            // Ставим текущие аватар и баннер в превью редактора профиля
            if(document.getElementById('profile-avatar-preview')) {
                document.getElementById('profile-avatar-preview').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            }
            if(document.getElementById('profile-banner-preview')) {
                const bannerUrl = currentUserData.banner || "";
                document.getElementById('profile-banner-preview').style.backgroundImage = bannerUrl ? `url('${bannerUrl}')` : "none";
            }

            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (btnProfile) btnProfile.classList.remove('hidden');
            
            if (document.getElementById('header-username')) document.getElementById('header-username').innerText = currentUserData.username || "Пользователь";
            if (document.getElementById('header-avatar')) {
                document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            }

            if (btnAdmin) {
                if (ADMIN_PANEL_ROLES.includes(currentUserData.role)) {
                    btnAdmin.classList.remove('hidden');
                } else {
                    btnAdmin.classList.add('hidden');
                }
            }
            
            const btnCreateTopic = document.getElementById('btn-show-create-topic');
            if (btnCreateTopic) {
                if (currentUserData.role === "Руководство проекта") btnCreateTopic.classList.remove('hidden');
                else btnCreateTopic.classList.add('hidden');
            }
        });
    } else {
        currentUserData = null;
        if (authButtons) authButtons.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (btnAdmin) btnAdmin.classList.add('hidden');
        if (btnProfile) btnProfile.classList.add('hidden');
    }
});

// ФУНКЦИЯ ДЛЯ ПРЕВЬЮ И ПЕРЕВОДА КАРТИНКИ ИЗ ПРОВОДНИКА В BASE64
function previewImage(inputElement, previewId, isBanner = false) {
    const file = inputElement.files[0];
    if (!file) return;

    // Валидация размера файла (чтобы строка в базе не была бесконечной, до 2МБ)
    if (file.size > 2 * 1024 * 1024) {
        alert("Файл слишком большой! Выберите картинку до 2 МБ.");
        inputElement.value = "";
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64Result = e.target.result;
        if (isBanner) {
            base64Banner = base64Result;
            document.getElementById(previewId).style.backgroundImage = `url('${base64Result}')`;
        } else {
            base64Avatar = base64Result;
            document.getElementById(previewId).src = base64Result;
        }
    };
    reader.readAsDataURL(file);
}

// СОХРАНЕНИЕ ПРОФИЛЯ С КАРТИНКАМИ ИЗ ПРОВОДНИКА
function saveProfileChanges() {
    if (!auth.currentUser) return;
    const newUsername = document.getElementById('edit-username').value.trim();

    if (!newUsername) {
        alert("Никнейм не может быть пустым!");
        return;
    }

    const updateData = { username: newUsername };
    
    // Если пользователь выбрал новые файлы, добавляем их в запрос
    if (base64Avatar) updateData.avatar = base64Avatar;
    if (base64Banner) updateData.banner = base64Banner;

    db.ref('users/' + auth.currentUser.uid).update(updateData)
    .then(() => {
        alert("Ваш профиль и оформление успешно обновлены!");
        base64Avatar = "";
        base64Banner = "";
        showScreen('screen-forum');
    }).catch(err => alert("Ошибка обновления: " + err.message));
}

// ЗАГРУЗКА ИГРОВЫХ СЕРВЕРОВ
function loadServers() {
    const serversListDiv = document.getElementById('servers-list');
    if (!serversListDiv) return;

    db.ref('servers').on('value', snapshot => {
        serversListDiv.innerHTML = '';
        const servers = snapshot.val();
        if (!servers) return;

        Object.keys(servers).forEach(serverId => {
            const server = servers[serverId];
            const isLeader = currentUserData && currentUserData.role === "Руководство проекта";
            if (server.hidden && !isLeader) return; 

            let emoji = "🎮";
            if (serverId.includes('moscow') || (server.name && server.name.includes('Москва'))) emoji = "🏰";
            if (serverId.includes('sochi') || (server.name && server.name.includes('Сочи'))) emoji = "🌴";
            if (serverId.includes('spb') || (server.name && server.name.includes('Петербург'))) emoji = "⚓";

            const card = document.createElement('div');
            card.className = 'server-card-item';
            if(server.hidden) card.style.opacity = "0.5";

            let hideButtonHtml = '';
            if (isLeader) {
                hideButtonHtml = `<button class="btn-admin-action" onclick="toggleHideServer('${serverId}', ${server.hidden || false}); event.stopPropagation();">
                    ${server.hidden ? 'Показать' : 'Скрыть'}
                </button>`;
            }

            card.innerHTML = `
                <div class="server-clickable-area" onclick="openServerCategories('${serverId}', '${server.name || serverId}', '${emoji}')">
                    <h3>${emoji} ${server.name || serverId}</h3>
                    <p>Перейти к разделам сервера</p>
                </div>
                <div>${hideButtonHtml}</div>
            `;
            serversListDiv.appendChild(card);
        });
    });
}

function openServerCategories(serverId, serverName, emoji) {
    selectedServerId = serverId;
    showScreen('screen-categories');
    const titleEl = document.getElementById('current-server-title');
    if (titleEl) titleEl.innerText = `${emoji} ${serverName}`;

    const categoriesListDiv = document.getElementById('categories-list');
    if (!categoriesListDiv) return;

    const categories = [
        { id: "gov", name: "🏢 Государственные организации", desc: "Официальные структуры и ведомства" },
        { id: "crime", name: "🥷 Криминальные организации", desc: "ОПГ, синдикаты, бандитские группировки" },
        { id: "players_reports", name: "🚫 Жалобы на игроков", desc: "Нарушения правил сервера" },
        { id: "admin_reports", name: "🛠️ Жалобы на администрацию", desc: "Обжалование наказаний" },
        { id: "leaders_reports", name: "💼 Жалобы на лидеров", desc: "Жалобы на лидеров организаций" }
    ];

    categoriesListDiv.innerHTML = "";
    categories.forEach(cat => {
        const item = document.createElement('div');
        item.className = 'forum-category-item';
        item.onclick = () => openCategoryFactions(cat.id, cat.name);
        item.innerHTML = `<h3>${cat.name}</h3><p>${cat.desc}</p>`;
        categoriesListDiv.appendChild(item);
    });
}

function openCategoryFactions(categoryId, categoryName) {
    selectedCategoryId = categoryId;
    showScreen('screen-factions');
    document.getElementById('create-topic-form').classList.add('hidden');
    
    const catTitleEl = document.getElementById('current-category-title');
    if (catTitleEl) catTitleEl.innerText = categoryName;

    const backBtn = document.getElementById('btn-back-to-categories');
    if (backBtn) backBtn.onclick = () => showScreen('screen-categories');

    const btnCreateTopic = document.getElementById('btn-show-create-topic');
    if (btnCreateTopic) {
        if (currentUserData && currentUserData.role === "Руководство проекта") btnCreateTopic.classList.remove('hidden');
        else btnCreateTopic.classList.add('hidden');
    }

    const factionsListDiv = document.getElementById('factions-list');
    if (!factionsListDiv) return;

    db.ref(`topics/${selectedServerId}/${selectedCategoryId}`).on('value', snapshot => {
        factionsListDiv.innerHTML = "";
        const customTopics = snapshot.val();
        
        let topicsArray = [];
        if (customTopics) {
            topicsArray = Object.values(customTopics);
        } else {
            if (categoryId === "gov") topicsArray = ["Правительство", "Следственный комитет России", "Прокуратура", "ФСБ", "Армия", "МВД"];
            else if (categoryId === "crime") topicsArray = ["ЧОП", "Ночные волки", "Бакшиш"];
            else topicsArray = ["Правила подачи жалоб", "Архив жалоб"];
        }

        topicsArray.forEach(topic => {
            const item = document.createElement('div');
            item.className = 'forum-category-item';
            item.style.borderLeft = "4px solid #ff4b4b";
            item.onclick = () => alert(`Открытие подфорума: ${topic}`);
            item.innerHTML = `<h3>📌 ${topic}</h3><p>Перейти к темам организации</p>`;
            factionsListDiv.appendChild(item);
        });
    });
}

function toggleTopicForm() { document.getElementById('create-topic-form').classList.toggle('hidden'); }

function createNewTopic() {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    const input = document.getElementById('new-topic-name');
    const topicName = input.value.trim();
    if (!topicName) return;

    db.ref(`topics/${selectedServerId}/${selectedCategoryId}`).push(topicName).then(() => {
        input.value = "";
        document.getElementById('create-topic-form').classList.add('hidden');
    });
}

function toggleHideServer(serverId, currentHiddenStatus) {
    if (!currentUserData || currentUserData.role !== "Руководство проекта") return;
    db.ref('servers/' + serverId).update({ hidden: !currentHiddenStatus });
}

function openAdminPanel() {
    showScreen('screen-admin');
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    db.ref('users').once('value', snapshot => {
        list.innerHTML = '';
        const users = snapshot.val();
        if (!users) return;
        Object.keys(users).forEach(uid => {
            const user = users[uid];
            const div = document.createElement('div');
            div.className = 'admin-user-item';
            let options = ROLES.map(role => `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`).join('');
            div.innerHTML = `<div><strong>${user.username || 'Без имени'}</strong></div><div><select onchange="updateUserRole('${uid}', this.value)">${options}</select></div>`;
            list.appendChild(div);
        });
    });
}

function updateUserRole(uid, newRole) {
    if (!ROLES.includes(newRole)) return;
    db.ref('users/' + uid).update({ role: newRole }).then(() => alert("Роль изменена!"));
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

function loginUser() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, pass).then(() => { showScreen('screen-forum'); });
}

function logout() { auth.signOut().then(() => { location.reload(); }); }

document.addEventListener("DOMContentLoaded", () => { loadServers(); });
