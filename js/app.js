import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-analytics.js";
import { getDatabase, ref, onValue, push, get, set, remove } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);

isSupported().then((yes) => {
  if (yes) { try { getAnalytics(app); } catch (e) {} }
}).catch(() => {});

const db = getDatabase(app);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n).toLocaleString("fr-HT") + " HTG";

/* ============================================================
   ADMIN CONSTANTS — TIKA
   ============================================================ */
const TIKA_NAME = "Tika";
const TIKA_PASS = "T2026";
const ADMIN_KEY = "tika_admin_logged_in";

let cart = [];
let currentUser = null;
let adminProductsUnsub = null;

/* ---------- LOADER ---------- */
window.addEventListener("load", () => {
  setTimeout(() => $("loader").classList.add("hidden"), 600);
});

/* ---------- PRODUITS (boutik piblik) ---------- */
function renderProducts() {
  const grid = $("productsGrid");
  onValue(ref(db, "products"), (snap) => {
    const data = snap.val();
    if (!data) {
      grid.innerHTML = '<p class="loading-text">Pa gen pwodwi pou kounye a.</p>';
      $("featuredProduct").innerHTML = "<p style='color:var(--muted)'>Boutik la ap vini byento…</p>";
      return;
    }
    const items = Object.entries(data).map(([id, p]) => ({ id, ...p }));
    grid.innerHTML = items.map((p) => `
      <div class="product-card">
        <img src="${p.image || 'https://via.placeholder.com/300x200?text=Soulye'}" alt="${p.name}" class="product-img" loading="lazy" />
        <div class="product-info">
          <h3>${p.name}</h3>
          <div class="product-price">${money(p.price)}</div>
          <p class="product-desc">${p.description || ''}</p>
          <button class="btn-add" onclick="window.addToCart('${p.id}')">➕ Ajoute nan Panye</button>
        </div>
      </div>
    `).join("");

    const featured = items[0];
    if (featured) {
      $("featuredProduct").innerHTML = `
        <img src="${featured.image}" alt="${featured.name}" style="width:100%;border-radius:14px;margin-bottom:.8rem" />
        <b>${featured.name}</b><br><span style="color:var(--cyan);font-weight:700">${money(featured.price)}</span>
      `;
    }
  });
}

/* ---------- PANYE ---------- */
window.addToCart = (id) => {
  const item = cart.find((c) => c.id === id);
  if (item) item.qty++;
  else cart.push({ id, qty: 1 });
  updateCart();
};

function updateCart() {
  $("cartCount").textContent = cart.reduce((s, c) => s + c.qty, 0);
}

function openCart() {
  const modal = $("cartModal");
  const container = $("cartItems");

  if (cart.length === 0) {
    container.innerHTML = "<p style='color:var(--muted);text-align:center;padding:1rem'>Panye ou vid.</p>";
    $("cartTotal").textContent = "0 HTG";
  } else {
    get(ref(db, "products")).then((snap) => {
      const all = snap.val() || {};
      let total = 0;
      container.innerHTML = cart.map((c) => {
        const p = all[c.id];
        if (!p) return "";
        total += p.price * c.qty;
        return `
          <div class="cart-item">
            <img src="${p.image}" alt="${p.name}" />
            <div class="cart-item-info"><b>${p.name}</b><small>${c.qty} × ${money(p.price)}</small></div>
            <button onclick="window.removeFromCart('${c.id}')">Retire</button>
          </div>
        `;
      }).join("");
      $("cartTotal").textContent = money(total);
    });
  }
  modal.classList.add("open");
}

window.removeFromCart = (id) => {
  cart = cart.filter((c) => c.id !== id);
  updateCart();
  openCart();
};

/* ---------- CHECKOUT ---------- */
$("checkoutForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const status = $("checkoutStatus");
  status.style.display = "block";

  if (cart.length === 0) {
    status.textContent = "Panye ou vid.";
    return;
  }

  if (!currentUser) {
    status.textContent = "Ou dwe konekte anvan ou kòmande.";
    return;
  }

  const form = new FormData(e.target);
  const order = {
    userId: currentUser.uid,
    userEmail: currentUser.email,
    items: cart,
    fullName: form.get("fullName"),
    phone: form.get("phone"),
    city: form.get("city"),
    zone: form.get("zone"),
    address: form.get("address"),
    payment: form.get("payment"),
    status: "pending",
    createdAt: Date.now(),
  };

  const pSnap = await get(ref(db, "products"));
  const all = pSnap.val() || {};
  order.total = cart.reduce((s, c) => s + (all[c.id]?.price || 0) * c.qty, 0);

  await push(ref(db, "orders"), order);
  status.textContent = "✅ Kòmand ou resevwa! Nou pral kontakte w pou peman ak livrezon.";
  cart = [];
  updateCart();
  setTimeout(() => {
    $("cartModal").classList.remove("open");
    status.style.display = "none";
  }, 3000);
});

