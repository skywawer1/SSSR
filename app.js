import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc, addDoc, deleteDoc, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let currentUser = null;

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

// === ИНИЦИАЛИЗАЦИЯ ===
function init() {
    const btn = document.getElementById('sitemapToggle'), menu = document.getElementById('sitemapDropdown'), chev = document.getElementById('sitemapChevron');
    btn.addEventListener('click', (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); chev.classList.toggle('rotate-180'); });
    document.addEventListener('click', () => { menu.classList.add('hidden'); chev.classList.remove('rotate-180'); });

    renderLaws(); 
    renderStats(); 
    renderPosts(); 
    renderRecommendations();
    loadPageForEdit();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            let userRank = 'Гражданин'; 
            
            if (docSnap.exists()) {
                userRank = docSnap.data().rank || 'Гражданин';
            } else {
                await setDoc(doc(db, "users", user.uid), { email: user.email, rank: 'Гражданин' });
            }
            
            currentUser = { email: user.email, rank: userRank, uid: user.uid };
            updateAuthUI(currentUser);
            renderEmployees(); 
        } else {
            currentUser = null;
            updateAuthUI(null);
        }
    });
}

// === АВТОРИЗАЦИЯ ===
async function handleRegister() {
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;

    if(!email.endsWith('@sssr.gov')) return alert("Формат почты: name@sssr.gov");
    if(password.length < 6) return alert("Пароль должен быть минимум 6 символов!");
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await setDoc(doc(db, "users", user.uid), { email: email, rank: 'Гражданин' });
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

// === УПРАВЛЕНИЕ РАНГАМИ И СОТРУДНИКАМИ ===
async function handleAssignRank() {
    const targetEmail = document.getElementById('rankTargetEmail').value;
    const newRank = document.getElementById('rankTargetValue').value;

    if(!targetEmail) return alert("Введите почту сотрудника!");
    try {
        const usersRef = collection(db, "users");
        const q = query(usersRef, where("email", "==", targetEmail));
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
            alert("Сотрудник с такой почтой не найден. Сначала он должен зарегистрироваться.");
            return;
        }

        querySnapshot.forEach(async (document) => {
            await updateDoc(doc(db, "users", document.id), { rank: newRank });
        });
        alert(`Звание "${newRank}" успешно утверждено для ${targetEmail}`);
        
        renderEmployees();
        if(currentUser && currentUser.email === targetEmail) {
            currentUser.rank = newRank;
            updateAuthUI(currentUser);
        }
    } catch (error) {
        alert("Ошибка при выдаче звания: " + error.message);
    }
}

