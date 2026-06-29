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

let currentUserData = null;
let selectedServerId = ""; 
let selectedCategoryId = "";
let selectedFactionId = ""; 

// СЛУШАТЕЛЬ АВТОРИЗАЦИИ
auth.onAuthStateChanged(user => {
    const authButtons = document.getElementById('auth-buttons');
    const userMenu = document.getElementById('user-menu');
    
    if (user) {
        db.ref('users/' + user.uid).on('value', snapshot => {
            currentUserData = snapshot.val();
            if (authButtons) authButtons.classList.add('hidden');
            if (userMenu) userMenu.classList.remove('hidden');
            if (document.getElementById('header-username')) document.getElementById('header-username').innerText = currentUserData?.username || "Игрок";
            updateAdminButtonsVisibility();
        });
    } else {
        currentUserData = null;
        if (authButtons) authButtons.classList.remove('hidden');
        if (userMenu) userMenu.classList.add('hidden');
    }
});

// КОРРЕКТНЫЙ ПЕРЕХОД МЕЖДУ ЭКРАНАМИ
function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    const target = document.getElementById(id);
    if (target) target.classList.remove('hidden');
}

// ИНИЦИАЛИЗАЦИЯ ДАННЫХ БЕЗ ДУБЛИКАТОВ
function initDefaultData(server) {
    const ref = db.ref(`factions/${server}/gov`);
    ref.once('value', snap => {
        if (!snap.exists()) {
            const data = {
                "sud": { name: "Судебная Власть (Суд)" },
                "gibdd": { name: "Управление ГИБДД" },
                "cgb3": { name: "Городская больница №3" },
                "cgb7": { name: "Городская больница №7" },
                "codd": { name: "ЦОДД" },
                "liva": { name: "Москва LIVE" },
                "mvd": { name: "Управление Внутренних Дел (МВД)" },
                "fsb": { name: "ФСБ" }
            };
            ref.set(data);
        }
    });
}

// ЭКРАН ОРГАНИЗАЦИЙ
function openCategoryFactions(catId, catName) {
    selectedCategoryId = catId;
    showScreen('screen-factions');
    document.getElementById('current-category-title').innerText = catName;
    
    // Инициализация, если данные пустые
    initDefaultData(selectedServerId);

    db.ref(`factions/${selectedServerId}/${selectedCategoryId}`).on('value', snap => {
        const div = document.getElementById('factions-list');
        div.innerHTML = "";
        const data = snap.val();
        if (data) {
            Object.keys(data).forEach(fId => {
                const item = document.createElement('div');
                item.className = 'forum-category-item';
                item.onclick = () => openFactionTopics(fId, data[fId].name);
                item.innerHTML = `<h3>🏢 ${data[fId].name}</h3>`;
                div.appendChild(item);
            });
        }
    });
}

function openFactionTopics(fId, fName) {
    selectedFactionId = fId;
    showScreen('screen-topics');
    document.getElementById('current-faction-title').innerText = fName;
    
    db.ref(`topics/${selectedServerId}/${selectedCategoryId}/${fId}`).on('value', snap => {
        const div = document.getElementById('topics-list');
        div.innerHTML = "";
        const topics = snap.val();
        if (topics) {
            Object.values(topics).forEach(tName => {
                const item = document.createElement('div');
                item.className = 'forum-category-item';
                item.innerHTML = `<h3>📌 ${tName}</h3>`;
                div.appendChild(item);
            });
        }
    });
}

// УПРАВЛЕНИЕ АДМИН-КНОПКАМИ
function updateAdminButtonsVisibility() {
    const isLeader = currentUserData?.role === "Руководство проекта";
    document.getElementById('btn-show-create-faction')?.classList.toggle('hidden', !isLeader);
    document.getElementById('btn-show-create-topic')?.classList.toggle('hidden', !isLeader);
    document.getElementById('btn-admin-panel')?.classList.toggle('hidden', !["Руководство проекта", "Главный администратор"].includes(currentUserData?.role));
}

// ЛОГИН
function loginUser() {
    const email = document.getElementById('login-email').value;
    const pass = document.getElementById('login-password').value;
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => showScreen('screen-forum'))
        .catch(err => alert("Ошибка входа: " + err.message));
}

// ЗАГРУЗКА
document.addEventListener("DOMContentLoaded", () => {
    // Дефолтный сервер при старте
    selectedServerId = "server_1"; 
    loadServers();
});

function loadServers() { /* код загрузки серверов из предыдущего шага */ }