/* ---------- AUTH KLIYAN ---------- */
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  $("authBtn").textContent = user ? "Kont" : "Konekte";
});

$("authBtn").addEventListener("click", () => {
  if (currentUser) {
    if (confirm("Ou vle dekonekte?")) signOut(auth);
    return;
  }
  $("authModal").classList.add("open");
});

$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const status = $("loginStatus");
  status.style.display = "block";
  try {
    await signInWithEmailAndPassword(auth, f.get("email"), f.get("password"));
    status.textContent = "✅ Konekte!";
    setTimeout(() => $("authModal").classList.remove("open"), 800);
  } catch (err) {
    status.textContent = "Erè: " + (err.message || "Impossible");
  }
});

$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const status = $("signupStatus");
  status.style.display = "block";
  try {
    const cred = await createUserWithEmailAndPassword(auth, f.get("email"), f.get("password"));
    await updateProfile(cred.user, { displayName: f.get("name") });
    status.textContent = "✅ Kont kreye!";
    setTimeout(() => $("authModal").classList.remove("open"), 800);
  } catch (err) {
    status.textContent = "Erè: " + (err.message || "Impossible");
  }
});

/* ---------- CONTACT ---------- */
$("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = `Non: ${f.get("name")}\nTelefòn: ${f.get("phone")}\nMesaj: ${f.get("message")}`;
  window.location.href = `mailto:guepiplis@gmail.com?subject=Mesaj TIKA MARCHE&body=${encodeURIComponent(body)}`;
  $("contactStatus").textContent = "Ap ouvri aplikasyon email ou…";
  $("contactStatus").style.display = "block";
});

/* ============================================================
   SETTINGS / ADMIN (TIKA)
   ============================================================ */

function isAdminLoggedIn() {
  try { return localStorage.getItem(ADMIN_KEY) === "1"; } catch (e) { return false; }
}

function setAdminLoggedIn(v) {
  try {
    if (v) localStorage.setItem(ADMIN_KEY, "1");
    else localStorage.removeItem(ADMIN_KEY);
  } catch (e) {}
}

function showAdminPanel() {
  $("adminLoginSection").style.display = "none";
  $("adminPanelSection").style.display = "block";
  loadAdminProducts();
}

function showAdminLogin() {
  $("adminLoginSection").style.display = "block";
  $("adminPanelSection").style.display = "none";
}

// Ouvèti settings modal
$("settingsBtn").addEventListener("click", () => {
  $("settingsModal").classList.add("open");
  if (isAdminLoggedIn()) {
    showAdminPanel();
  } else {
    showAdminLogin();
  }
});

$("closeSettings").addEventListener("click", () => {
  $("settingsModal").classList.remove("open");
});

// Login Tika
$("adminLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const name = (f.get("name") || "").trim();
  const password = (f.get("password") || "").trim();
  const status = $("adminLoginStatus");
  status.style.display = "block";

  if (name === TIKA_NAME && password === TIKA_PASS) {
    setAdminLoggedIn(true);
    status.style.background = "rgba(34,211,238,.1)";
    status.style.borderColor = "rgba(34,211,238,.35)";
    status.style.color = "#bdf0fb";
    status.textContent = "✅ Byenveni Tika!";
    setTimeout(() => {
      showAdminPanel();
      status.style.display = "none";
      e.target.reset();
    }, 600);
  } else {
    status.style.background = "rgba(255,71,87,.15)";
    status.style.borderColor = "rgba(255,71,87,.4)";
    status.style.color = "#ff8a95";
    status.textContent = "❌ Non oswa modpas pa kòrèk.";
  }
});

// Logout
$("adminLogoutBtn").addEventListener("click", () => {
  setAdminLoggedIn(false);
  showAdminLogin();
  $("adminLoginForm").reset();
  $("adminLoginStatus").style.display = "none";
  if (adminProductsUnsub) { adminProductsUnsub(); adminProductsUnsub = null; }
});

