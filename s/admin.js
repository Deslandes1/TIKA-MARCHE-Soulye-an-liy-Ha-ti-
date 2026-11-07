import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, set, remove, onValue, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n).toLocaleString("fr-HT") + " HTG";

/* ---------- AUTH ADMIN ---------- */
onAuthStateChanged(auth, (user) => {
  if (user) {
    $("adminLogin").style.display = "none";
    $("adminPanel").style.display = "block";
    loadProducts();
    loadOrders();
  } else {
    $("adminLogin").style.display = "grid";
    $("adminPanel").style.display = "none";
  }
});

$("adminAuthForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    await signInWithEmailAndPassword(auth, f.get("email"), f.get("password"));
  } catch (err) {
    $("adminAuthStatus").textContent = "Erè: " + err.message;
    $("adminAuthStatus").style.display = "block";
  }
});

$("adminLogout").addEventListener("click", () => signOut(auth));

/* ---------- AJOUTE PWODWI ---------- */
$("addProductForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const file = f.get("image");
  const status = $("addProductStatus");

  // Konvèti imaj an base64 (senp pou GitHub Pages)
  const reader = new FileReader();
  reader.onload = async () => {
    const product = {
      name: f.get("name"),
      price: Number(f.get("price")),
      description: f.get("description"),
      image: reader.result,
      createdAt: Date.now(),
    };
    await push(ref(db, "products"), product);
    status.textContent = "✅ Pwodwi ajoute!";
    status.style.display = "block";
    e.target.reset();
    setTimeout(() => (status.style.display = "none"), 2500);
  };
  reader.readAsDataURL(file);
});

/* ---------- LISTE PWODWI ---------- */
function loadProducts() {
  onValue(ref(db, "products"), (snap) => {
    const data = snap.val();
    const container = $("adminProducts");
    if (!data) {
      container.innerHTML = "<p style='color:var(--muted)'>Pa gen pwodwi.</p>";
      return;
    }
    container.innerHTML = Object.entries(data).map(([id, p]) => `
      <div class="admin-product">
        <img src="${p.image}" alt="${p.name}" />
        <div class="admin-product-info"><b>${p.name}</b><small>${money(p.price)}</small></div>
        <div class="actions">
          <button class="btn-edit" onclick="window.editPrice('${id}', ${p.price})">💰 Chanje Pri</button>
          <button class="btn-del" onclick="window.deleteProduct('${id}')">🗑 Efase</button>
        </div>
      </div>
    `).join("");
  });
}

window.editPrice = async (id, old) => {
  const newPrice = prompt("Nouvo pri (HTG):", old);
  if (newPrice && !isNaN(newPrice)) {
    await set(ref(db, "products/" + id + "/price"), Number(newPrice));
  }
};

window.deleteProduct = async (id) => {
  if (confirm("Efase pwodwi sa?")) {
    await remove(ref(db, "products/" + id));
  }
};

/* ---------- KÒMAND ---------- */
function loadOrders() {
  onValue(ref(db, "orders"), (snap) => {
    const data = snap.val();
    const container = $("adminOrders");
    if (!data) {
      container.innerHTML = "<p style='color:var(--muted)'>Pa gen kòmand.</p>";
      return;
    }
    container.innerHTML = Object.entries(data)
      .sort((a, b) => (b[1].createdAt || 0) - (a[1].createdAt || 0))
      .map(([id, o]) => `
        <div class="admin-order">
          <b>${o.fullName}</b> — ${o.phone}<br>
          ${o.city}, ${o.zone} — ${o.address}<br>
          Peman: ${o.payment} | Total: <b>${money(o.total || 0)}</b><br>
          <small style="color:var(--muted)">${new Date(o.createdAt).toLocaleString("fr-HT")}</small>
        </div>
      `).join("");
  });
}
