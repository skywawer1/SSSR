import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDlZOtnG9C425Y37kNtNV-LgKL_Q7XBJHY",
  authDomain: "cpd-mdt-33624.firebaseapp.com",
  databaseURL: "https://cpd-mdt-33624-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "cpd-mdt-33624",
  storageBucket: "cpd-mdt-33624.firebasestorage.app",
  messagingSenderId: "927786055520",
  appId: "1:927786055520:web:9ca40c5b83c9db416f5005",
  measurementId: "G-04527XCV90"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// === ЛОКАЛЬНЫЕ БАЗЫ ДАННЫХ (Для контента) ===
// В будущем их тоже можно будет перенести в Firestore
let mockPages = {
    'air': { title: 'Состояние атмосферного воздуха', content: 'Радиационный фон в пределах нормы. Превышений ПДК загрязняющих веществ не зафиксировано.' },
    'heroes': { title: 'Герои МЧС ШССР', content: 'Здесь будет опубликован список сотрудников, отличившихся при ликвидации ЧС.' },
    'crisis': { title: 'Как пережить кризис', content: 'Сохраняйте спокойствие. Держите при себе документы, запас воды и медикаментов на 3 дня.' },
    'attack': { title: 'Действия при обстрелах', content: 'Немедленно спуститесь в укрытие. Правило двух стен сохраняет жизнь.' },
    'curfew': { title: 'Правила комендантского часа', content: 'Нахождение на улице в ночное время без спецпропуска строго запрещено патрулями ВЧК.' },
    'normative': { title: 'Нормативная база', content: 'Внутренние уставы и приказы Министерства.' },
    'tech': { title: 'Техническое обеспечение', content: 'Сводка по доступной технике в автопарках спасательных частей.' },
    'architecture': { title: 'Брутализм и архитектура', content: 'Историческая справка о застройке спальных районов ШССР.' }
};

let mockRecommendations = [
    { id: 'crisis', title: 'Как пережить кризис и сохранить спокойствие', desc: 'Официальные руководства штаба Гражданской Обороны ШССР.', bg: 'from-red-500 to-orange-500' },
    { id: 'attack', title: 'Действия при обстрелах жилых массивов', desc: 'Алгоритмы укрытия и правила фортификации комнат.', bg: 'from-slate-700 to-slate-900' }
];

const lawsDatabase = [
    { id: "1.1", title: "Против хищения имущества", text: "Хищением признается тайное или открытое (грабеж) присвоение имущества..." },
    { id: "1.2", title: "Против государственной измены и мятежа", text: "Под запретом находятся организация, участие или публичная агитация..." }
];

let mockPosts = [{ id: '1', category: 'Новости', title: 'Внимание: Проверка сирен', content: 'Сегодня в 12:00 пройдет плановая проверка систем оповещения.', date: '02.06.2026' }];
let mockStats = { events: 244, fires: 122, saved: 8, buildings: 33 };

let currentUser = null; // Текущий авторизованный пользователь

const rolePermissions = {
    'Ген.сек': { isFull: true, canPost: true, canManageRanks: true },
    'Секретарь ЦК СПШ': { isFull: true, canPost: true, canManageRanks: true },
    'Верховный совет': { isFull: false, canPost: true, canManageRanks: false },
    'Издатель газет': { isFull: false, canPost: true, canManageRanks: false },
    'Нарком ВЧК': { isFull: false, canPost: true, canManageRanks: true },
    'Нарком.Пром': { isFull: false, canPost: true, canManageRanks: true },
    'Нарком.Строительства': { isFull: false, canPost: true, canManageRanks: true },
    'ВЧК': { isFull: false, canPost: false, canManageRanks: false },
    'Строители': { isFull: false, canPost: false, canManageRanks: false },
    'Гражданин': { isFull: false, canPost: false, canManageRanks: false, isCivilian: true }
};

// === ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛЬ АВТОРИЗАЦИИ FIREBASE ===

function init() {
    const btn = document.getElementById('sitemapToggle'), menu = document.getElementById('sitemapDropdown'), chev = document.getElementById('sitemapChevron');
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); chev.classList.toggle('rotate-180'); });
    document.addEventListener('click', () => { menu.classList.add('hidden'); chev.classList.remove('rotate-180'); });

    renderLaws(); renderStats(); renderPosts(); renderRecommendations();
    loadPageForEdit();

    // Слушатель изменения состояния авторизации
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Если пользователь вошел, достаем его ранг из базы данных Firestore
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            let userRank = 'Гражданин'; // По умолчанию
            
            if (docSnap.exists()) {
                userRank = docSnap.data().rank || 'Гражданин';
            } else {
                // Если записи в БД почему-то нет, создаем ее
                await setDoc(doc(db, "users", user.uid), { email: user.email, rank: 'Гражданин' });
            }
            
            currentUser = { email: user.email, rank: userRank, uid: user.uid };
            updateAuthUI(currentUser);
            renderEmployees(); // Загружаем список сотрудников только если вошли
        } else {
            // Если пользователь не авторизован
            currentUser = null;
            updateAuthUI(null);
        }
    });
}

