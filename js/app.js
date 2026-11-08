import { initializeApp } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-app.js";
import { getDatabase, ref, onValue, push, get, set, remove } from "https://www.gstatic.com/firebasejs/13.2.0/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n).toLocaleString("fr-HT") + " HTG";

const TIKA_NAME = "Tika";
const TIKA_PASS = "T2026";
const ADMIN_KEY = "tika_admin_logged_in";
const TIKA_WA = "50943345491";

let currentOrderProduct = null;
let adminProductsUnsub = null;

/* ---------- LOADER ---------- */
window.addEventListener("load", () => {
  setTimeout(() => $("loader").classList.add("hidden"), 600);
});

/* ---------- HELPER ---------- */
function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
}

/* ---------- PRODUCTS ---------- */
function renderProducts() {
  const grid = $("productsGrid");
  onValue(ref(db, "products"), (snap) => {
    const data = snap.val();
    if (!data) {
      grid.innerHTML = '<p class="loading-text">Pa gen pwodwi pou kounye a. Tounen byento!</p>';
      return;
    }

    const items = Object.entries(data).map(([id, p]) => ({ id, ...p }));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    grid.innerHTML = items.map((p) => {
      const deliveryBadge = p.deliveryAvailable !== false
        ? '<span class="delivery-badge available">✅ Livrezon disponib</span>'
        : '<span class="delivery-badge pickup">📍 Pase pran l' + (p.pickupLocation ? ': ' + esc(p.pickupLocation) : '') + '</span>';

      return `
        <div class="product-card">
          <div class="product-image">
            <img src="${p.image || 'https://via.placeholder.com/300x200?text=Soulye'}" alt="${esc(p.name)}" loading="lazy" />
          </div>
          <div class="product-info">
            <h3>${esc(p.name)}</h3>
            <div class="product-price">${money(p.price)}</div>
            <p class="product-desc">${esc(p.description || '')}</p>
            ${deliveryBadge}
            <button class="btn-buy" onclick="window.openOrderModal('${p.id}')">
              🛒 Achte Kounye a
            </button>
          </div>
        </div>
      `;
    }).join("");
  });
}

/* ---------- ORDER MODAL ---------- */
window.openOrderModal = function(productId) {
  get(ref(db, "products/" + productId)).then((snap) => {
    if (!snap.exists()) {
      alert("Pwodwi a pa disponib ankò.");
      return;
    }
    const product = { id: productId, ...snap.val() };
    currentOrderProduct = product;

    $("orderProductName").textContent = product.name;
    $("orderProductPrice").textContent = money(product.price);
    $("orderProductImage").src = product.image || '';
    $("orderProductImage").style.display = product.image ? 'block' : 'none';

    if (product.deliveryAvailable !== false) {
      $("orderDeliveryInfo").innerHTML = '<span class="delivery-badge available">✅ Livrezon disponib — Ranpli adrès ou anba a</span>';
    } else {
      $("orderDeliveryInfo").innerHTML = '<span class="delivery-badge pickup">📍 Pase pran l' + (product.pickupLocation ? ' nan: ' + esc(product.pickupLocation) : '') + '</span>';
    }

    $("orderForm").reset();
    $("orderStatus").style.display = "none";
    $("orderModal").classList.add("open");
  });
};

$("closeOrder").addEventListener("click", () => {
  $("orderModal").classList.remove("open");
  currentOrderProduct = null;
});

