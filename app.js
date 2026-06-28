// НАСТРОЙКА FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyBdF1KOHXA0K4O213JdF9FDCnarx0bEBy8",
    authDomain: "ruscity-349e7.firebaseapp.com",
    databaseURL: "https://ruscity-349e7-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "ruscity-349e7",
    storageBucket: "ruscity-349e7.firebasestorage.app",
    messagingSenderId: "728638066749",
    appId: "1:728638066749:web:78b207bc6765e3dc685a54",
    measurementId: "G-QKSHRLLLJS"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUserData = null;
let viewedUserId = null;
let currentSectionId = null;
let currentTopicId = null;

// Локальные переменные для хранения картинок Base64 во время редактирования
let base64Avatar = null;
let base64Banner = null;

const sectionNames = {
    'news': '📢 Новости и объявления',
    'rules': '📜 Правила сервера',
    'gos': '🏢 Государственные организации',
    'crime': '🥷 Криминальные организации',
    'report-players': '🚫 Жалобы на игроков',
    'report-admins': '🛠️ Жалобы на администрацию'
};

// Хранилище CSS-классов для разных тегов
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

// РЕГИСТРАЦИЯ
function registerUser() {
    const username = document.getElementById('reg-username').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    if(password !== passwordConfirm) return alert("Пароли не совпадают!");
    if(!username) return alert("Введите игровой никнейм!");

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const uid = userCredential.user.uid;
            db.ref('users/' + uid).set({
                username: username,
                loginName: username.toLowerCase().replace(/ /g,"_"),
                role: "User",
                avatar: "https://placehold.co/150/444/fff?text=" + username[0],
                banner: "https://placehold.co/1000x300/222/fff?text=RusCity+Life+RP",
                description: "Новый игрок RusCity Life RP!",
                isBanned: false,
                isMuted: false
            });
            alert("Успешная регистрация!");
            showScreen('screen-forum');
        })
        .catch(error => alert("Ошибка: " + error.message));
}

// ВХОД
function loginUser() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            alert("Вы успешно вошли!");
            showScreen('screen-forum');
        })
        .catch(error => alert("Ошибка: " + error.message));
}

function logout() {
    auth.signOut();
    location.reload();
}

// ОБНОВЛЕНИЕ АВТОРИЗАЦИИ
auth.onAuthStateChanged(user => {
    if (user) {
        db.ref('users/' + user.uid).on('value', snapshot => {
            const data = snapshot.val();
            if(!data) return;
            
            if(data.isBanned) {
                alert("Ваш аккаунт заблокирован на форуме RusCity Life RP!");
                auth.signOut();
                return;
            }
            currentUserData = data;
            currentUserData.uid = user.uid;
            
            document.getElementById('auth-buttons').classList.add('hidden');
            document.getElementById('user-menu').classList.remove('hidden');
            document.getElementById('header-username').innerText = data.username;
            document.getElementById('header-avatar').src = data.avatar || "https://placehold.co/150";
        });
    } else {
        document.getElementById('auth-buttons').classList.remove('hidden');
        document.getElementById('user-menu').classList.add('hidden');
    }
});

function viewMyProfile() {
    if(!currentUserData) return;
    openProfile(currentUserData.uid);
}

