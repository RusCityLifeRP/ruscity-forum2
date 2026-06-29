// НАСТРОЙКА FIREBASE (ЗАМЕНИ НА СВОИ КЛЮЧИ ИЗ КОНСОЛИ FIREBASE!)
const firebaseConfig = {
    apiKey: "AIzaSyBdF1KOHXA0K4O213JdF9FDCnarx0bEBy8",
    authDomain: "ruscity-349e7.firebaseapp.com",
    databaseURL: "https://ruscity-349e7-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "ruscity-349e7",
    storageBucket: "ruscity-349e7.firebasestorage.app",
    messagingSenderId: "728638066749",
    appId: "1:728638066749:web:78b207bc6765e3dc685a54"

};

// Инициализация
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.database();

// Список ролей
const ROLES = [
    "Пользователь",
    "Заместитель главного администратора форума",
    "Главный администратор форума",
    "Заместитель главного администратора",
    "Главный администратор",
    "Специальный администратор",
    "Руководство проекта"
];

let currentUserData = null;

// СЛУШАТЕЛЬ СОСТОЯНИЯ АВТОРИЗАЦИИ
auth.onAuthStateChanged(user => {
    const btnAdmin = document.getElementById('btn-admin-panel');
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    
    if (user) {
        db.ref('users/' + user.uid).on('value', snapshot => {
            currentUserData = snapshot.val();
            if (!currentUserData) return;
            currentUserData.uid = user.uid;

            // Обновляем шапку
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (document.getElementById('header-username')) {
                document.getElementById('header-username').innerText = currentUserData.username || "Пользователь";
            }
            if (document.getElementById('header-avatar')) {
                document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            }

            // Проверка ролей для доступа к админке
            const allowedRoles = [
                "Руководство проекта", 
                "Специальный администратор", 
                "Главный администратор", 
                "Заместитель главного администратора",
                "Главный администратор форума",
                "Заместитель главного администратора форума"
            ];

            if (btnAdmin) {
                if (allowedRoles.includes(currentUserData.role)) {
                    btnAdmin.classList.remove('hidden');
                } else {
                    btnAdmin.classList.add('hidden');
                }
            }
        });
    } else {
        currentUserData = null;
        if (authButtons) authButtons.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (btnAdmin) btnAdmin.classList.add('hidden');
    }
});

// ДИНАМИЧЕСКАЯ ЗАГРУЗКА СЕРВЕРОВ
function loadServers() {
    const serversListDiv = document.getElementById('servers-list');
    if (!serversListDiv) return;

    db.ref('servers').on('value', snapshot => {
        serversListDiv.innerHTML = '';
        const servers = snapshot.val();
        
        if (!servers) {
            serversListDiv.innerHTML = '<p style="color:#ff4b4b;">Ошибка доступа. Проверьте Rules в Firebase.</p>';
            return;
        }

        Object.keys(servers).forEach(serverId => {
            const server = servers[serverId];
            
            let emoji = "🎮";
            if (serverId.includes('moscow') || (server.name && server.name.includes('Москва'))) emoji = "🏰";
            if (serverId.includes('sochi') || (server.name && server.name.includes('Сочи'))) emoji = "🌴";
            if (serverId.includes('spb') || (server.name && server.name.includes('Петербург'))) emoji = "⚓";

            const card = document.createElement('div');
            card.className = 'server-card-item';
            card.addEventListener('click', () => {
                openSection(serverId);
            });

            card.innerHTML = `
                <div class="server-card-content">
                    <h3>${emoji} ${server.name || serverId}</h3>
                    <p>Перейти к разделам сервера</p>
                </div>
            `;
            serversListDiv.appendChild(card);
        });
    });
}

function openSection(serverId) {
    alert("Вы перешли в разделы сервера: " + serverId);
}

// АДМИНКА
function openAdminPanel() {
    showScreen('screen-admin');
    const list = document.getElementById('admin-users-list');
    if (!list) return;
    list.innerHTML = '<p>Загрузка списка пользователей...</p>';

    db.ref('users').once('value', snapshot => {
        list.innerHTML = '';
        const users = snapshot.val();
        if (!users) return;

        Object.keys(users).forEach(uid => {
            const user = users[uid];
            const div = document.createElement('div');
            div.className = 'admin-user-item';
            
            let options = ROLES.map(role => 
                `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`
            ).join('');

            div.innerHTML = `
                <div><strong>${user.username || 'Без имени'}</strong> (Роль: ${user.role || 'Пользователь'})</div>
                <div>
                    <select onchange="updateUserRole('${uid}', this.value)">
                        ${options}
                    </select>
                </div>
            `;
            list.appendChild(div);
        });
    });
}

function updateUserRole(uid, newRole) {
    if (!ROLES.includes(newRole)) return;
    db.ref('users/' + uid).update({ role: newRole })
        .then(() => alert("Роль успешно изменена!"))
        .catch(error => alert("Ошибка изменения роли: " + error.message));
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

function loginUser() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => { alert("Вход выполнен!"); showScreen('screen-forum'); })
        .catch(err => alert("Ошибка: " + err.message));
}

function logout() {
    auth.signOut().then(() => { location.reload(); });
}

document.addEventListener("DOMContentLoaded", () => {
    loadServers();
});


