import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, setDoc, doc, addDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// === ЗАМЕНИТЕ НА ВАШИ ПАРАМЕТРЫ ИЗ ПРОЕКТА FIREBASE ===
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let userRank = 'Гражданин';

// === КОНТРОЛЬ ДОСТУПА ПО ЗВАНИЯМ ИЗ ВАШЕГО ТЗ ===
const rolePermissions = {
    'Ген.сек': { adminPanel: true, canPost: true, canRank: true, canDelete: true, editPages: true, editStats: true },
    'Секретарь ЦК СПШ': { adminPanel: true, canPost: true, canRank: true, canDelete: true, editPages: true, editStats: true },
    'Верховный совет': { adminPanel: true, canPost: true, canRank: false, canDelete: false, editPages: false, editStats: false },
    'Издатель газет': { adminPanel: true, canPost: true, canRank: false, canDelete: false, editPages: false, editStats: false },
    'Нарком ВЧК (Тайная полиция)': { adminPanel: true, canPost: true, canRank: true, canDelete: true, editPages: false, editStats: true },
    'Нарком.Пром': { adminPanel: true, canPost: true, canRank: true, canDelete: false, editPages: false, editStats: false },
    'Нарком.Строительства': { adminPanel: true, canPost: true, canRank: true, canDelete: false, editPages: false, editStats: false },
    'ВЧК (Тайная полиция)': { adminPanel: false, canPost: false, canRank: false, canDelete: false, editPages: false, editStats: false },
    'Строители': { adminPanel: false, canPost: false, canRank: false, canDelete: false, editPages: false, editStats: false },
    'Гражданин': { adminPanel: false, canPost: false, canRank: false, canDelete: false, editPages: false, editStats: false }
};

// === ИНИЦИАЛИЗАЦИЯ И СЛУШАТЕЛЬ СЕССИИ ===
function init() {
    onAuthStateChanged(auth, async (user) => {
        const authContainer = document.getElementById('authContainer');
        if (user) {
            currentUser = user;
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userRank = userDoc.exists() ? (userDoc.data().rank || 'Гражданин') : 'Гражданин';

            authContainer.innerHTML = `
                <div class="flex items-center gap-3 bg-slate-900 border border-slate-800/60 px-3 py-1.5 rounded">
                    <div class="text-right">
                        <div class="text-[10px] text-gray-500 font-mono">${user.email}</div>
                        <div class="text-[11px] font-bold text-amber-400">[${userRank}]</div>
                    </div>
                    <button onclick="handleLogout()" class="bg-red-950/60 border border-red-950 text-red-400 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded hover:bg-red-900 hover:text-white transition">Выход</button>
                </div>`;
        } else {
            currentUser = null;
            userRank = 'Гражданин';
            authContainer.innerHTML = `<button onclick="openModal('loginModal')" class="bg-blue-600 text-white px-4 py-1.5 rounded text-xs font-bold uppercase tracking-wider hover:bg-blue-500 transition shadow-md shadow-blue-950/50">Войти в терминал</button>`;
        }
        applyPermissions();
        renderStats();
        renderPosts();
        renderRecommendations();
        renderLaws();
    });
}

function applyPermissions() {
    const perms = rolePermissions[userRank] || rolePermissions['Гражданин'];
    document.getElementById('navAdminBtn').style.display = perms.adminPanel ? 'block' : 'none';
    document.getElementById('admNews').style.display = perms.canPost ? 'block' : 'none';
    document.getElementById('admStats').style.display = perms.editStats ? 'block' : 'none';
    document.getElementById('admPages').style.display = perms.editPages ? 'block' : 'none';
    document.getElementById('admRecs').style.display = perms.editPages ? 'block' : 'none';
    document.getElementById('admRanks').style.display = perms.canRank ? 'block' : 'none';
}