// ОТКРЫТИЕ ПРОФИЛЯ С ТЕГАМИ И АНИМАЦИЕЙ
function openProfile(uid) {
    viewedUserId = uid;
    showScreen('screen-profile');
    
    // Сброс буферов файлов
    base64Avatar = null;
    base64Banner = null;
    document.getElementById('file-avatar').value = "";
    document.getElementById('file-banner').value = "";

    db.ref('users/' + uid).once('value').then(snapshot => {
        const user = snapshot.val();
        if(!user) return;

        const elName = document.getElementById('prof-name');
        const elRole = document.getElementById('prof-role');
        const elDesc = document.getElementById('prof-desc');
        const elAvatar = document.getElementById('prof-avatar');
        const elBanner = document.getElementById('prof-banner');

        elName.innerText = user.username;
        elRole.innerText = user.role || "Пользователь";
        elDesc.innerText = user.description;
        elAvatar.src = user.avatar;
        elBanner.style.backgroundImage = "url('" + user.banner + "')";

        // Сброс старых классов тега и установка нового
        elRole.className = "role-badge";
        const currentTagClass = tagClasses[user.role] || 'tag-user';
        elRole.classList.add(currentTagClass);

        const editBlock = document.getElementById('profile-edit-block');
        const tagSelectorBlock = document.getElementById('admin-tag-selector-block');

        if(currentUserData && currentUserData.uid === uid) {
            editBlock.classList.remove('hidden');
            document.getElementById('edit-name').value = user.username;
            document.getElementById('edit-desc').value = user.description;
            
            // Если ты админ, ты можешь прямо в профиле менять свой тег должности
            if(currentUserData.role === 'Admin' || tagClasses[currentUserData.role] !== 'tag-user') {
                tagSelectorBlock.classList.remove('hidden');
                document.getElementById('edit-role-tag').value = user.role || "User";
            } else {
                tagSelectorBlock.classList.add('hidden');
            }
        } else {
            editBlock.classList.add('hidden');
        }

        const adminBlock = document.getElementById('admin-actions-block');
        if(currentUserData && currentUserData.role === 'Admin' && currentUserData.uid !== uid) {
            adminBlock.classList.remove('hidden');
        } else {
            adminBlock.classList.add('hidden');
        }
    });
}

// СЛУШАТЕЛИ ФАЙЛОВ ИЗ ПРОВОДНИКА (Base64 Конвертеры)
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('file-avatar').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => { base64Avatar = reader.result; };
        reader.readAsDataURL(file);
    });

    document.getElementById('file-banner').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => { base64Banner = reader.result; };
        reader.readAsDataURL(file);
    });
});

// СОХРАНЕНИЕ ИЗМЕНЕНИЙ
function saveProfile() {
    if(!currentUserData || currentUserData.uid !== viewedUserId) return;
    if(currentUserData.isMuted) return alert("Вы замучены!");

    const newName = document.getElementById('edit-name').value.trim();
    const newDesc = document.getElementById('edit-desc').value.trim();
    
    let updateFields = {
        username: newName,
        description: newDesc
    };

    // Если файлы были выбраны, добавляем их в пакет обновления
    if (base64Avatar) updateFields.avatar = base64Avatar;
    if (base64Banner) updateFields.banner = base64Banner;

    // Обновление админ-тега роли, если блок выбора был активен
    const tagSelectorBlock = document.getElementById('admin-tag-selector-block');
    if (!tagSelectorBlock.classList.contains('hidden')) {
        updateFields.role = document.getElementById('edit-role-tag').value;
    }

    db.ref('users/' + currentUserData.uid).update(updateFields).then(() => {
        alert("Профиль успешно обновлен!");
        openProfile(currentUserData.uid);
    });
}

// МОДЕРАЦИЯ
function moderateUser(action) {
    if(!currentUserData || currentUserData.role !== 'Admin') return alert("Нет прав!");
    let updateData = {};
    if(action === 'mute') { updateData.isMuted = true; alert("Пользователю выдан мут!"); }
    if(action === 'unmute') { updateData.isMuted = false; alert("Мут снят!"); }
    if(action === 'ban') { updateData.isBanned = true; alert("Пользователь забанен!"); }
    if(action === 'unban') { updateData.isBanned = false; alert("Пользователь разбанен!"); }

    db.ref('users/' + viewedUserId).update(updateData).then(() => {
        openProfile(viewedUserId);
    });
}