// === ФУНКЦИИ РЕГИСТРАЦИИ И ВХОДА (FIREBASE) ===

async function handleRegister() {
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    if(!email.endsWith('@sssr.gov')) return alert("Формат почты: name@sssr.gov");
    if(password.length < 6) return alert("Пароль должен быть минимум 6 символов!");

    try {
        // Создаем аккаунт в Firebase Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Сохраняем информацию о пользователе и его ранг в базе данных Firestore
        await setDoc(doc(db, "users", user.uid), {
            email: email,
            rank: 'Гражданин' // Все новые пользователи изначально гражданские
        });

        alert("Учетная запись успешно создана!");
        closeModal('registerModal');
    } catch (error) {
        if(error.code === 'auth/email-already-in-use') alert("Этот сотрудник уже зарегистрирован!");
        else alert("Ошибка регистрации: " + error.message);
    }
}

async function handleLogin() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    if(!email.endsWith('@sssr.gov')) return alert("Допускаются только гос. домены @sssr.gov");

    try {
        // Вход через Firebase Auth
        await signInWithEmailAndPassword(auth, email, password);
        alert("Вход выполнен успешно!");
        closeModal('loginModal');
    } catch (error) {
        alert("Ошибка входа: неверная почта или пароль.");
    }
}

function handleLogout() {
    signOut(auth).then(() => {
        alert("Вы вышли из системы.");
        switchTab('mainTab');
    }).catch((error) => {
        alert("Ошибка при выходе: " + error.message);
    });
}

// === УПРАВЛЕНИЕ РАНГАМИ И СОТРУДНИКАМИ (FIREBASE) ===

// Выдача ранга (поиск пользователя по почте и обновление документа)
async function handleAssignRank() {
    const targetEmail = document.getElementById('rankTargetEmail').value;
    const newRank = document.getElementById('rankTargetValue').value;

    if(!targetEmail) return alert("Введите почту сотрудника!");

    try {
        // Ищем пользователя в Firestore по почте
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", targetEmail));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
            alert("Сотрудник с такой почтой не найден. Сначала он должен зарегистрироваться.");
            return;
        }

        // Обновляем ранг найденному пользователю
        querySnapshot.forEach(async (document) => {
            await updateDoc(doc(db, "users", document.id), {
                rank: newRank
            });
        });

        alert(`Звание "${newRank}" успешно утверждено для ${targetEmail}`);
        
        // Перерисовываем таблицу и обновляем свои права, если изменили ранг себе
        renderEmployees();
        if(currentUser && currentUser.email === targetEmail) {
            currentUser.rank = newRank;
            updateAuthUI(currentUser);
        }

    } catch (error) {
        alert("Ошибка при выдаче звания: " + error.message);
    }
}

