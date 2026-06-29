// Конфигурация Firebase
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
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

function isProjectManagement() {
    return currentUserData && currentUserData.role === 'Руководство проекта';
}

let currentUserData = null;
let viewedUserId = null;
let currentServerId = null;    // moscow, spb, sochi
let currentSectionId = null;   // gov, mvd, report-players и т.д.
let currentTopicId = null;

let base64Avatar = null;
let base64Banner = null;

const tagClasses = {
    'User': 'tag-user',
    'Руководство проекта': 'tag-rukovodstvo',
    'Специальный администратор': 'tag-specadmin',
    'Главный администратор': 'tag-glavadmin',
    'Заместитель главного администратора': 'tag-zamglavadmin',
    'Главный куратор': 'tag-glavkurator',
    'Заместитель главного куратора': 'tag-zamglavkurator',
    'Главный администратор форума': 'tag-glavforum',
    'Зам. Главного адм форума': 'tag-zamglavforum',
    'Адм. Форума': 'tag-admforum'
};

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function isProjectManagement() {
    return currentUserData && currentUserData.role === 'Руководство проекта';
}

// Инициализация структуры серверов в БД
db.ref('servers').once('value', snapshot => {
    if (!snapshot.exists()) {
        db.ref('servers').set({
            moscow: { name: "🇷🇺 Москва", visible: true },
            spb: { name: "⚓ Санкт-Петербург", visible: true },
            sochi: { name: "🌴 Сочи", visible: true }
        });
    }
});

// Слушатель серверов на главной странице
db.ref('servers').on('value', snapshot => {
    const serversList = document.getElementById('servers-list');
    if (!serversList) return;
    serversList.innerHTML = '';
    const servers = snapshot.val();
    if (!servers) return;

    Object.keys(servers).forEach(sId => {
        const server = servers[sId];
        const isLeader = isProjectManagement();

        if (!server.visible && !isLeader) return;

        const container = document.createElement('div');
        container.className = 'server-card-container';
        if (!server.visible) container.classList.add('server-hidden-status');

        const card = document.createElement('div');
        card.className = 'forum-section';
        card.onclick = () => {
            currentServerId = sId;
            document.getElementById('current-server-title').innerText = server.name;
            showScreen('screen-server-categories');
        };
        card.innerHTML = `<h3>${server.name} ${!server.visible ? '🔒 (Скрыт)' : ''}</h3><p>Перейти к разделам сервера</p>`;
        container.appendChild(card);

        if (isLeader) {
            const toggleBtn = document.createElement('button');
            toggleBtn.className = server.visible ? 'btn-toggle-visibility btn-danger' : 'btn-toggle-visibility btn-success';
            toggleBtn.innerText = server.visible ? 'Скрыть' : 'Показать';
            toggleBtn.onclick = (e) => {
                e.stopPropagation();
                db.ref(`servers/${sId}`).update({ visible: !server.visible });
            };
            container.appendChild(toggleBtn);
        }
        serversList.appendChild(container);
    });
});

function openServerCategory(categoryType) {
    if (categoryType === 'gos') showScreen('screen-gos-orgs');
    else if (categoryType === 'crime') showScreen('screen-crime-orgs');
    else openSection(categoryType);
}

function goBackFromSection() {
    const gosSections = ['gov','skr','proc','court','fsb','fsin','rosgvard','mvd','gibdd','codd','army','hospital3','hospital7','moscow_live'];
    const crimeSections = ['opg_tambov','opg_lyubertsy','mafia_rh'];
    
    if (gosSections.includes(currentSectionId)) {
        showScreen('screen-gos-orgs');
    } else if (crimeSections.includes(currentSectionId)) {
        showScreen('screen-crime-orgs');
    } else {
        showScreen('screen-server-categories');
    }
}

// Исправленная функция
function openSection(sectionId) {
    // Проверка, передано ли значение
    if (typeof sectionId === 'undefined') {
        console.error("Ошибка: sectionId не был передан в функцию openSection");
        return;
    }
    
    currentSectionId = sectionId;
    showScreen('screen-section');
    
    const btnCreate = document.getElementById('btn-create-topic');
    
    // ПРОВЕРКА ПРАВ: Показываем кнопку создания только если это руководство
    if (isProjectManagement()) {
        btnCreate.classList.remove('hidden');
    } else {
        btnCreate.classList.add('hidden');
    }

    // Использование sectionId внутри пути к базе данных
    db.ref(`topics/${currentServerId}/${sectionId}`).on('value', snapshot => {
        const topicsList = document.getElementById('topics-list');
        topicsList.innerHTML = '';
        const data = snapshot.val();
        
        if (!data) {
            topicsList.innerHTML = '<p style="padding:20px; color:#a0aec0;">Тем пока нет.</p>';
            return;
        }
        
        Object.keys(data).forEach(topicId => {
            const topic = data[topicId];
            const item = document.createElement('div');
            item.className = 'forum-section';
            item.onclick = () => openTopic(topicId);
            item.innerHTML = `<h3>${topic.title}</h3><p>Автор: ${topic.authorName} | Ответов: ${topic.replyCount || 0}</p>`;
            topicsList.appendChild(item);
        });
    });
}

function showTopicForm() { 
    document.getElementById('topic-form-block').classList.toggle('hidden'); 
}

function createNewTopic() {
    const title = document.getElementById('new-topic-title').value.trim();
    const text = document.getElementById('new-topic-text').value.trim();
    if (!title || !text) return alert("Заполните поля!");

    db.ref(`topics/${currentServerId}/${currentSectionId}`).push({
        title: title, text: text, authorId: currentUserData.uid, authorName: currentUserData.username, replyCount: 0
    }).then(() => {
        document.getElementById('new-topic-title').value = '';
        document.getElementById('new-topic-text').value = '';
        document.getElementById('topic-form-block').classList.add('hidden');
    });
}

