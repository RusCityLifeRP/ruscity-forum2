// НАСТРОЙКА FIREBASE (Замени своими данными из консоли Firebase)
const firebaseConfig = {
    apiKey: "ТВОЙ_API_KEY",
    authDomain: "ТВОЙ_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://ТВОЙ_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "ТВОЙ_PROJECT_ID",
    storageBucket: "ТВОЙ_PROJECT_ID.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};

// Инициализация
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.database();

let currentUserData = null;
let viewedUserId = null;

// Переключение экранов (Фронтенд навигация)
function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

// РЕГИСТРАЦИЯ
function registerUser() {
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const passwordConfirm = document.getElementById('reg-password-confirm').value;

    if(password !== passwordConfirm) return alert("Пароли не совпадают!");
    if(!username) return alert("Введите игровой никнейм!");

    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const uid = userCredential.user.uid;
            // Базовые данные нового аккаунта в БД
            db.ref('users/' + uid).set({
                username: username,
                loginName: username.toLowerCase().replace(/ /g,"_"),
                role: "User", // По умолчанию обычный игрок
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
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    auth.signInWithEmailAndPassword(email, password)
        .then(() => {
            alert("Вы успешно вошли!");
            showScreen('screen-forum');
        })
        .catch(error => alert("Ошибка: " + error.message));
}

// ВЫХОД
function logout() {
    auth.signOut();
    location.reload();
}

// Отслеживание состояния авторизации
auth.onAuthStateChanged(user => {
    if (user) {
        // Проверяем бан пользователя сразу при входе
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
        });
    } else {
        document.getElementById('auth-buttons').classList.remove('hidden');
        document.getElementById('user-menu').classList.add('hidden');
    }
});

// ПРОСМОТР ПРОФИЛЯ
function viewMyProfile() {
    if(!currentUserData) return;
    openProfile(currentUserData.uid);
}

function openProfile(uid) {
    viewedUserId = uid;
    showScreen('screen-profile');

    db.ref('users/' + uid).once('value').then(snapshot => {
        const user = snapshot.val();
        if(!user) return;

        // Наполнение данными
        document.getElementById('prof-name').innerText = user.username;
01:30
document.getElementById('prof-role').innerText = user.role;
        document.getElementById('prof-desc').innerText = user.description;
        document.getElementById('prof-avatar').src = user.avatar;
        document.getElementById('prof-banner').style.backgroundImage = `url('${user.banner}')`;

        // Цвет роли
        const roleBadge = document.getElementById('prof-role');
        if(user.role === 'Admin') { roleBadge.style.backgroundColor = 'var(--admin-color)'; }
        else { roleBadge.style.backgroundColor = 'var(--user-color)'; }

        // Показ блока редактирования (если это твой профиль)
        if(currentUserData && currentUserData.uid === uid) {
            document.getElementById('profile-edit-block').classList.remove('hidden');
            document.getElementById('edit-name').value = user.username;
            document.getElementById('edit-avatar').value = user.avatar;
            document.getElementById('edit-banner').value = user.banner;
            document.getElementById('edit-desc').value = user.description;
        } else {
            document.getElementById('profile-edit-block').classList.add('hidden');
        }

        // Показ админ-панели (если текущий авторизованный — Admin, а просматриваемый — не он сам)
        if(currentUserData && currentUserData.role === 'Admin' && currentUserData.uid !== uid) {
            document.getElementById('admin-actions-block').classList.remove('hidden');
        } else {
            document.getElementById('admin-actions-block').classList.add('hidden');
        }
    });
}

// СОХРАНЕНИЕ ИЗМЕНЕНИЙ ПРОФИЛЯ
function saveProfile() {
    if(!currentUserData || currentUserData.uid !== viewedUserId) return;
    
    if(currentUserData.isMuted) {
        return alert("Вы не можете редактировать профиль, так как у вас мут!");
    }

    const newName = document.getElementById('edit-name').value;
    const newAvatar = document.getElementById('edit-avatar').value;
    const newBanner = document.getElementById('edit-banner').value;
    const newDesc = document.getElementById('edit-desc').value;

    db.ref('users/' + currentUserData.uid).update({
        username: newName,
        avatar: newAvatar,
        banner: newBanner,
        description: newDesc
    }).then(() => {
        alert("Профиль обновлен!");
        openProfile(currentUserData.uid);
    });
}

// АДМИНИСТРАТИВНЫЕ ФУНКЦИИ (Бан, Разбан, Мут, Размут)
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

// Заглушка для разделов
function openSection(sectionName) {
    alert("Вы открыли подраздел: " + sectionName + ". Здесь будут отображаться топики (требуется расширение бэкенда).");
}