// === ЦЕНТРАЛЬНАЯ ОПЕРАТИВНАЯ СВОДКА (СТАТИСТИКА) ===
async function renderStats() {
    const docSnap = await getDoc(doc(db, "globals", "stats"));
    if (docSnap.exists()) {
        const stats = docSnap.data();
        document.getElementById('stat-events').innerText = stats.events || "0";
        document.getElementById('stat-fires').innerText = stats.fires || "0";
        document.getElementById('stat-saved').innerText = stats.saved || "0";
        document.getElementById('stat-buildings').innerText = stats.buildings || "0";
        
        // Предзаполнение полей в админке для удобства
        if(document.getElementById('opsEvents')) {
            document.getElementById('opsEvents').value = stats.events || 0;
            document.getElementById('opsFires').value = stats.fires || 0;
            document.getElementById('opsSaved').value = stats.saved || 0;
            document.getElementById('opsBuildings').value = stats.buildings || 0;
        }
    }
}

async function handleUpdateStats() {
    await setDoc(doc(db, "globals", "stats"), {
        events: document.getElementById('opsEvents').value || "0",
        fires: document.getElementById('opsFires').value || "0",
        saved: document.getElementById('opsSaved').value || "0",
        buildings: document.getElementById('opsBuildings').value || "0"
    }, { merge: true });
    alert("Данные оперативной сводки успешно синхронизированы с базой!");
    renderStats();
    switchTab('mainTab');
}

// === ВЕДОМСТВЕННАЯ ЛЕНТА НОВОСТЕЙ ===
async function renderPosts() {
    const grid = document.getElementById('newsGrid');
    grid.innerHTML = '<p class="text-xs text-gray-500 font-mono">Считывание архивов ленты...</p>';
    
    const querySnapshot = await getDocs(query(collection(db, "posts"), orderBy("timestamp", "desc")));
    grid.innerHTML = '';
    
    if(querySnapshot.empty) {
        grid.innerHTML = '<p class="text-xs text-gray-500 italic col-span-2">Официальных записей за текущий период не обнаружено.</p>';
        return;
    }

    querySnapshot.forEach(docSnap => {
        const post = docSnap.data();
        const showDel = rolePermissions[userRank]?.canDelete;
        grid.innerHTML += `
            <div class="bg-slate-900 rounded border border-slate-800/80 shadow-xl flex flex-col justify-between overflow-hidden animate-fadeIn"> 
                <div>
                    <div class="p-4 bg-slate-950/60 border-b border-slate-800 flex justify-between items-start gap-4">
                        <div>
                            <span class="text-[9px] bg-blue-950 text-blue-400 font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-blue-900/40">${post.category || 'ЧС'}</span>
                            <h4 class="font-extrabold text-sm text-white mt-2 leading-snug">${post.title}</h4>
                        </div>
                        <span class="text-[10px] font-mono text-gray-500 whitespace-nowrap">${post.date}</span>
                    </div>
                    <div class="p-4 text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">${post.content}</div>
                </div>
                ${showDel ? `
                <div class="p-2.5 bg-slate-950/40 border-t border-slate-800/60 text-right">
                    <button onclick="deletePost('${docSnap.id}')" class="text-rose-500 text-[10px] uppercase tracking-wider font-bold hover:text-rose-400 transition">Аннулировать запись ✕</button>
                </div>` : ''}
            </div>`;
    });
}

async function handleCreatePost() {
    const cat = document.getElementById('postCategory').value;
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;

    if(!title || !content) return alert("Заполните тему и текст записи!");

    await addDoc(collection(db, "posts"), {
        category: cat || "Сводка",
        title: title,
        content: content,
        date: new Date().toLocaleDateString('ru-RU'),
        timestamp: serverTimestamp()
    });

    document.getElementById('postCategory').value = '';
    document.getElementById('postTitle').value = '';
    document.getElementById('postContent').value = '';

    renderPosts();
    switchTab('mainTab');
}

async function deletePost(id) {
    if (confirm("Вы подтверждаете безвозвратное исключение записи из базы данных?")) {
        await deleteDoc(doc(db, "posts", id));
        renderPosts();
    }
}