/* ---------- ORDER SUBMIT ---------- */
$("orderForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!currentOrderProduct) return;

  const form = new FormData(e.target);
  const info = {
    name: (form.get("name") || "").trim(),
    phone: (form.get("phone") || "").trim(),
    city: (form.get("city") || "").trim(),
    zone: (form.get("zone") || "").trim(),
  };

  const status = $("orderStatus");
  status.style.display = "block";

  if (!info.name || !info.phone || !info.city || !info.zone) {
    status.textContent = "Tanpri ranpli tout jaden yo.";
    status.className = "form-status error show";
    return;
  }

  const p = currentOrderProduct;
  let msg = "Bonjou Tika! Mwen enterese achte:\n\n";
  msg += "📦 " + p.name + "\n";
  msg += "💰 Pri: " + p.price + " HTG\n\n";
  msg += "📍 Enfòmasyon mwen:\n";
  msg += "👤 Non: " + info.name + "\n";
  msg += "📞 Telefòn: " + info.phone + "\n";
  msg += "🏙️ Vil: " + info.city + "\n";
  msg += "🗺️ Zòn: " + info.zone + "\n\n";

  if (p.deliveryAvailable !== false) {
    msg += "📬 Mwen vle LIVREZON nan adrès sa a.";
  } else {
    msg += "📬 Mwen pral PASE PRAN L" + (p.pickupLocation ? " nan: " + p.pickupLocation : "") + ".";
  }

  window.open("https://wa.me/" + TIKA_WA + "?text=" + encodeURIComponent(msg), "_blank");

  status.textContent = "✅ WhatsApp ap louvri... Si li pa louvri, rele +509 43 34 5491 dirèkteman.";
  status.className = "form-status success show";
});

/* ---------- SETTINGS / ADMIN ---------- */
function isAdminLoggedIn() {
  try { return localStorage.getItem(ADMIN_KEY) === "1"; } catch (e) { return false; }
}

function setAdminLoggedIn(v) {
  try {
    if (v) localStorage.setItem(ADMIN_KEY, "1");
    else localStorage.removeItem(ADMIN_KEY);
  } catch (e) {}
}

$("settingsBtn").addEventListener("click", () => {
  $("settingsModal").classList.add("open");
  if (isAdminLoggedIn()) {
    $("adminLoginSection").style.display = "none";
    $("adminPanelSection").style.display = "block";
    loadAdminProducts();
  } else {
    $("adminLoginSection").style.display = "block";
    $("adminPanelSection").style.display = "none";
  }
});

$("closeSettings").addEventListener("click", () => {
  $("settingsModal").classList.remove("open");
  if (adminProductsUnsub) { adminProductsUnsub(); adminProductsUnsub = null; }
});

$("adminLoginForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const name = (f.get("name") || "").trim();
  const pass = (f.get("password") || "").trim();
  const status = $("adminLoginStatus");
  status.style.display = "block";

  if (name === TIKA_NAME && pass === TIKA_PASS) {
    setAdminLoggedIn(true);
    status.textContent = "✅ Byenveni Tika!";
    status.className = "form-status success show";
    setTimeout(() => {
      $("adminLoginSection").style.display = "none";
      $("adminPanelSection").style.display = "block";
      loadAdminProducts();
      e.target.reset();
      status.style.display = "none";
    }, 600);
  } else {
    status.textContent = "❌ Non oswa modpas pa kòrèk.";
    status.className = "form-status error show";
  }
});

$("adminLogoutBtn").addEventListener("click", () => {
  setAdminLoggedIn(false);
  $("adminLoginSection").style.display = "block";
  $("adminPanelSection").style.display = "none";
  $("adminLoginForm").reset();
  $("adminLoginStatus").style.display = "none";
  if (adminProductsUnsub) { adminProductsUnsub(); adminProductsUnsub = null; }
});

$("addProductForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const file = f.get("image");
  const status = $("addProductStatus");
  status.style.display = "block";

  if (!file || !file.size) {
    status.textContent = "⚠️ Chwazi yon imaj pou pwodwi a.";
    status.className = "form-status error show";
    return;
  }

  if (file.size > 3 * 1024 * 1024) {
    status.textContent = "⚠️ Imaj twò gwo (maks 3 MB). Chwazi yon pi piti.";
    status.className = "form-status error show";
    return;
  }

  status.textContent = "⏳ Ap trete imaj la...";
  status.className = "form-status show";

  const deliveryAvailable = f.get("deliveryAvailable") === "on";
  const pickupLocation = deliveryAvailable ? "" : (f.get("pickupLocation") || "").trim();

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const product = {
        name: (f.get("name") || "").trim(),
        price: Number(f.get("price")),
        description: (f.get("description") || "").trim(),
        image: reader.result,
        deliveryAvailable: deliveryAvailable,
        pickupLocation: pickupLocation,
        createdAt: Date.now(),
      };
      await push(ref(db, "products"), product);
      status.textContent = "✅ Pwodwi ajoute! Li parèt nan boutik la kounye a.";
      status.className = "form-status success show";
      e.target.reset();
      const toggle = e.target.querySelector('[name="deliveryAvailable"]');
      if (toggle) toggle.checked = true;
      setTimeout(() => (status.style.display = "none"), 3000);
    } catch (err) {
      status.textContent = "❌ Erè: " + (err.message || "Pa ka ajoute");
      status.className = "form-status error show";
    }
  };
  reader.readAsDataURL(file);
});