// Загрузка всех сотрудников из Firebase в таблицу
async function renderEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    if (!currentUser || rolePermissions[currentUser.rank]?.isCivilian) return; // Гражданским не грузим

    tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center">Загрузка данных личного состава...</td></tr>';

    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';
        
        querySnapshot.forEach((doc) => {
            const u = doc.data();
            const isAdmin = rolePermissions[u.rank]?.isFull;
            tbody.innerHTML += `
                <tr>
                    <td class="px-6 py-4 font-medium">${u.email}</td>
                    <td class="px-6 py-4">${u.rank}</td>
                    <td class="px-6 py-4"><span class="px-2 py-1 text-xs rounded ${isAdmin ? 'bg-orange-100 text-orange-800 font-bold' : 'bg-gray-100'}">${isAdmin ? 'Управление' : 'Сотрудник'}</span></td>
                </tr>
            `;
        });
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Ошибка базы данных. Проверьте правила Firestore.</td></tr>`;
    }
}

// === ОСТАЛЬНЫЕ ФУНКЦИИ ИНТЕРФЕЙСА ===

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(tabId).classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-blue-900', 'border-orange-500');
        btn.classList.add('text-gray-600', 'border-transparent');
    });
    let btn = document.getElementById('btn-' + tabId);
    if(btn) {
        btn.classList.add('text-blue-900', 'border-orange-500');
        btn.classList.remove('text-gray-600', 'border-transparent');
    }
}

function openPage(pageId) {
    const page = mockPages[pageId];
    if (!page) return alert("Страница еще не заполнена!");
    document.getElementById('pageViewTitle').innerText = page.title;
    document.getElementById('pageViewContent').innerText = page.content;
    document.getElementById('sitemapDropdown').classList.add('hidden');
    document.getElementById('sitemapChevron').classList.remove('rotate-180');
    switchTab('pageTab');
}

function updateAuthUI(user) {
    const p = rolePermissions[user?.rank] || rolePermissions['Гражданин']; 
    document.getElementById('guestMenu').classList.toggle('hidden', !!user); 
    document.getElementById('userMenu').classList.toggle('hidden', !user); 
    document.getElementById('btn-employeesTab').classList.toggle('hidden', p.isCivilian); 
    document.getElementById('btn-adminTab').classList.toggle('hidden', !(p.canManageRanks || p.canPost)); 
    
    if(user) { 
        document.getElementById('navUsername').innerText = user.email.split('@')[0]; 
        document.getElementById('navRole').innerText = user.rank; 
    } else {
        switchTab('mainTab'); 
    }
    renderPosts(); 
    renderRecommendations(); 
}

function renderRecommendations() {
    const grid = document.getElementById('recommendationsGrid');
    grid.innerHTML = '';
    mockRecommendations.forEach(rec => {
        const isAdmin = currentUser && rolePermissions[currentUser.rank]?.isFull;
        const el = document.createElement('div');
        el.className = "bg-white rounded shadow overflow-hidden relative group cursor-pointer hover:shadow-lg transition";
        el.onclick = (e) => { if(!e.target.closest('button')) openPage(rec.id); };
        el.innerHTML = `
            <div class="h-32 bg-gradient-to-r ${rec.bg} p-4 flex items-end justify-between">
                <h4 class="text-white font-bold text-lg w-4/5">${rec.title}</h4>
                ${isAdmin ? `<button onclick="deleteRecommendation('${rec.id}')" class="text-white bg-black/30 hover:bg-red-500 px-2 py-1 rounded text-xs z-10 relative">Удалить</button>` : ''}
            </div>
            <div class="p-4 text-xs text-gray-600">${rec.desc}</div>
        `;
        grid.appendChild(el);
    });
}

function renderStats() { document.getElementById('stat-events').innerText = mockStats.events; document.getElementById('stat-fires').innerText = mockStats.fires; document.getElementById('stat-saved').innerText = mockStats.saved; document.getElementById('stat-buildings').innerText = mockStats.buildings; }
function renderPosts() { const grid = document.getElementById('newsGrid'); grid.innerHTML = ''; mockPosts.forEach(post => { const showDel = currentUser && rolePermissions[currentUser.rank]?.isFull; grid.innerHTML += `<div class="bg-white rounded shadow border border-gray-100"> <div class="p-4 bg-gray-900 text-white h-28 flex flex-col justify-between"><div class="text-xs text-gray-400">${post.date}</div><h4 class="font-bold text-sm line-clamp-2">${post.title}</h4></div><div class="p-4 text-xs text-gray-600">${post.content}</div>${showDel ? `<div class="p-2 border-t"><button onclick="deletePost('${post.id}')" class="text-red-500 text-xs">Удалить</button></div>` : ''}</div>`; }); }
function renderLaws() { const c = document.getElementById('lawsContainer'); c.innerHTML = ''; lawsDatabase.forEach(law => { c.innerHTML += `<div class="law-item border p-4 rounded-lg bg-gray-50"><h4 class="font-bold text-blue-900 text-sm mb-1">Статья ${law.id}. ${law.title}</h4><p class="text-xs text-gray-700">${law.text}</p></div>`; }); }
function searchLaws() { const q = document.getElementById('lawSearch').value.toLowerCase(); document.querySelectorAll('.law-item').forEach(i => i.style.display = i.innerText.toLowerCase().includes(q) ? 'block' : 'none'); }
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }
function handleCreatePost() { mockPosts.unshift({id: Date.now().toString(), category: document.getElementById('postCategory').value, title: document.getElementById('postTitle').value, content: document.getElementById('postContent').value, date: new Date().toLocaleDateString('ru')}); renderPosts(); switchTab('mainTab'); }
function handleUpdateStats() { mockStats.events = document.getElementById('opsEvents').value || mockStats.events; mockStats.fires = document.getElementById('opsFires').value || mockStats.fires; mockStats.saved = document.getElementById('opsSaved').value || mockStats.saved; mockStats.buildings = document.getElementById('opsBuildings').value || mockStats.buildings; renderStats(); switchTab('mainTab'); }
function deletePost(id) { mockPosts = mockPosts.filter(p => p.id !== id); renderPosts(); }
function loadPageForEdit() { document.getElementById('pageEditorContent').value = mockPages[document.getElementById('pageSelect').value]?.content || ""; }
function handleSavePage() { mockPages[document.getElementById('pageSelect').value].content = document.getElementById('pageEditorContent').value; alert("Сохранено!"); }
function handleCreateRecommendation() { const id = document.getElementById('recId').value, t = document.getElementById('recTitle').value, d = document.getElementById('recDesc').value, c = document.getElementById('recContent').value, b = document.getElementById('recColor').value; if(!id || !t || !c) return alert("Заполните все поля!"); mockPages[id] = {title: t, content: c}; mockRecommendations.push({id, title: t, desc: d, bg: b}); renderRecommendations(); alert("Добавлено!"); }
function deleteRecommendation(id) { if(confirm("Удалить?")) { mockRecommendations = mockRecommendations.filter(r => r.id !== id); renderRecommendations(); } }

// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ЗОНУ ВИДИМОСТИ ДЛЯ HTML
Object.assign(window, { switchTab, searchLaws, openModal, closeModal, handleLogin, handleRegister, handleLogout, handleCreatePost, handleUpdateStats, handleAssignRank, deletePost, openPage, loadPageForEdit, handleSavePage, handleCreateRecommendation, deleteRecommendation });

document.addEventListener('DOMContentLoaded', init);