// === УГОЛОВНЫЙ КОДЕКС (ЗАКОНОДАТЕЛЬСТВО) С ФИЛЬТРОМ ===
async function renderLaws() {
    const c = document.getElementById('lawsContainer');
    c.innerHTML = '<p class="text-xs text-gray-500 font-mono">Извлечение статей кодекса...</p>';
    
    const snapshot = await getDocs(collection(db, "laws"));
    c.innerHTML = '';
    
    if(snapshot.empty) {
        // Локальный бэкап базовых статей, если коллекция пуста в Firebase
        const defaultLaws = [
            { id: "1.1", title: "Против хищения имущества", text: "Хищением признается тайное или открытое присвоение имущества, принадлежащего Королевству, его институтам или другому игроку. Наказывается заключением от 2 до 5 лет." },
            { id: "1.2", title: "Против государственной измены и мятежа", text: "Под запретом находятся организация, участие или публичная агитация в пользу движений, направленных на свержение власти." }
        ];
        for (let l of defaultLaws) {
            await setDoc(doc(db, "laws", l.id), { title: l.title, text: l.text });
        }
        renderLaws();
        return;
    }

    snapshot.forEach(docSnap => {
        const law = docSnap.data();
        c.innerHTML += `
            <div class="law-item border border-slate-800 p-5 rounded bg-slate-900 shadow-lg transition duration-200 hover:border-slate-700">
                <h4 class="font-bold text-amber-400 text-sm mb-2 tracking-wide">Статья ${docSnap.id}. ${law.title}</h4>
                <p class="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">${law.text}</p>
            </div>`;
    });
}

function searchLaws() {
    const q = document.getElementById('lawSearch').value.toLowerCase();
    document.querySelectorAll('.law-item').forEach(i => {
        i.style.display = i.innerText.toLowerCase().includes(q) ? 'block' : 'none';
    });
}

// === ВЫПАДАЮЩИЕ ИНФОРМАЦИОННЫЕ СТРАНИЦЫ АРХИВА ===
async function openPage(pageId) {
    const titleEl = document.getElementById('pageViewTitle');
    const contentEl = document.getElementById('pageViewContent');
    titleEl.innerText = "Авторизация запроса к базе...";
    contentEl.innerText = "Извлечение текстового блока данных из зашифрованного хранилища МЧС...";
    switchTab('pageTab');

    const docSnap = await getDoc(doc(db, "pages", pageId));
    if (docSnap.exists()) {
        titleEl.innerText = docSnap.data().title || pageId;
        contentEl.innerText = docSnap.data().content || "Текстовое наполнение страницы временно отсутствует.";
    } else {
        titleEl.innerText = "Страница пуста";
        contentEl.innerText = "Запись не найдена в архивах МЧС ШССР. Администратор может заполнить её через панель управления.";
    }
    
    // Авто-закрытие меню
    document.getElementById('sitemapDropdown').classList.add('hidden');
    document.getElementById('sitemapChevron').classList.remove('rotate-180');
}

async function loadPageForEdit() {
    const pageId = document.getElementById('pageSelect').value;
    const docSnap = await getDoc(doc(db, "pages", pageId));
    document.getElementById('pageEditorContent').value = docSnap.exists() ? (docSnap.data().content || "") : "";
}

async function handleSavePage() {
    const pageId = document.getElementById('pageSelect').value;
    const text = document.getElementById('pageEditorContent').value;
    
    const titles = {
        air: "Состояние воздуха", heroes: "Герои МЧС ШССР", crisis: "Как пережить кризис",
        attack: "Действия при обстрелах", curfew: "Комендантский час", normative: "Нормативная база",
        tech: "Техническое обеспечение", architecture: "Архитектура Брутализма"
    };

    await setDoc(doc(db, "pages", pageId), {
        title: titles[pageId] || pageId,
        content: text
    }, { merge: true });
    
    alert("Контент страницы сохранен в облачную базу данных!");
}

// === КАРТОЧКИ БЫСТРОГО ИНСТРУКТАЖА (РЕКОМЕНДАЦИИ) ===
async function renderRecommendations() {
    const grid = document.getElementById('recommendationsGrid');
    grid.innerHTML = '';
    const snapshot = await getDocs(collection(db, "recommendations"));
    const isAdmin = rolePermissions[userRank]?.editPages;

    snapshot.forEach(docSnap => {
        const rec = docSnap.data();
        grid.innerHTML += `
            <div class="bg-gradient-to-br ${rec.bg || 'from-slate-900 to-slate-950'} border border-slate-800/80 text-white rounded p-4 relative shadow-md cursor-pointer transition transform hover:-translate-y-0.5 hover:border-slate-700 group/item" onclick="openPage('${docSnap.id}')">
                <h4 class="font-black text-xs uppercase tracking-wide text-amber-400 group-hover/item:text-amber-300 transition">${rec.title}</h4>
                <p class="text-[11px] text-gray-400 mt-1.5 leading-snug">${rec.desc}</p>
                ${isAdmin ? `
                <button onclick="event.stopPropagation(); deleteRecommendation('${docSnap.id}')" class="absolute top-2 right-2 text-rose-400 text-[9px] bg-slate-950 border border-slate-800 px-1.5 py-0.5 rounded hover:bg-rose-950 transition">✕</button>
                ` : ''}
            </div>`;
    });
}