// ЛОГИКА ТЕМ И РАЗДЕЛОВ
function openSection(sectionId) {
    currentSectionId = sectionId;
    showScreen('screen-section');
    document.getElementById('section-title').innerText = sectionNames[sectionId] || "Раздел форума";
    document.getElementById('topic-form-block').classList.add('hidden');

    const btnCreate = document.getElementById('btn-create-topic');
    if (currentUserData) btnCreate.classList.remove('hidden');
    else btnCreate.classList.add('hidden');

    db.ref('topics/' + sectionId).on('value', snapshot => {
        const topicsList = document.getElementById('topics-list');
        topicsList.innerHTML = '';
        const data = snapshot.val();

        if (!data) {
            topicsList.innerHTML = '<p style="padding:20px; color:#a0aec0;">Здесь пока нет ни одной темы.</p>';
            return;
        }

        Object.keys(data).forEach(topicId => {
            const topic = data[topicId];
            const item = document.createElement('div');
            item.className = 'forum-section';
            item.onclick = function() { openTopic(topicId); };
            item.innerHTML = `
                <h3>${topic.title}</h3>
                <p>Автор: ${topic.authorName} | Ответов: ${topic.replyCount || 0}</p>
            `;
            topicsList.appendChild(item);
        });
    });
}

function showTopicForm() {
    if (currentUserData && currentUserData.isMuted) return alert("У вас активный мут!");
    document.getElementById('topic-form-block').classList.toggle('hidden');
}

function createNewTopic() {
    if (!currentUserData) return alert("Войдите на форум!");
    if (currentUserData.isMuted) return alert("У вас мут!");

    const title = document.getElementById('new-topic-title').value.trim();
    const text = document.getElementById('new-topic-text').value.trim();

    if (!title || !text) return alert("Заполните заголовок и текст темы!");

    const newTopicRef = db.ref('topics/' + currentSectionId).push();
    newTopicRef.set({
        title: title,
        text: text,
        authorId: currentUserData.uid,
        authorName: currentUserData.username,
        replyCount: 0
    }).then(() => {
        document.getElementById('new-topic-title').value = '';
        document.getElementById('new-topic-text').value = '';
        document.getElementById('topic-form-block').classList.add('hidden');
        alert("Тема успешно опубликована!");
    });
}

function openTopic(topicId) {
    currentTopicId = topicId;
    showScreen('screen-topic-view');

    const commentBlock = document.getElementById('comment-form-block');
    if (currentUserData) commentBlock.classList.remove('hidden');
    else commentBlock.classList.add('hidden');

    db.ref('topics/' + currentSectionId + '/' + topicId).once('value').then(snapshot => {
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

        if (!data) {
            commentsList.innerHTML = '<p style="color:#a0aec0; padding:10px;">В теме пока нет ответов.</p>';
            return;
        }

        Object.keys(data).forEach(cId => {
            const comment = data[cId];
            const cDiv = document.createElement('div');
            cDiv.style = "background: var(--bg-card); padding: 15px; border-radius: 6px; margin-bottom: 10px; border-left: 3px solid var(--accent-color);";
            cDiv.innerHTML = `
                <div style="font-size:13px; color:#a0aec0; font-weight:bold; margin-bottom:5px;">${comment.authorName}</div>
                <div style="white-space: pre-wrap;">${comment.text}</div>
            `;
            commentsList.appendChild(cDiv);
        });
    });
}

function createNewComment() {
    if (!currentUserData) return alert("Авторизуйтесь!");
    if (currentUserData.isMuted) return alert("Вы замучены!");

    const text = document.getElementById('new-comment-text').value.trim();
    if (!text) return alert("Введите текст сообщения!");

    const commentRef = db.ref('comments/' + currentTopicId).push();
    commentRef.set({
        text: text,
        authorId: currentUserData.uid,
        authorName: currentUserData.username
    }).then(() => {
        const tRef = db.ref('topics/' + currentSectionId + '/' + currentTopicId + '/replyCount');
        tRef.transaction(currentCount => (currentCount || 0) + 1);
        document.getElementById('new-comment-text').value = '';
    });
}

function backToSection() {
    openSection(currentSectionId);
}
