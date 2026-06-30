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

// Инициализация, если еще не инициализировано
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();

// ==========================================
// 2. НАСТРОЙКИ И СПИСКИ ПРОЕКТА
// ==========================================
// Конфигурация серверов проекта RusCity Life RP
const SERVERS_LIST_CONFIG = {
    "moscow": "🏰 Москва",
    "sochi": "🌴 Сочи",
    "spb": "⚓ Санкт-Петербург"
};

// Официальный список фракций для назначения руководителей
const LEADER_FACTIONS_LIST = [
    "Судебная Власть",
    "Правительство",
    "Федеральная служба безопасность",
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

// Группы форумных ролей для выпадающего списка
const FORUM_ROLES_GROUPS = {
    "Высшая Администрация": ["Разработчик", "Основатель", "Спец. Администратор", "Главный Администратор", "Зам. Гл. Администратора"],
    "Управляющая Администрация": ["Куратор Форума", "Куратор Сервера", "Гл. Куратор за Гос. организациями", "Гл. Куратор за ОПГ"],
    "Игровая Администрация": ["Старший Администратор", "Администратор", "Младший Администратор", "Модератор", "Хелпер"],
    "Обычные роли": ["Пользователь", "Проверенный пользователь", "Премиум", "Заблокирован"]
};

// Глобальные переменные для отслеживания состояния форума
let currentServerId = '';
let currentCategoryId = '';
let currentFactionId = '';
let currentTopicId = '';
let currentProfileUid = '';
let allUsersDataLocal = {};

// ==========================================
// 3. НАВИГАЦИЯ И ОНЛАЙН СТАТУС
// ==========================================
// Функция безопасного перехода «На главную» без потери статуса Online
function backToHome() {
    currentServerId = '';
    currentCategoryId = '';
    currentFactionId = '';
    currentTopicId = '';
    showScreen('screen-forum');
    updateOnlineStatus(true); // Принудительно удерживаем онлайн
}

// Переключение видимости экранов
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const targetScreen = document.getElementById(screenId);
    if (targetScreen) targetScreen.classList.remove('hidden');
}

// Принудительное обновление статуса присутствия в Firebase
function updateOnlineStatus(isOnline) {
    if (!auth.currentUser) return;
    const userStatusRef = db.ref(`users/${auth.currentUser.uid}/status`);
    userStatusRef.set(isOnline ? "online" : "offline");
}

// Функция проверки прав пользователя на редактирование/удаление/создание тем во фракциях
function hasEditAccess() {
    if (!auth.currentUser || !allUsersDataLocal[auth.currentUser.uid]) return false;
    const currentUser = allUsersDataLocal[auth.currentUser.uid];
    
    // Администрация имеет доступ ко всему по умолчанию
    const adminRoles = ["Разработчик", "Основатель", "Спец. Администратор", "Главный Администратор", "Зам. Гл. Администратора", "Куратор Форума"];
    if (adminRoles.includes(currentUser.role)) return true;

    // Проверка лидерских прав или прав заместителя для конкретного сервера и фракции
    if (currentUser.isLeader || currentUser.isSubLeader) {
        if (currentUser.leaderServer === currentServerId && currentUser.leaderFaction === currentFactionId) {
            return true;
        }
    }
    return false;
}

// ==========================================
// 4. АДМИН-ЦЕНТР И УПРАВЛЕНИЕ ПРАВАМИ
// ==========================================
// Функция отрисовки списка пользователей в админ-панели
function renderAdminUsersList(usersData) {
    const container = document.getElementById('admin-users-list'); if (!container) return; container.innerHTML = '';
    const searchVal = document.getElementById('admin-search-user') ? document.getElementById('admin-search-user').value.toLowerCase().trim() : "";
    allUsersDataLocal = usersData; // Кэшируем данные локально

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

        // Красивое динамическое определение ранга и статуса
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

// Открытие блока назначения прав
function startAssignLeader(uid, username) {
    document.querySelectorAll('[id^="assign-block-"]').forEach(b => b.classList.add('hidden'));
    const targetBlock = document.getElementById(`assign-block-${uid}`);
    if (targetBlock) targetBlock.classList.remove('hidden');
}

// Отмена назначения
function cancelLeaderAssignment(uid) {
    const targetBlock = document.getElementById(`assign-block-${uid}`);
    if (targetBlock) targetBlock.classList.add('hidden');
}

// Подтверждение и отправка данных в Firebase
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
        alert("Права управления успешно обновлены в базе данных!");
        cancelLeaderAssignment(uid);
    }).catch(err => {
        alert("Ошибка записи в Firebase: " + err.message);
    });
}

// Полное аннулирование лидерских прав и прав заместителя
function removeLeaderRights(uid) {
    if (!confirm("Вы уверены, что хотите полностью снять права руководителя с данного пользователя?")) return;
    
    db.ref(`users/${uid}`).update({
        isLeader: false,
        isSubLeader: false,
        leaderServer: null,
        leaderFaction: null
    }).then(() => {
        alert("Пользователь успешно переведен в статус обычного игрока.");
    });
}

// Смена стандартной форумной роли
function updateUserRole(uid, newRole) {
    db.ref(`users/${uid}/role`).set(newRole).then(() => {
        console.log(`Форумная роль пользователя ${uid} успешно изменена на ${newRole}`);
    });
}

// Бан / разбан пользователя
function toggleUserBan(uid, currentBanStatus) {
    const nextBan = !currentBanStatus;
    db.ref(`users/${uid}/isBanned`).set(nextBan);
}

// Фильтр поиска в админ-панели
function filterAdminUsers() {
    renderAdminUsersList(allUsersDataLocal);
}

// Открытие админ-панели и получение списка игроков
function openAdminPanel() {
    showScreen('screen-admin');
    db.ref('users').on('value', (snapshot) => {
        const users = snapshot.val() || {};
        renderAdminUsersList(users);
    });
}

// ==========================================
// 5. СЛУШАТЕЛИ FIREBASE AUTH И WINDOW CLOSING
// ==========================================
// Отслеживание входов / выходов авторизации Firebase Auth
auth.onAuthStateChanged((user) => {
    if (user) {
        document.getElementById('auth-buttons').classList.add('hidden');
        document.getElementById('user-menu').classList.remove('hidden');
        
        // Слушаем изменения профиля игрока
        db.ref(`users/${user.uid}`).on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                document.getElementById('header-username').innerText = data.username || "Без никнейма";
                document.getElementById('header-avatar').src = data.avatar || "https://purple-hub.ru/styles/aurora/xenforo/avatars/avatar_m.png";
                
                // Если админ — показываем кнопку админ-центра
                const adminRoles = ["Разработчик", "Основатель", "Спец. Администратор", "Главный Администратор", "Зам. Гл. Администратора"];
                if (adminRoles.includes(data.role)) {
                    document.getElementById('btn-admin-panel').classList.remove('hidden');
                } else {
                    document.getElementById('btn-admin-panel').classList.add('hidden');
                }
            }
        });
        updateOnlineStatus(true);
    } else {
        document.getElementById('auth-buttons').classList.remove('hidden');
        document.getElementById('user-menu').classList.add('hidden');
        document.getElementById('btn-admin-panel').classList.add('hidden');
    }
});

// Слушаем закрытие вкладки/браузера, чтобы корректно ставить статус оффлайн
window.addEventListener('beforeunload', () => {
    updateOnlineStatus(false);
});