async function handleCreateRecommendation() {
    const id = document.getElementById('recId').value;
    const t = document.getElementById('recTitle').value;
    const d = document.getElementById('recDesc').value;
    const c = document.getElementById('recContent').value;
    const b = document.getElementById('recColor').value;

    if (!id || !t || !c) return alert("Поля ID, Заголовок и Контент являются обязательными!");

    await setDoc(doc(db, "pages", id), { title: t, content: c }, { merge: true });
    await setDoc(doc(db, "recommendations", id), { title: t, desc: d, bg: b });
    
    alert("Карточка инструктажа добавлена в интерфейс!");
    
    document.getElementById('recId').value = '';
    document.getElementById('recTitle').value = '';
    document.getElementById('recDesc').value = '';
    document.getElementById('recContent').value = '';
    
    renderRecommendations();
}

async function deleteRecommendation(id) {
    if (confirm("Удалить данную рекомендацию из панели?")) {
        await deleteDoc(doc(db, "recommendations", id));
        renderRecommendations();
    }
}

// === УПРАВЛЕНИЕ ЛИЧНЫМ СОСТАВОМ ВЕДОМСТВА ===
async function handleAssignRank() {
    const email = document.getElementById('rankEmail').value;
    const rank = document.getElementById('rankSelect').value;
    if (!email) return alert("Введите точный Email сотрудника!");

    const snapshot = await getDocs(collection(db, "users"));
    let targetUid = null;
    snapshot.forEach(d => { if (d.data().email === email) targetUid = d.id; });

    if (targetUid) {
        await setDoc(doc(db, "users", targetUid), { rank: rank }, { merge: true });
        alert(`Приказ утвержден. Сотруднику ${email} присвоено звание: ${rank}`);
        if(currentUser && currentUser.email === email) {
            userRank = rank;
            applyPermissions();
        }
    } else {
        alert("Указанный адрес не зарегистрирован в базе данных системы.");
    }
}

// === ИНТЕРФЕЙСНЫЕ МЕТОДЫ И ОКНА ===
async function handleLogin() {
    const e = document.getElementById('authEmail').value, p = document.getElementById('authPassword').value;
    try { await signInWithEmailAndPassword(auth, e, p); closeModal('loginModal'); } 
    catch(err) { alert("Отказ в авторизации: " + err.message); }
}

async function handleRegister() {
    const e = document.getElementById('authEmail').value, p = document.getElementById('authPassword').value;
    try {
        const cred = await createUserWithEmailAndPassword(auth, e, p);
        await setDoc(doc(db, "users", cred.user.uid), { email: e, rank: "Гражданин" });
        alert("Успешная регистрация личного дела. Текущий статус: Гражданин.");
        closeModal('loginModal');
    } catch(err) { alert("Ошибка формирования дела: " + err.message); }
}

async function handleLogout() { await signOut(auth); }

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
}

function toggleDropdown(id) {
    const dropdown = document.getElementById(id);
    const chevron = document.getElementById('sitemapChevron');
    dropdown.classList.toggle('hidden');
    if(chevron) chevron.classList.toggle('rotate-180');
}

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// Публикация методов для вызова из HTML-кода
Object.assign(window, { switchTab, toggleDropdown, openPage, openModal, closeModal, searchLaws, handleLogin, handleRegister, handleLogout, handleCreatePost, handleUpdateStats, deletePost, loadPageForEdit, handleSavePage, handleCreateRecommendation, deleteRecommendation, handleAssignRank });

document.addEventListener('DOMContentLoaded', init);
