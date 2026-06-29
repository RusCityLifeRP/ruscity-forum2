// НАСТРОЙКА FIREBASE (Вставь сюда свои личные данные конфигурации!)
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

// Список доступных ролей на проекте
const ROLES = [
    "Пользователь",
    "Заместитель главного администратора форума",
    "Главный администратор форума",
    "Заместитель главного администратора",
    "Главный администратор",
    "Специальный администратор",
    "Руководство проекта"
];

// Глобальные переменные состояния
let currentUserData = null;

// СЛУШАТЕЛЬ АВТОРИЗАЦИИ И ОБНОВЛЕНИЯ ПРОФИЛЯ
auth.onAuthStateChanged(user => {
    const btnAdmin = document.getElementById('btn-admin-panel');
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    
    if (user) {
        // Пользователь залогинен -> слушаем изменения его профиля в БД в реальном времени
        db.ref('users/' + user.uid).on('value', snapshot => {
            currentUserData = snapshot.val();
            if (!currentUserData) return;
            currentUserData.uid = user.uid;

            // Обновляем шапку профиля
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (document.getElementById('header-username')) {
                document.getElementById('header-username').innerText = currentUserData.username || "Пользователь";
            }
            if (document.getElementById('header-avatar')) {
                document.getElementById('header-avatar').src = currentUserData.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
            }

            // Проверяем доступ к админке (список разрешенных ролей)
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
        // Пользователь вышел
        currentUserData = null;
        if (authButtons) authButtons.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
        if (btnAdmin) btnAdmin.classList.add('hidden');
    }
});

// ЗАГРУЗКА ИГРОВЫХ СЕРВЕРОВ ИЗ FIREBASE
function loadServers() {
    const serversListDiv = document.getElementById('servers-list');
    if (!serversListDiv) return;

    db.ref('servers').on('value', snapshot => {
        serversListDiv.innerHTML = '';
        const servers = snapshot.val();
        
        if (!servers) {
            serversListDiv.innerHTML = '<p class="error-msg">Серверы не найдены в БД или доступ запрещен (Проверьте Firebase Rules)</p>';
            return;
        }

        Object.keys(servers).forEach(serverId => {
            const server = servers[serverId];
            
            // Настройка красивых эмодзи на основе ID или имени сервера для визуала городов
            let emoji = "🎮";
            if (serverId.includes('moscow') || (server.name && server.name.includes('Москва'))) emoji = "🏰";
            if (serverId.includes('sochi') || (server.name && server.name.includes('Сочи'))) emoji = "🌴";
            if (serverId.includes('spb') || (server.name && server.name.includes('Петербург'))) emoji = "⚓";

            const card = document.createElement('div');
            card.className = 'server-card-item';
            // Безопасный вызов клика через addEventListener, чтобы ничего не блокировалось
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

// Открытие конкретного сервера
function openSection(serverId) {
    alert("Переход на сервер: " + serverId);
    // Сюда можно дописать твою логику открытия тем, например: showScreen('screen-threads'); loadThreads(serverId);
}

// ПАНЕЛЬ ВЫДАЧИ РОЛЕЙ ДЛЯ АДМИНИСТРАЦИИ
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
            
            // Генерация выпадающего списка ролей
            let options = ROLES.map(role => 
                `<option value="${role}" ${user.role === role ? 'selected' : ''}>${role}</option>`
            ).join('');

            div.innerHTML = `
                <div class="admin-user-info">
                    <strong>${user.username || 'Без имени'}</strong> (Текущая роль: <span class="role-badge">${user.role || 'Пользователь'}</span>)
                </div>
                <div class="admin-user-actions">
                    <select onchange="updateUserRole('${uid}', this.value)">
                        ${options}
                    </select>
                </div>
            `;
            list.appendChild(div);
        });
    });
}

// Функция сохранения новой роли в Firebase
function updateUserRole(uid, newRole) {
    if (!ROLES.includes(newRole)) return;

    db.ref('users/' + uid).update({
        role: newRole
    }).then(() => {
        alert("Роль успешно изменена!");
    }).catch(error => {
        alert("Ошибка изменения роли: " + error.message);
    });
}

// Навигация по экранам приложения
function showScreen(screenId) {
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => screen.classList.add('hidden'));
    
    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');
}

// Функция авторизации (Вход)
function loginUser() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            alert("Успешный вход!");
            showScreen('screen-forum');
        })
        .catch(err => alert("Ошибка входа: " + err.message));
}

// Выход из аккаунта
function logout() {
    auth.signOut().then(() => {
        alert("Вы вышли из системы");
        showScreen('screen-forum');
    });
}

// Автозапуск при старте страницы
document.addEventListener("DOMContentLoaded", () => {
    loadServers();
});