function openTopic(topicId) {
    currentTopicId = topicId;
    showScreen('screen-topic-view');
    if (currentUserData) document.getElementById('comment-form-block').classList.remove('hidden');

    db.ref(`topics/${currentServerId}/${currentSectionId}/${topicId}`).once('value').then(snapshot => {
        const topic = snapshot.val();
        if (!topic) return;
        document.getElementById('view-topic-title').innerText = topic.title;
        document.getElementById('view-topic-author').innerText = topic.authorName;
        document.getElementById('view-topic-text').innerText = topic.text;
    });

    db.ref('comments/' + topicId).on('value', snapshot => {
        const commentsList = document.getElementById('comments-list');
        commentsList.innerHTML = '';
        const data = snapshot.val();
        if (!data) return;
        Object.keys(data).forEach(cId => {
            const comment = data[cId];
            const cDiv = document.createElement('div');
            cDiv.style = "background: var(--bg-card); padding: 15px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid var(--accent-color);";
            cDiv.innerHTML = `<div style="font-size:13px; color:#a0aec0; font-weight:bold;">${comment.authorName}</div><div style="white-space:pre-wrap;">${comment.text}</div>`;
            commentsList.appendChild(cDiv);
        });
    });
}

function createNewComment() {
    const text = document.getElementById('new-comment-text').value.trim();
    if (!text) return alert("Введите текст!");
    db.ref('comments/' + currentTopicId).push({ text: text, authorId: currentUserData.uid, authorName: currentUserData.username }).then(() => {
        db.ref(`topics/${currentServerId}/${currentSectionId}/${currentTopicId}/replyCount`).transaction(c => (c || 0) + 1);
        document.getElementById('new-comment-text').value = '';
    });
}

// Функции аккаунтов и аутентификации
function registerUser() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    if(!username || password !== document.getElementById('reg-password-confirm').value) return alert("Проверьте данные!");

    auth.createUserWithEmailAndPassword(email, password).then(cred => {
        db.ref('users/' + cred.user.uid).set({
            username: username, role: "User",
            avatar: "https://placehold.co/150/444/fff?text=" + username[0],
            banner: "https://placehold.co/1000x300/222/fff?text=RusCity", description: "Игрок RusCity"
        });
        showScreen('screen-forum');
    }).catch(e => alert(e.message));
}

function loginUser() {
    auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value)
        .then(() => showScreen('screen-forum')).catch(e => alert(e.message));
}

function logout() { auth.signOut().then(() => location.reload()); }

auth.onAuthStateChanged(user => {
    if (user) {
        db.ref('users/' + user.uid).on('value', snapshot => {
            currentUserData = snapshot.val();
            if(!currentUserData) return;
            currentUserData.uid = user.uid;
            document.getElementById('auth-buttons').classList.add('hidden');
            document.getElementById('user-menu').classList.remove('hidden');
            document.getElementById('header-username').innerText = currentUserData.username;
            document.getElementById('header-avatar').src = currentUserData.avatar;
        });
    }
});

function viewMyProfile() { openProfile(currentUserData.uid); }

function openProfile(uid) {
    viewedUserId = uid;
    showScreen('screen-profile');
    base64Avatar = null; base64Banner = null;

    db.ref('users/' + uid).once('value').then(snapshot => {
        const user = snapshot.val();
        document.getElementById('prof-name').innerText = user.username;
        const badge = document.getElementById('prof-role');
        badge.innerText = user.role || "Пользователь";
        badge.className = "role-badge " + (tagClasses[user.role] || 'tag-user');
        document.getElementById('prof-desc').innerText = user.description;
        document.getElementById('prof-avatar').src = user.avatar;
        document.getElementById('prof-banner').style.backgroundImage = `url('${user.banner}')`;

        if (currentUserData && currentUserData.uid === uid) {
            document.getElementById('profile-edit-block').classList.remove('hidden');
            document.getElementById('edit-name').value = user.username;
            document.getElementById('edit-desc').value = user.description;
            document.getElementById('edit-role-tag').value = user.role || "User";
        }
    });
}

// Чтение локальных картинок из проводника
document.addEventListener("DOMContentLoaded", () => {
    const avatarInput = document.getElementById('file-avatar');
    const bannerInput = document.getElementById('file-banner');
    
    if(avatarInput) {
        avatarInput.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const r = new FileReader(); r.onloadend = () => { base64Avatar = r.result; }; r.readAsDataURL(file);
        });
    }
    if(bannerInput) {
        bannerInput.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const r = new FileReader(); r.onloadend = () => { base64Banner = r.result; }; r.readAsDataURL(file);
        });
    }
});

function saveProfile() {
    const newName = document.getElementById('edit-name').value.trim();
    const newDesc = document.getElementById('edit-desc').value.trim();
    const newRole = document.getElementById('edit-role-tag').value;

    let updateData = { 
        username: newName, 
        description: newDesc 
    };

    // Только если пользователь — Руководство, применяем новую роль
    if (isProjectManagement()) {
        updateData.role = newRole;
    } else {
        // Иначе принудительно оставляем текущую роль
        updateData.role = currentUserData.role; 
    }

    if (base64Avatar) updateData.avatar = base64Avatar;
    if (base64Banner) updateData.banner = base64Banner;

    db.ref('users/' + currentUserData.uid).update(updateData).then(() => {
        alert("Профиль успешно обновлен");
        openProfile(currentUserData.uid);
    });
}