// Add product
$("addProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const file = f.get("image");
  const status = $("addProductStatus");
  status.style.display = "block";

  if (!file || !file.size) {
    status.style.background = "rgba(255,71,87,.15)";
    status.style.borderColor = "rgba(255,71,87,.4)";
    status.style.color = "#ff8a95";
    status.textContent = "⚠️ Chwazi yon imaj pou pwodwi a.";
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    status.style.background = "rgba(255,71,87,.15)";
    status.style.borderColor = "rgba(255,71,87,.4)";
    status.style.color = "#ff8a95";
    status.textContent = "⚠️ Imaj twò gwo (maks 3 MB). Chwazi yon imaj pi piti.";
    return;
  }

  status.style.background = "rgba(34,211,238,.1)";
  status.style.borderColor = "rgba(34,211,238,.35)";
  status.style.color = "#bdf0fb";
  status.textContent = "⏳ Ap trete imaj la…";

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const product = {
        name: (f.get("name") || "").trim(),
        price: Number(f.get("price")),
        description: (f.get("description") || "").trim(),
        image: reader.result,
        createdAt: Date.now(),
      };
      await push(ref(db, "products"), product);
      status.textContent = "✅ Pwodwi ajoute! Li parèt nan boutik la kounye a.";
      e.target.reset();
      setTimeout(() => (status.style.display = "none"), 3000);
    } catch (err) {
      status.style.background = "rgba(255,71,87,.15)";
      status.style.borderColor = "rgba(255,71,87,.4)";
      status.style.color = "#ff8a95";
      status.textContent = "❌ Erè: " + (err.message || "Pa ka ajoute");
    }
  };
  reader.readAsDataURL(file);
});

// Load admin products list
function loadAdminProducts() {
  if (adminProductsUnsub) adminProductsUnsub();
  const container = $("adminProductsList");
  container.innerHTML = '<p class="settings-empty">Ap chaje…</p>';

  adminProductsUnsub = onValue(ref(db, "products"), (snap) => {
    const data = snap.val();
    if (!data) {
      container.innerHTML = '<p class="settings-empty">Pa gen pwodwi ankò. Ajoute yon sèl anwo a.</p>';
      return;
    }
    container.innerHTML = Object.entries(data).map(([id, p]) => `
      <div class="admin-product">
        <img src="${p.image || 'https://via.placeholder.com/60'}" alt="${p.name}" />
        <div class="admin-product-info">
          <b>${p.name}</b>
          <small>${money(p.price)}</small>
        </div>
        <div class="actions">
          <button class="btn-edit" onclick="window.editProductPrice('${id}', ${p.price})" title="Chanje pri">💰</button>
          <button class="btn-del" onclick="window.deleteProductById('${id}')" title="Efase">🗑</button>
        </div>
      </div>
    `).join("");
  });
}

window.editProductPrice = async (id, oldPrice) => {
  const newPrice = prompt("Nouvo pri an HTG:", oldPrice);
  if (newPrice === null) return;
  const num = Number(newPrice);
  if (isNaN(num) || num < 0) {
    alert("Pri pa valid. Antre yon chif pozitif.");
    return;
  }
  await set(ref(db, "products/" + id + "/price"), num);
};

window.deleteProductById = async (id) => {
  if (confirm("Efase pwodwi sa nèt? Ou p ap ka retounen.")) {
    await remove(ref(db, "products/" + id));
  }
};

/* ---------- NAV / UI ---------- */
$("burger").addEventListener("click", () => $("navLinks").classList.toggle("open"));
$("cartBtn").addEventListener("click", openCart);
$("closeCart").addEventListener("click", () => $("cartModal").classList.remove("open"));
$("closeAuth").addEventListener("click", () => $("authModal").classList.remove("open"));

document.querySelectorAll(".auth-tabs button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".auth-tabs button").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
    document.querySelectorAll(".auth-form").forEach((f) => f.classList.remove("active"));
    $(b.dataset.tab + "Form").classList.add("active");
  });
});

$("year").textContent = new Date().getFullYear();

/* ---------- HASH ROUTING (#settings) ---------- */
if (location.hash === "#settings") {
  setTimeout(() => $("settingsBtn").click(), 800);
}

renderProducts();
