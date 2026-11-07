import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, onValue, push, set, remove, query, orderByChild, equalTo, get, update } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const $ = (id) => document.getElementById(id);
const money = (n) => Number(n).toLocaleString("fr-HT") + " HTG";

let cart = [];
let currentUser = null;

/* ---------- LOADER ---------- */
window.addEventListener("load", () => {
  setTimeout(() => $("loader").classList.add("hidden"), 600);
});

/* ---------- PRODUITS ---------- */
function renderProducts() {
  const grid = $("productsGrid");
  onValue(ref(db, "products"), (snap) => {
    const data = snap.val();
    if (!data) {
      grid.innerHTML = '<p class="loading-text">Pa gen pwodwi pou kounye a.</p>';
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

    // Featured
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
    // Rekipere detay pwodwi yo
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

  if (cart.length === 0) {
    status.textContent = "Panye ou vid.";
    status.style.display = "block";
    return;
  }

  if (!currentUser) {
    status.textContent = "Ou dwe konekte anvan ou kòmande.";
    status.style.display = "block";
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

  // Kalkile total
  const pSnap = await get(ref(db, "products"));
  const all = pSnap.val() || {};
  order.total = cart.reduce((s, c) => s + (all[c.id]?.price || 0) * c.qty, 0);

  await push(ref(db, "orders"), order);
  status.textContent = "✅ Kòmand ou resevwa! Nou pral kontakte w pou peman ak livrezon.";
  status.style.display = "block";
  cart = [];
  updateCart();
  setTimeout(() => {
    $("cartModal").classList.remove("open");
    status.style.display = "none";
  }, 3000);
});

/* ---------- AUTH ---------- */
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
  try {
    await signInWithEmailAndPassword(auth, f.get("email"), f.get("password"));
    status.textContent = "✅ Konekte!";
    status.style.display = "block";
    setTimeout(() => $("authModal").classList.remove("open"), 800);
  } catch (err) {
    status.textContent = "Erè: " + (err.message || "Impossible");
    status.style.display = "block";
  }
});

$("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const status = $("signupStatus");
  try {
    const cred = await createUserWithEmailAndPassword(auth, f.get("email"), f.get("password"));
    await updateProfile(cred.user, { displayName: f.get("name") });
    status.textContent = "✅ Kont kreye!";
    status.style.display = "block";
    setTimeout(() => $("authModal").classList.remove("open"), 800);
  } catch (err) {
    status.textContent = "Erè: " + (err.message || "Impossible");
    status.style.display = "block";
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

/* ---------- UI ---------- */
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

/* ---------- INIT ---------- */
renderProducts();