function loadAdminProducts() {
  if (adminProductsUnsub) adminProductsUnsub();
  const container = $("adminProductsList");
  container.innerHTML = '<p class="settings-empty">Ap chaje...</p>';

  adminProductsUnsub = onValue(ref(db, "products"), (snap) => {
    const data = snap.val();
    if (!data) {
      container.innerHTML = '<p class="settings-empty">Pa gen pwodwi ankò.</p>';
      return;
    }
    const items = Object.entries(data).map(([id, p]) => ({ id, ...p }));
    items.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    container.innerHTML = items.map((p) => {
      const deliveryBadge = p.deliveryAvailable !== false
        ? '<span class="mini-badge available">✅ Livrezon</span>'
        : '<span class="mini-badge pickup">📍 Pase pran</span>';

      return `
        <div class="admin-product">
          <img src="${p.image || 'https://via.placeholder.com/60'}" alt="${esc(p.name)}" />
          <div class="admin-product-info">
            <b>${esc(p.name)}</b>
            <small>${money(p.price)}</small>
            ${deliveryBadge}
          </div>
          <div class="actions">
            <button class="btn-edit" onclick="window.editProductPrice('${p.id}', ${p.price})" title="Chanje pri">💰</button>
            <button class="btn-toggle" onclick="window.toggleDelivery('${p.id}', ${p.deliveryAvailable !== false})" title="Chanje livrezon">${p.deliveryAvailable !== false ? '🚚' : '📍'}</button>
            <button class="btn-del" onclick="window.deleteProductById('${p.id}')" title="Efase">🗑</button>
          </div>
        </div>
      `;
    }).join("");
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

window.toggleDelivery = async (id, currentAvailable) => {
  const newAvailable = !currentAvailable;
  if (newAvailable) {
    await set(ref(db, "products/" + id + "/deliveryAvailable"), true);
    await set(ref(db, "products/" + id + "/pickupLocation"), "");
  } else {
    const location = prompt("Kibo pou pase pran l? (ex: Delmas 33, P-au-P)");
    if (location === null) return;
    await set(ref(db, "products/" + id + "/deliveryAvailable"), false);
    await set(ref(db, "products/" + id + "/pickupLocation"), location.trim());
  }
};

window.deleteProductById = async (id) => {
  if (confirm("Efase pwodwi sa nèt? Ou p ap ka retounen.")) {
    await remove(ref(db, "products/" + id));
  }
};

/* ---------- CONTACT ---------- */
$("contactForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const body = "Non: " + f.get("name") + "\nTelefòn: " + f.get("phone") + "\nMesaj: " + f.get("message");
  window.location.href = "mailto:guepiplis@gmail.com?subject=Mesaj TIKA MARCHE&body=" + encodeURIComponent(body);
  $("contactStatus").textContent = "Ap ouvri aplikasyon email ou...";
  $("contactStatus").className = "form-status success show";
});

/* ---------- NAV ---------- */
$("burger").addEventListener("click", () => $("navLinks").classList.toggle("open"));
document.querySelectorAll(".nav-links a").forEach(a => {
  a.addEventListener("click", () => $("navLinks").classList.remove("open"));
});

$("year").textContent = new Date().getFullYear();

renderProducts();