async function renderEmployees() {
    const tbody = document.getElementById('employeesTableBody');
    if (!currentUser || rolePermissions[currentUser.rank]?.isCivilian) return; 

    tbody.innerHTML = '<tr><td colspan="3" class="px-6 py-4 text-center">Загрузка данных личного состава...</td></tr>';
    try {
        const querySnapshot = await getDocs(collection(db, "users"));
        tbody.innerHTML = '';
        querySnapshot.forEach((docSnap) => {
            const u = docSnap.data();
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
        tbody.innerHTML = `<tr><td colspan="3" class="px-6 py-4 text-center text-red-500">Ошибка базы данных.</td></tr>`;
    }
}

// === ИНТЕРФЕЙС ===
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

function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// === ДИНАМИЧЕСКИЕ ДАННЫЕ ИЗ FIREBASE ===

async function renderStats() {
    try {
        const docSnap = await getDoc(doc(db, "globals", "stats"));
        let stats = { events: 0, fires: 0, saved: 0, buildings: 0 };
        if (docSnap.exists()) stats = docSnap.data();
        
        document.getElementById('stat-events').innerText = stats.events; 
        document.getElementById('stat-fires').innerText = stats.fires; 
        document.getElementById('stat-saved').innerText = stats.saved; 
        document.getElementById('stat-buildings').innerText = stats.buildings;
    } catch(e) { console.error(e); }
}

async function handleUpdateStats() {
    const events = document.getElementById('opsEvents').value || "0";
    const fires = document.getElementById('opsFires').value || "0";
    const saved = document.getElementById('opsSaved').value || "0";
    const buildings = document.getElementById('opsBuildings').value || "0";
    
    await setDoc(doc(db, "globals", "stats"), { events, fires, saved, buildings });
    renderStats(); 
    switchTab('mainTab'); 
}

async function renderPosts() { 
    const grid = document.getElementById('newsGrid'); 
    grid.innerHTML = '';
    try {
        const q = query(collection(db, "posts"), orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach(docSnap => {
            const post = docSnap.data();
            const showDel = currentUser && rolePermissions[currentUser.rank]?.isFull; 
            grid.innerHTML += `<div class="bg-white rounded shadow border border-gray-100"> <div class="p-4 bg-gray-900 text-white h-28 flex flex-col justify-between"><div class="text-xs text-gray-400">${post.date}</div><h4 class="font-bold text-sm line-clamp-2">${post.title}</h4></div><div class="p-4 text-xs text-gray-600">${post.content}</div>${showDel ? `<div class="p-2 border-t"><button onclick="deletePost('${docSnap.id}')" class="text-red-500 text-xs">Удалить</button></div>` : ''}</div>`; 
        });
    } catch(e) { console.error(e); }
}

async function handleCreatePost() { 
    const cat = document.getElementById('postCategory').value;
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    if(!title || !content) return alert("Заполните поля!");

    await addDoc(collection(db, "posts"), {
        category: cat,
        title: title, 
        content: content, 
        date: new Date().toLocaleDateString('ru'),
        timestamp: serverTimestamp()
    }); 
    renderPosts(); 
    switchTab('mainTab'); 
}

async function deletePost(id) { 
    if(confirm("Удалить?")) {
        await deleteDoc(doc(db, "posts", id)); 
        renderPosts(); 
    }
}

async function renderRecommendations() {
    const grid = document.getElementById('recommendationsGrid');
    grid.innerHTML = '';
    try {
        const querySnapshot = await getDocs(collection(db, "recommendations"));
        querySnapshot.forEach(docSnap => {
            const rec = docSnap.data();
            const isAdmin = currentUser && rolePermissions[currentUser.rank]?.isFull;
            const el = document.createElement('div');
            el.className = "bg-white rounded shadow overflow-hidden relative group cursor-pointer hover:shadow-lg transition";
            el.onclick = (e) => { if(!e.target.closest('button')) openPage(docSnap.id); };
            el.innerHTML = `
                <div class="h-32 bg-gradient-to-r ${rec.bg} p-4 flex items-end justify-between">
                    <h4 class="text-white font-bold text-lg w-4/5">${rec.title}</h4>
                    ${isAdmin ? `<button onclick="deleteRecommendation('${docSnap.id}')" class="text-white bg-black/30 hover:bg-red-500 px-2 py-1 rounded text-xs z-10 relative">Удалить</button>` : ''}
                </div>
                <div class="p-4 text-xs text-gray-600">${rec.desc}</div>
            `;
            grid.appendChild(el);
        });
    } catch(e) { console.error(e); }
}

async function handleCreateRecommendation() { 
    const id = document.getElementById('recId').value, t = document.getElementById('recTitle').value, d = document.getElementById('recDesc').value, c = document.getElementById('recContent').value, b = document.getElementById('recColor').value;
    if(!id || !t || !c) return alert("Заполните все поля!"); 
    
    await setDoc(doc(db, "pages", id), { title: t, content: c }, { merge: true });
    await setDoc(doc(db, "recommendations", id), { title: t, desc: d, bg: b }); 
    
    renderRecommendations(); 
    alert("Добавлено!"); 
}

async function deleteRecommendation(id) { 
    if(confirm("Удалить?")) { 
        await deleteDoc(doc(db, "recommendations", id)); 
        renderRecommendations(); 
    } 
}

async function openPage(pageId) {
    document.getElementById('pageViewTitle').innerText = "Загрузка...";
    document.getElementById('pageViewContent').innerText = "";
    document.getElementById('sitemapDropdown').classList.add('hidden');
    const chev = document.getElementById('sitemapChevron');
    if(chev) chev.classList.remove('rotate-180');
    switchTab('pageTab');

    try {
        const docSnap = await getDoc(doc(db, "pages", pageId));
        if (docSnap.exists()) {
            document.getElementById('pageViewTitle').innerText = docSnap.data().title || pageId;
            document.getElementById('pageViewContent').innerText = docSnap.data().content;
        } else {
            document.getElementById('pageViewTitle').innerText = "Страница пуста";
            document.getElementById('pageViewContent').innerText = "Заполните её текст через Админ-панель.";
        }
    } catch(e) { console.error(e); }
}

async function loadPageForEdit() { 
    const pageId = document.getElementById('pageSelect').value;
    try {
        const docSnap = await getDoc(doc(db, "pages", pageId));
        document.getElementById('pageEditorContent').value = docSnap.exists() ? (docSnap.data().content || "") : ""; 
    } catch(e) { console.error(e); }
}

async function handleSavePage() { 
    const pageId = document.getElementById('pageSelect').value;
    const content = document.getElementById('pageEditorContent').value;
    await setDoc(doc(db, "pages", pageId), { content: content }, { merge: true });
    alert("Сохранено!"); 
}

async function renderLaws() { 
    const c = document.getElementById('lawsContainer'); 
    c.innerHTML = '';
    try {
        const querySnapshot = await getDocs(collection(db, "laws"));
        if(querySnapshot.empty) {
            // Если база законов пустая, добавляем дефолтные для старта
            const defaultLaws = [
                { id: "1.1", title: "Против хищения имущества", text: "Хищением признается тайное или открытое (грабеж) присвоение имущества..." },
                { id: "1.2", title: "Против государственной измены и мятежа", text: "Под запретом находятся организация, участие или публичная агитация..." }
            ];
            for(let l of defaultLaws) { await setDoc(doc(db, "laws", l.id), l); }
            renderLaws(); return;
        }
        querySnapshot.forEach(docSnap => { 
            const law = docSnap.data();
            c.innerHTML += `<div class="law-item border p-4 rounded-lg bg-gray-50"><h4 class="font-bold text-blue-900 text-sm mb-1">Статья ${law.id || docSnap.id}. ${law.title}</h4><p class="text-xs text-gray-700">${law.text}</p></div>`; 
        });
    } catch(e) { console.error(e); }
}

function searchLaws() { 
    const q = document.getElementById('lawSearch').value.toLowerCase(); 
    document.querySelectorAll('.law-item').forEach(i => i.style.display = i.innerText.toLowerCase().includes(q) ? 'block' : 'none'); 
}

// ЭКСПОРТ ФУНКЦИЙ В ГЛОБАЛЬНУЮ ЗОНУ ВИДИМОСТИ ДЛЯ HTML
Object.assign(window, { switchTab, searchLaws, openModal, closeModal, handleLogin, handleRegister, handleLogout, handleCreatePost, handleUpdateStats, handleAssignRank, deletePost, openPage, loadPageForEdit, handleSavePage, handleCreateRecommendation, deleteRecommendation });
document.addEventListener('DOMContentLoaded', init);
