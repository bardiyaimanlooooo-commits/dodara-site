/* Dodara storefront — app.js */
(() => {
const CFG = window.DODARA || {};
const API = (CFG.API || "").replace(/\/+$/, "");
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fa = n => String(n).replace(/\d/g, d => "۰۱۲۳۴۵۶۷۸۹"[d]);
const money = n => fa(Number(n || 0).toLocaleString("en-US"));
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toast = t => { const e = $("#toast"); e.textContent = t; e.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => e.classList.remove("on"), 2000); };
const ls = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const api = async (path, opt = {}) => {
  const r = await fetch(API + path, opt.body ? { ...opt, headers: { "Content-Type": "application/json", ...(opt.headers || {}) } } : opt);
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || "خطا در ارتباط"), { status: r.status });
  return d;
};
const sid = (() => { let s = sessionStorage.getItem("dd_sid"); if (!s) { s = Math.random().toString(36).slice(2, 12); sessionStorage.setItem("dd_sid", s); } return s; })();
const track = (type, q) => { if (API) fetch(API + "/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, q, sid }), keepalive: true }).catch(() => {}); };

/* ---------- default art ---------- */
const svgU = x => "data:image/svg+xml;utf8," + encodeURIComponent(x);
const G = `<defs><linearGradient id='bd' x1='0' x2='1'><stop offset='0' stop-color='#1c2a24'/><stop offset='.45' stop-color='#0b1310'/><stop offset='1' stop-color='#050807'/></linearGradient><linearGradient id='gr' x1='0' x2='1'><stop offset='0' stop-color='#5fe0aa'/><stop offset='1' stop-color='#139463'/></linearGradient><linearGradient id='hl' x1='0' x2='1'><stop offset='0' stop-color='#fff' stop-opacity='0'/><stop offset='.5' stop-color='#fff' stop-opacity='.22'/><stop offset='1' stop-color='#fff' stop-opacity='0'/></linearGradient></defs>`;
const ART = {
  tin: "/assets/tin-hero-hd.webp",
  pack: svgU(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 220'>${G}<path d='M40 40 Q100 22 160 40 L168 196 Q100 212 32 196 Z' fill='url(#bd)' stroke='#2b3b34'/><path d='M40 40 Q100 22 160 40 L158 58 Q100 42 42 58Z' fill='#22322b'/><rect x='36' y='100' width='128' height='44' fill='url(#gr)'/><path d='M100 108c-12 6-16 18-10 28 10-2 18-12 10-28z' fill='#03140c'/><path d='M100 108c12 6 16 18 10 28-10-2-18-12-10-28z' fill='#0b3d2a'/><rect x='70' y='40' width='22' height='160' fill='url(#hl)'/></svg>`),
  vape: svgU(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 220'>${G}<rect x='78' y='14' width='44' height='26' rx='10' fill='#22322b'/><rect x='70' y='34' width='60' height='176' rx='26' fill='url(#bd)' stroke='#2b3b34'/><rect x='70' y='96' width='60' height='46' fill='url(#gr)'/><circle cx='100' cy='186' r='5' fill='#5fe0aa'/><circle cx='100' cy='186' r='12' fill='#5fe0aa' opacity='.25'/><rect x='82' y='40' width='14' height='164' rx='7' fill='url(#hl)'/></svg>`),
  pod: svgU(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 220'>${G}<rect x='80' y='14' width='40' height='34' rx='12' fill='#22322b'/><rect x='52' y='40' width='96' height='172' rx='44' fill='url(#bd)' stroke='#2b3b34'/><rect x='80' y='66' width='40' height='58' rx='14' fill='#0a1a14' stroke='#2f4a3e'/><rect x='84' y='92' width='32' height='28' rx='10' fill='url(#gr)'/><circle cx='100' cy='170' r='9' fill='#5fe0aa'/><rect x='64' y='50' width='16' height='150' rx='8' fill='url(#hl)'/></svg>`),
  acc: svgU(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 220'>${G}<g><path d='M30 130l40-20 40 20-40 20z' fill='#2a3631'/><path d='M30 130v40l40 20v-40z' fill='#121a17'/><path d='M110 130v40l-40 20v-40z' fill='#0a0f0d'/></g><g><path d='M90 130l40-20 40 20-40 20z' fill='#2a3631'/><path d='M90 130v40l40 20v-40z' fill='#121a17'/><path d='M170 130v40l-40 20v-40z' fill='#0a0f0d'/></g><g><path d='M60 80l40-20 40 20-40 20z' fill='#33423b'/><path d='M60 80v40l40 20v-40z' fill='#16201c'/><path d='M140 80v40l-40 20v-40z' fill='#0b110f'/><path d='M84 78l16-8 16 8-16 8z' fill='url(#gr)' opacity='.85'/></g></svg>`)
};
const catArt = c => c.img || (/الفاخر|fakher/i.test(c.name) ? ART.tin : /ویپ|vape/i.test(c.name) ? ART.vape : /پاد|pod/i.test(c.name) ? ART.pod : /لوازم|زغال|جانبی/.test(c.name) ? ART.acc : ART.pack);
const NOIMG = svgU(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><rect width='400' height='500' fill='#e3ebe5'/><path d='M200 330c-30 0-48-17-48-40 0-27 27-36 27-58 0-13-8-22-8-36 27 4 48 22 48 49 0 18-13 27-13 40 0 9 4 13 13 13 13 0 22-13 22-27' fill='none' stroke='#9fb5a8' stroke-width='12' stroke-linecap='round'/></svg>`);
const img0 = p => (p.imgs && p.imgs[0]) || NOIMG;
const thumb0 = p => (p.thumbs && p.thumbs[0]) || img0(p);
const off = p => p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;

/* ---------- state ---------- */
let S = ls.get("dd_store", { products: [], categories: [], pay: {} });
let cart = ls.get("dd_cart", {});
const P = id => S.products.find(x => x.id === id);
const saveCart = () => { ls.set("dd_cart", cart); badge(); };
const badge = () => {
  const n = Object.values(cart).reduce((a, b) => a + b, 0); $$("#cn,#cn2").forEach(e => { e.textContent = n ? fa(n) : ""; e.dataset.n = n; });
  const bar = $("#cbar"); if (!bar) return;
  const tot = Object.keys(cart).reduce((a, id) => a + (P(id) ? P(id).price * cart[id] : 0), 0);
  bar.classList.toggle("on", n > 0 && !!tot); $("#cbN").textContent = fa(n); $("#cbT").textContent = money(tot) + " تومان";
};
const cleanCart = () => { for (const id in cart) if (!P(id) || P(id).stock === false) delete cart[id]; saveCart(); };

/* ---------- modal stack + Android back ---------- */
const stack = [];
const openM = id => { const e = $("#" + id); if (e.classList.contains("on")) return; e.classList.add("on"); stack.push(id); history.pushState({ m: id }, ""); document.body.style.overflow = "hidden"; };
const closeTop = pop => { const id = stack.pop(); if (!id) return; $("#" + id).classList.remove("on"); if (id === "m-chat") stopPoll(); if (id === "m-pay") clearInterval(tm); if (!stack.length) document.body.style.overflow = ""; if (!pop) history.back(); };
window.closeTop = closeTop;
addEventListener("popstate", () => { if ($("#lb").classList.contains("on")) { $("#lb").classList.remove("on"); return; } closeTop(true); });
$$("[data-close]").forEach(b => b.onclick = () => closeTop());
$$(".ov").forEach(o => o.addEventListener("click", e => { if (e.target === o) closeTop(); }));

/* ---------- render ---------- */
const priceHtml = p => `${money(p.price)} <small>تومان</small>${p.oldPrice && p.oldPrice > p.price ? `<span class="old">${money(p.oldPrice)}</span>` : ""}`;
const card = p => `<a class="card" href="/p/${encodeURIComponent(p.id)}" data-p="${esc(p.id)}"><div class="ph"><img loading="lazy" decoding="async" width="400" height="500" src="${esc(thumb0(p))}" alt="${esc(p.name)}">${off(p) ? `<span class="offb">٪${fa(off(p))}</span>` : ""}${p.stock === false ? `<span class="oos">ناموجود</span>` : `<button class="add" data-add="${esc(p.id)}" aria-label="افزودن به سبد"><svg class="i"><use href="#plus"/></svg></button>`}</div><h3>${esc(p.name)}</h3><span class="w">${esc(p.weight || "")}</span><span class="pr">${priceHtml(p)}</span></a>`;

const goArrow = `<svg class="i"><use href="#ic-arrow"/></svg>`;
/* shown while the store has no categories yet — each tile opens the support chat */
const DEF_CATS = [
  { name: "الفاخر اصل", sub: "تنباکو قلیان پلمب", art: ART.tin },
  { name: "تنباکو قلیان", sub: "طعم‌های میوه‌ای و کلاسیک", art: ART.pack },
  { name: "ویپ یکبارمصرف", sub: "طعم‌های متنوع", art: ART.vape },
  { name: "پاد", sub: "سیستم پاد و کارتریج", art: ART.pod },
  { name: "زغال و لوازم", sub: "لوازم جانبی قلیان", art: ART.acc }
];
function render() {
  const cats = S.categories, prods = S.products;
  let feat = prods.filter(p => p.featured);
  if (!feat.length) feat = prods.slice(0, 6);
  $("#rail").innerHTML = feat.length ? feat.slice(0, 10).map(card).join("") : `<div class="note"><b>محصولات به‌زودی اضافه می‌شوند</b>برای استعلام قیمت و موجودی، همین حالا از پشتیبانی بپرسید.<button class="b2" data-open-chat><svg class="i"><use href="#ic-chat"/></svg>گفتگو با پشتیبانی</button></div>`;
  $("#bento").innerHTML = cats.length
    ? cats.map((c, i) => `<a class="tile${i === 0 ? " big" : ""}" href="#sec-${esc(c.id)}"><span class="halo"></span><img src="${esc(catArt(c))}" alt="" loading="lazy"><b>${esc(c.name)}</b><small>${fa(prods.filter(p => p.cat === c.id).length)} محصول</small><span class="go">مشاهده${goArrow}</span></a>`).join("")
    : DEF_CATS.map((c, i) => `<button class="tile${i === 0 ? " big" : ""}" data-open-chat><span class="halo"></span><img src="${esc(c.art)}" alt="" loading="lazy"><b>${esc(c.name)}</b><small>${esc(c.sub)}</small><span class="go">استعلام موجودی${goArrow}</span></button>`).join("");
  $("#shop").innerHTML = cats.map(c => {
    const l = prods.filter(p => p.cat === c.id); if (!l.length) return "";
    return `<section class="sec" id="sec-${esc(c.id)}"><div class="st"><h2>${esc(c.name)}</h2>${l.length > 4 ? `<a href="/c/${encodeURIComponent(c.id)}" data-all="${esc(c.id)}">مشاهده همه<svg class="i" style="width:16px;height:16px"><use href="#ic-arrow"/></svg></a>` : ""}</div><div class="grid">${l.slice(0, 4).map(card).join("")}</div></section>`;
  }).join("");
  reveal(); bindTilt();
}

async function load() {
  if (S.products.length || S.categories.length) render();
  if (!API || API.includes("YOUR-SUBDOMAIN")) { if (!S.categories.length) { render(); $("#rail").innerHTML = `<div class="note">آدرس API در config.js تنظیم نشده است.</div>`; } return; }
  try {
    const d = await api("/api/store");
    S = d; ls.set("dd_store", S); cleanCart(); render(); openFromHash();
  } catch (e) {
    if (!S.categories.length) { render(); $("#rail").innerHTML = `<div class="note"><b>اتصال برقرار نشد</b>صفحه را دوباره باز کنید یا با پشتیبانی در تماس باشید.</div>`; }
  }
}
function openFromHash() { const m = location.hash.match(/^#buy-(.+)$/); if (m && P(decodeURIComponent(m[1]))) { history.replaceState(null, "", location.pathname); showProd(decodeURIComponent(m[1])); } }

document.addEventListener("click", e => {
  const ad = e.target.closest("[data-add]"); if (ad) { e.preventDefault(); e.stopPropagation(); flyToCart(ad.closest(".card")); addToCart(ad.dataset.add, 1); return; }
  const pc = e.target.closest("[data-p]"); if (pc) { e.preventDefault(); showProd(pc.dataset.p); return; }
  const al = e.target.closest("[data-all]"); if (al) { e.preventDefault(); const c = S.categories.find(x => x.id === al.dataset.all); $("#catT").textContent = c.name; $("#catG").innerHTML = S.products.filter(p => p.cat === c.id).map(card).join(""); openM("m-cat"); return; }
  const q = e.target.closest(".q button"); if (q) q.parentNode.classList.toggle("open");
  if (e.target.closest("[data-open-chat]")) openChat();
  const cp = e.target.closest("[data-cp]"); if (cp) { const v = cp.dataset.cp; (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => toast("کپی شد")).catch(() => { const t = document.createElement("textarea"); t.value = v; document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove(); toast("کپی شد"); }); }
});
function addToCart(id, n) { const p = P(id); if (!p || p.stock === false) return; cart[id] = Math.min(50, (cart[id] || 0) + n); saveCart(); toast("به سبد اضافه شد"); }

/* ---------- product ---------- */
function showProd(id) {
  const p = P(id); if (!p) return; let n = 1; track("click");
  const imgs = (p.imgs && p.imgs.length) ? p.imgs : [NOIMG];
  const cat = S.categories.find(c => c.id === p.cat) || {};
  $("#prodBody").innerHTML = `<div class="mb"><div class="car" id="car">${imgs.map(s => `<img src="${esc(s)}" alt="${esc(p.name)}" data-zoom>`).join("")}</div>${imgs.length > 1 ? `<div class="dots" id="dots">${imgs.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
  <div class="pd"><div class="pt"><h2>${esc(p.name)}</h2><button class="shr" id="shr" aria-label="اشتراک‌گذاری"><svg class="i"><use href="#ic-share"/></svg></button></div><div class="p">${money(p.price)} تومان${p.oldPrice && p.oldPrice > p.price ? `<span class="old">${money(p.oldPrice)}</span>` : ""}</div>
  <div class="specs"><div><small>دسته</small>${esc(cat.name || "")}</div><div><small>${p.weight ? "وزن" : "وضعیت"}</small>${esc(p.weight || (p.stock === false ? "ناموجود" : "موجود"))}</div></div>
  <p class="desc">${esc(p.desc || "").replace(/\n/g, "<br>")}</p></div></div>
  <div class="bar">${p.stock === false ? `<button class="b1" disabled style="flex:1;justify-content:center">ناموجود</button>` : `<div class="qty"><button id="qp">+</button><span id="qn">۱</span><button id="qm">−</button></div><button class="b1" id="qa">افزودن به سبد</button>`}</div>`;
  const car = $("#car");
  car.onscroll = () => { const i = Math.round(Math.abs(car.scrollLeft) / car.clientWidth); $$("#dots i").forEach((d, k) => d.classList.toggle("on", k === i)); };
  $$("[data-zoom]").forEach(im => im.onclick = () => zoom(im.src));
  $("#shr").onclick = async () => { const u = location.origin + "/p/" + encodeURIComponent(p.id); try { if (navigator.share) await navigator.share({ title: p.name, text: p.name + " — دود آرا", url: u }); else { await navigator.clipboard.writeText(u); toast("لینک محصول کپی شد"); } } catch {} };
  if ($("#qa")) {
    $("#qp").onclick = () => { n = Math.min(20, n + 1); $("#qn").textContent = fa(n); };
    $("#qm").onclick = () => { n = Math.max(1, n - 1); $("#qn").textContent = fa(n); };
    $("#qa").onclick = () => { flyToCart($("#car")); addToCart(p.id, n); closeTop(); };
  }
  openM("m-prod");
}

/* ---------- lightbox pinch zoom ---------- */
let sc = 1, tx = 0, ty = 0, d0 = 0, s0 = 1, last = null, tap = 0;
const lbi = $("#lbi"), lb = $("#lb");
const applyZ = () => lbi.style.transform = `translate(${tx}px,${ty}px) scale(${sc})`;
function zoom(src) { sc = 1; tx = ty = 0; applyZ(); lbi.src = src; lb.classList.add("on"); history.pushState({ m: "lb" }, ""); }
const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
lb.addEventListener("touchstart", e => { if (e.touches.length === 2) { d0 = dist(e.touches); s0 = sc; } else last = e.touches[0]; }, { passive: true });
lb.addEventListener("touchmove", e => { if (e.touches.length === 2) sc = Math.min(5, Math.max(1, s0 * dist(e.touches) / d0)); else if (sc > 1 && last) { tx += e.touches[0].clientX - last.clientX; ty += e.touches[0].clientY - last.clientY; last = e.touches[0]; } applyZ(); }, { passive: true });
lb.addEventListener("touchend", e => { if (!e.touches.length && e.changedTouches.length === 1) { const t = Date.now(); if (t - tap < 280) { sc = sc > 1 ? 1 : 2.5; tx = ty = 0; applyZ(); } tap = t; } });
$("#lbx").onclick = () => history.back();

/* ---------- search ---------- */
const openSearch = () => { openM("m-search"); setTimeout(() => $("#sIn").focus(), 250); };
$("#hSearch").onclick = openSearch;
let sT;
$("#sIn").oninput = e => {
  const v = e.target.value.trim().toLowerCase();
  $("#sG").innerHTML = v ? (S.products.filter(p => (p.name + " " + (p.desc || "")).toLowerCase().includes(v)).map(card).join("") || `<div class="empty">محصولی با این نام پیدا نشد.</div>`) : "";
  clearTimeout(sT); if (v.length > 1) sT = setTimeout(() => track("search", v), 1200);
};

/* ---------- cart ---------- */
const subtotal = () => Object.keys(cart).reduce((a, id) => a + (P(id) ? P(id).price * cart[id] : 0), 0);
const STL = { awaiting: ["در انتظار پرداخت", "a"], paid: ["پرداخت‌شده — در حال آماده‌سازی", "g"], sent: ["ارسال شد", "b"], cancelled: ["لغو شد", "r"] };
async function myOrders() {
  const mine = ls.get("dd_orders", []); const box = $("#myo"); if (!box || !mine.length) return;
  box.innerHTML = `<h4>سفارش‌های من</h4>` + mine.slice(0, 5).map(o => `<div class="mo" id="mo-${esc(o.id)}"><div><b>#${fa(o.code)}</b><small>${fa(new Date(o.t).toLocaleDateString("fa-IR"))} — ${money(o.total)} تومان</small></div><span class="stc">…</span></div>`).join("");
  for (const o of mine.slice(0, 5)) { try { const d = await api("/api/orders/" + o.id); const s = STL[d.status] || [d.status, ""]; const el = $(`#mo-${o.id} .stc`); if (el) { el.textContent = s[0]; el.className = "stc " + s[1]; } } catch { const el = $(`#mo-${o.id} .stc`); if (el) el.textContent = "—"; } }
}
function renderCart() {
  cleanCart();
  const ids = Object.keys(cart);
  if (!ids.length) { $("#cartBody").innerHTML = `<div class="empty">سبد خرید خالی است.<br><button class="b2" style="margin-top:16px" onclick="closeTop();document.getElementById('cats').scrollIntoView({behavior:'smooth'})">دیدن محصولات</button></div><div id="myo" class="myo"></div>`; myOrders(); return; }
  $("#cartBody").innerHTML = ids.map(id => { const p = P(id), q = cart[id]; return `<div class="row"><img src="${esc(img0(p))}" alt=""><div class="t">${esc(p.name)}<small>${money(p.price)} تومان</small></div><div class="qty"><button data-c="+${esc(id)}">+</button><span>${fa(q)}</span><button data-c="-${esc(id)}">−</button></div></div>`; }).join("")
    + `<div class="sum t"><span>جمع کالاها</span><span>${money(subtotal())} تومان</span></div><button class="b1 full" id="toCo">ادامه و ثبت آدرس</button><div id="myo" class="myo"></div>`;
  myOrders();
  $("#toCo").onclick = () => { openM("m-co"); sumCo(); };
}
document.addEventListener("click", e => { const b = e.target.closest("[data-c]"); if (!b) return; const s = b.dataset.c, id = s.slice(1); cart[id] = (cart[id] || 0) + (s[0] === "+" ? 1 : -1); if (cart[id] <= 0) delete cart[id]; if (cart[id] > 50) cart[id] = 50; saveCart(); renderCart(); });

/* ---------- bottom nav ---------- */
$$("[data-nav]").forEach(b => b.onclick = () => {
  const v = b.dataset.nav;
  if (v === "home") scrollTo({ top: 0, behavior: "smooth" });
  else if (v === "cats") $("#cats").scrollIntoView({ behavior: "smooth" });
  else if (v === "search") openSearch();
  else if (v === "cart") { renderCart(); openM("m-cart"); }
  else if (v === "chat") openChat();
  if (v === "home" || v === "cats") $$("[data-nav]").forEach(x => x.classList.toggle("on", x === b));
});

/* ---------- checkout ---------- */
const GEO = {"آذربایجان شرقی":["تبریز","مراغه","مرند","میانه","اهر","بناب","سراب","شبستر","عجب‌شیر","هشترود","آذرشهر","جلفا","ملکان"],"آذربایجان غربی":["ارومیه","خوی","مهاباد","بوکان","میاندوآب","سلماس","نقده","پیرانشهر","سردشت","تکاب","ماکو","شاهین‌دژ"],"اردبیل":["اردبیل","پارس‌آباد","مشگین‌شهر","خلخال","گرمی","بیله‌سوار","نمین","نیر"],"اصفهان":["اصفهان","کاشان","خمینی‌شهر","نجف‌آباد","شاهین‌شهر","فولادشهر","لنجان","مبارکه","گلپایگان","خوانسار","شهرضا","نطنز","آران و بیدگل","فلاورجان","سمیرم","نائین","اردستان"],"البرز":["کرج","فردیس","نظرآباد","هشتگرد","محمدشهر","ماهدشت","اشتهارد","طالقان","کمال‌شهر","مشکین‌دشت"],"ایلام":["ایلام","دهلران","ایوان","آبدانان","دره‌شهر","مهران","سرابله"],"بوشهر":["بوشهر","برازجان","گناوه","کنگان","جم","خورموج","دیلم","عسلویه","بندر دیر"],"تهران":["تهران","اسلامشهر","شهریار","قدس","ملارد","ری","ورامین","پاکدشت","قرچک","رباط‌کریم","پردیس","بومهن","دماوند","فیروزکوه","پیشوا","شهرقدس","بهارستان","لواسان"],"چهارمحال و بختیاری":["شهرکرد","بروجن","فارسان","لردگان","فرخ‌شهر","هفشجان","سامان"],"خراسان جنوبی":["بیرجند","قائن","فردوس","طبس","نهبندان","سربیشه","بشرویه"],"خراسان رضوی":["مشهد","نیشابور","سبزوار","تربت حیدریه","قوچان","کاشمر","تربت جام","چناران","گناباد","فریمان","سرخس","تایباد","خواف","درگز","بردسکن"],"خراسان شمالی":["بجنورد","شیروان","اسفراین","آشخانه","جاجرم","فاروج","گرمه"],"خوزستان":["اهواز","آبادان","دزفول","خرمشهر","اندیمشک","بهبهان","ماهشهر","شوشتر","ایذه","مسجدسلیمان","شوش","رامهرمز","امیدیه","باغملک","هندیجان","سوسنگرد","رامشیر"],"زنجان":["زنجان","ابهر","خرمدره","قیدار","طارم","ماهنشان","سلطانیه"],"سمنان":["سمنان","شاهرود","دامغان","گرمسار","مهدی‌شهر","ایوانکی","سرخه"],"سیستان و بلوچستان":["زاهدان","چابهار","ایرانشهر","زابل","سراوان","خاش","نیک‌شهر","کنارک","راسک"],"فارس":["شیراز","مرودشت","جهرم","کازرون","فسا","داراب","لار","آباده","نی‌ریز","فیروزآباد","اقلید","سپیدان","گراش","استهبان","لامرد","صدرا"],"قزوین":["قزوین","تاکستان","الوند","بوئین‌زهرا","آبیک","محمدیه","اقبالیه"],"قم":["قم","جعفریه","کهک","سلفچگان"],"کردستان":["سنندج","سقز","مریوان","بانه","قروه","بیجار","کامیاران","دیواندره","دهگلان"],"کرمان":["کرمان","رفسنجان","سیرجان","جیرفت","بم","زرند","کهنوج","شهربابک","بافت","راور","کوهبنان"],"کرمانشاه":["کرمانشاه","اسلام‌آباد غرب","کنگاور","هرسین","سنقر","صحنه","جوانرود","پاوه","قصر شیرین","سرپل ذهاب","گیلانغرب"],"کهگیلویه و بویراحمد":["یاسوج","دوگنبدان","دهدشت","لیکک","سی‌سخت","لنده"],"گلستان":["گرگان","گنبد کاووس","علی‌آباد","آق‌قلا","کردکوی","بندر ترکمن","آزادشهر","مینودشت","کلاله","بندر گز","رامیان"],"گیلان":["رشت","بندر انزلی","لاهیجان","لنگرود","تالش","آستارا","آستانه اشرفیه","رودسر","صومعه‌سرا","فومن","رودبار","منجیل","ماسال","سیاهکل"],"لرستان":["خرم‌آباد","بروجرد","دورود","کوهدشت","الیگودرز","ازنا","نورآباد","پلدختر","الشتر","سپیددشت"],"مازندران":["ساری","بابل","آمل","قائم‌شهر","بهشهر","چالوس","نوشهر","تنکابن","رامسر","بابلسر","محمودآباد","نکا","جویبار","فریدونکنار","نور","کلاردشت","عباس‌آباد"],"مرکزی":["اراک","ساوه","خمین","محلات","دلیجان","شازند","تفرش","آشتیان","کمیجان"],"هرمزگان":["بندرعباس","قشم","کیش","میناب","بندر لنگه","حاجی‌آباد","جاسک","رودان","بستک","پارسیان"],"همدان":["همدان","ملایر","نهاوند","تویسرکان","اسدآباد","کبودرآهنگ","بهار","رزن","لالجین"],"یزد":["یزد","میبد","اردکان","بافق","مهریز","ابرکوه","تفت","زارچ","اشکذر","خاتم"]};
function dd(root, list, pick) {
  const inp = root.querySelector("input"), ul = root.querySelector("ul");
  const draw = () => { const v = inp.value.trim(); const l = list().filter(x => x.includes(v)); ul.innerHTML = l.length ? l.map(x => `<li>${esc(x)}</li>`).join("") : `<li data-x>${list().length ? "موردی پیدا نشد" : "اول استان را انتخاب کنید"}</li>`; };
  inp.onfocus = () => { draw(); root.classList.add("on"); }; inp.oninput = () => { draw(); root.classList.add("on"); pick && pick(null); };
  ul.onclick = e => { const li = e.target.closest("li"); if (!li || li.hasAttribute("data-x")) return; inp.value = li.textContent; root.classList.remove("on"); pick && pick(li.textContent); };
  document.addEventListener("click", e => { if (!root.contains(e.target)) root.classList.remove("on"); });
}
let prov = "";
dd($("#ddP"), () => Object.keys(GEO), v => { if (v === null) { prov = GEO[$("#ddP input").value.trim()] ? $("#ddP input").value.trim() : ""; return; } prov = v; const c = $("#ddC input"); c.value = ""; c.placeholder = "جستجو…"; });
dd($("#ddC"), () => GEO[prov] || []);
const shipSel = () => document.querySelector("[name=ship]:checked");
function sumCo() { const s = subtotal(), h = +shipSel().dataset.p; $("#coSum").innerHTML = `<div class="sum"><span>جمع کالاها</span><span>${money(s)} تومان</span></div><div class="sum"><span>هزینه ارسال</span><span>${money(h)} تومان</span></div><div class="sum t"><span>مبلغ قابل پرداخت</span><span>${money(s + h)} تومان</span></div>`; }
$$("[name=ship]").forEach(r => r.onchange = sumCo);
const saved = ls.get("dd_addr", null);
if (saved) { $("#fName").value = saved.name || ""; $("#fTel").value = saved.phone || ""; $("#ddP input").value = saved.province || ""; prov = GEO[saved.province] ? saved.province : ""; $("#ddC input").value = saved.city || ""; $("#fAd").value = saved.address || ""; $("#fPost").value = saved.postal || ""; }
const toEn = s => s.replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));

/* ---------- payment ---------- */
let tm, busy = false;
$("#bPay").onclick = async () => {
  if (busy) return;
  const need = (sel, msg) => { toast(msg); $(sel).focus(); };
  const f = { name: $("#fName").value.trim(), phone: toEn($("#fTel").value.trim()), province: $("#ddP input").value.trim(), city: $("#ddC input").value.trim(), address: $("#fAd").value.trim(), postal: toEn($("#fPost").value.trim()) };
  if (!f.name) return need("#fName", "نام را وارد کنید");
  if (!/^09\d{9}$/.test(f.phone)) return need("#fTel", "شماره موبایل معتبر نیست");
  if (!f.province) return need("#ddP input", "استان را انتخاب کنید");
  if (!f.city) return need("#ddC input", "شهر را وارد کنید");
  if (f.address.length < 8) return need("#fAd", "آدرس کامل را وارد کنید");
  if (!Object.keys(cart).length) return toast("سبد خرید خالی است");
  ls.set("dd_addr", f);
  busy = true; const btn = $("#bPay"), old = btn.innerHTML; btn.innerHTML = `<span class="spin"></span>`;
  try {
    const r = await api("/api/orders", { method: "POST", body: JSON.stringify({ ...f, ship: shipSel().value, items: Object.keys(cart).map(id => ({ id, qty: cart[id] })) }) });
    const mine = ls.get("dd_orders", []); mine.unshift({ id: r.id, code: r.code, total: r.total, t: Date.now() }); ls.set("dd_orders", mine.slice(0, 20));
    showPay(r, f);
  } catch (e) { toast(e.message || "ثبت سفارش انجام نشد"); }
  finally { busy = false; btn.innerHTML = old; }
};
function showPay(order, f) {
  const pay = S.pay || {}, total = order.total; let t = 600;
  const card4 = (pay.card || "").replace(/\D/g, "").replace(/(\d{4})(?=\d)/g, "$1 ");
  const sheba = pay.sheba ? (pay.sheba.startsWith("IR") ? pay.sheba : "IR" + pay.sheba) : "";
  const shebaFmt = sheba.replace(/(.{4})(?=.)/g, "$1 ");
  if (!pay.card) {
    $("#payBody").innerHTML = `<div class="note">سفارش شما با کد پیگیری <b>${fa(order.code)}</b> ثبت شد، اما اطلاعات کارت هنوز در پنل تنظیم نشده. لطفاً از پشتیبانی آنلاین اطلاعات پرداخت را بگیرید.</div><button class="b1 full" data-open-chat>پشتیبانی آنلاین</button>`;
    openM("m-pay"); return;
  }
  $("#payBody").innerHTML = `<div class="scene"><div class="bc" id="bc">
   <div class="face"><div class="r"><span class="lg">DODARA</span><div class="chip"></div></div><div class="no">${esc(card4)}</div><div class="r"><div><small>صاحب کارت</small>${esc(pay.holder || "")}</div><div style="text-align:left"><small>مبلغ (تومان)</small>${money(total)}</div></div></div>
   <div class="face bk"><div class="r"><span>شماره شبا</span><span class="lg">DODARA</span></div><div class="no" style="font-size:13.5px;letter-spacing:1.2px">${esc(shebaFmt || "—")}</div><div class="r"><small>${esc(pay.bank || "")}</small><small>برای برگرداندن کارت بزنید</small></div></div>
  </div></div>
  <div class="cp"><div><small>شماره کارت${pay.bank ? " — " + esc(pay.bank) : ""}</small><span>${esc(card4)}</span></div><button data-cp="${esc((pay.card || "").replace(/\D/g, ""))}">کپی</button></div>
  ${sheba ? `<div class="cp"><div><small>شماره شبا</small><span>${esc(shebaFmt)}</span></div><button data-cp="${esc(sheba)}">کپی</button></div>` : ""}
  <div class="cp"><div><small>مبلغ قابل واریز (تومان)</small><span>${money(total)}</span></div><button data-cp="${total}">کپی</button></div>
  <div class="timer"><span>مهلت پرداخت</span><b id="tt">${fa("10:00")}</b></div>
  <button class="b1 full" id="paid">پرداخت کردم</button>`;
  $("#bc").onclick = e => e.currentTarget.classList.toggle("flip");
  openM("m-pay"); clearInterval(tm);
  tm = setInterval(() => { t--; if (t <= 0) { clearInterval(tm); closeTop(); toast("مهلت پرداخت تمام شد. دوباره سفارش دهید"); } else { const el = $("#tt"); if (el) el.textContent = fa(String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0")); } }, 1000);
  $("#paid").onclick = async () => {
    const b = $("#paid"); b.innerHTML = `<span class="spin"></span>`; b.disabled = true;
    try { await api(`/api/orders/${order.id}/paid`, { method: "POST" }); } catch (e) { b.disabled = false; b.textContent = "پرداخت کردم"; return toast(e.message || "دوباره تلاش کنید"); }
    clearInterval(tm);
    sendEmail(order, f);
    cart = {}; saveCart();
    setTimeout(() => showPushAsk(true), 2500);
    $("#payBody").innerHTML = `<div class="ok"><div class="c"><svg class="i"><use href="#ic-check"/></svg></div><h3>سفارش شما ثبت شد</h3><p>کد پیگیری: <b>${fa(order.code)}</b><br>سفارش برای ارسال آماده می‌شود. برای پیگیری از پشتیبانی آنلاین استفاده کنید.</p><button class="b1" style="margin-top:22px" onclick="location.href=location.pathname">بازگشت به فروشگاه</button></div>`;
  };
}
function sendEmail(order, f) {
  const E = CFG.EMAILJS || {}; if (!E.service || !E.template || !E.publicKey) return;
  const params = {
    order_code: order.code, name: f.name, phone: f.phone, address: `${f.province}، ${f.city}، ${f.address}`, postal: f.postal,
    items: Object.keys(cart).map(id => `${P(id) ? P(id).name : id} × ${cart[id]}`).join("\n"),
    total: Number(order.total).toLocaleString("en-US") + " تومان", shipping: shipSel().value === "tipax" ? "تیپاکس" : "پست پیشتاز", site: "دود آرا"
  };
  const go = () => window.emailjs.send(E.service, E.template, params, { publicKey: E.publicKey }).catch(() => {});
  if (window.emailjs) return go();
  const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"; s.onload = go; document.head.appendChild(s);
}

/* ---------- chat ---------- */
const chatUid = (() => { let u = localStorage.getItem("dd_uid"); if (!u) { u = "u" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); try { localStorage.setItem("dd_uid", u); } catch {} } return u; })();
const msgs = $("#msgs"); let poll, lastLen = -1;
const fmtT = t => fa(new Date(t).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }));
function drawChat(list) {
  if (list.length === lastLen) return; lastLen = list.length;
  msgs.innerHTML = "";
  const all = [{ from: "admin", text: "سلام، به دود آرا خوش آمدید. سؤالتان را بپرسید؛ پشتیبان به‌زودی پاسخ می‌دهد.", t: 0 }, ...list];
  all.forEach(m => { const d = document.createElement("div"); d.className = "m" + (m.from === "user" ? " me" : ""); if (m.img) { const i = new Image(); i.src = m.img; i.onclick = () => zoom(m.img); d.appendChild(i); } if (m.text) { const s = document.createElement("div"); s.textContent = m.text; d.appendChild(s); } if (m.t) { const s = document.createElement("small"); s.textContent = fmtT(m.t); d.appendChild(s); } msgs.appendChild(d); });
  msgs.scrollTop = msgs.scrollHeight;
}
async function fetchChat() { if (!API) return; try { const d = await api("/api/chat/" + chatUid); drawChat(d.messages || []); } catch {} }
function openChat() { openM("m-chat"); lastLen = -1; drawChat([]); fetchChat(); clearInterval(poll); poll = setInterval(fetchChat, 4000); }
function stopPoll() { clearInterval(poll); }
async function sendChat(text, img) {
  try { await api("/api/chat/" + chatUid, { method: "POST", body: JSON.stringify({ text, img, name: (ls.get("dd_addr", {}) || {}).name || "" }) }); fetchChat(); }
  catch (e) { toast(e.status === 403 ? "امکان ارسال پیام برای شما وجود ندارد" : "پیام ارسال نشد"); }
}
$("#bSend").onclick = () => { const v = $("#cT").value.trim(); if (!v) return; $("#cT").value = ""; sendChat(v, ""); };
$("#cT").onkeydown = e => { if (e.key === "Enter") $("#bSend").click(); };
$("#bImg").onclick = () => $("#fImg").click();
$("#fImg").onchange = async e => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  if (!CFG.IMGBB) return toast("ارسال تصویر فعال نیست");
  toast("در حال ارسال تصویر…");
  try { const url = await uploadImg(f); sendChat("", url); } catch { toast("ارسال تصویر انجام نشد"); }
};
async function uploadImg(file) {
  const bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 900 / Math.max(bmp.width, bmp.height)), c = document.createElement("canvas");
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  const b64 = c.toDataURL("image/webp", .82).split(",")[1];
  const fd = new FormData(); fd.append("image", b64);
  const r = await fetch("https://api.imgbb.com/1/upload?key=" + CFG.IMGBB, { method: "POST", body: fd }); const d = await r.json();
  if (!d.success) throw 0; return d.data.url;
}

/* ---------- reveal + tilt ---------- */
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("shown"); io.unobserve(e.target); } }), { threshold: .12 });
function reveal() { $$(".sec .st,.sec .grid,.bento,.about,.q,footer,.steps,.stats,.posts").forEach(el => { if (!el.classList.contains("rv")) { el.classList.add("rv"); io.observe(el); } }); }
document.addEventListener("click", e => { const a = e.target.closest("[data-add],#qa"); if (a) { a.classList.remove("pop"); void a.offsetWidth; a.classList.add("pop"); $$("#cn,#cn2").forEach(c => { c.classList.remove("bump"); void c.offsetWidth; c.classList.add("bump"); }); } }, true);
const finePointer = matchMedia("(hover:hover) and (pointer:fine)").matches && !matchMedia("(prefers-reduced-motion:reduce)").matches;
function bindTilt() {
  if (!finePointer) return;
  document.querySelectorAll(".card:not([data-t]),.tile:not([data-t])").forEach(el => {
    el.dataset.t = 1; el.classList.add("tilt");
    const tile = el.classList.contains("tile"), deg = tile ? 9 : 14;
    el.addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      const r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      el.classList.add("t-on");
      el.style.transform = `perspective(800px) rotateY(${(px - .5) * deg}deg) rotateX(${(.5 - py) * deg}deg) translateZ(6px)`;
      el.style.setProperty("--gx", px * 100 + "%"); el.style.setProperty("--gy", py * 100 + "%");
      el.style.setProperty("--mx", px * 100 + "%"); el.style.setProperty("--my", py * 100 + "%");
      el.style.setProperty("--px", (px - .5) * 2); el.style.setProperty("--py", (py - .5) * 2);
    });
    el.addEventListener("pointerleave", () => { el.classList.remove("t-on"); el.style.transform = ""; el.style.setProperty("--px", 0); el.style.setProperty("--py", 0); });
  });
}

/* ---------- featured rail arrows ---------- */
const rail = $("#rail");
const railStep = dir => rail.scrollBy({ left: dir * Math.max(200, rail.clientWidth * .8) });
$("#rNext").onclick = () => railStep(-1);   // RTL: "next" moves toward the left
$("#rPrev").onclick = () => railStep(1);

/* ---------- scroll: progress bar + auto-hiding header ---------- */
(function () {
  const prog = $("#prog"), hdr = $("#hdr"); let lastY = scrollY, ticking = false;
  const upd = () => {
    ticking = false;
    const y = scrollY, max = document.documentElement.scrollHeight - innerHeight;
    hdr.classList.toggle("top", y < 30);
    prog.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
    if (Math.abs(y - lastY) < 6 && y >= 260) return;
    if (y > 260 && y > lastY && !stack.length) hdr.classList.add("hid");
    else hdr.classList.remove("hid");
    lastY = y;
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
  upd();
})();

/* ---------- cart bar + fly to cart ---------- */
$("#cbar").onclick = () => { renderCart(); openM("m-cart"); };
function flyToCart(src) {
  try {
    const im = src && src.querySelector("img"); const tgt = $$("[data-nav=cart]").find(b => b.offsetParent !== null); if (!im || !tgt || matchMedia("(prefers-reduced-motion:reduce)").matches) return;
    const a = im.getBoundingClientRect(), b = tgt.getBoundingClientRect(), c = im.cloneNode();
    c.className = "fly"; Object.assign(c.style, { left: a.left + "px", top: a.top + "px", width: a.width + "px", height: a.height + "px" });
    document.body.appendChild(c);
    requestAnimationFrame(() => { Object.assign(c.style, { left: b.left + b.width / 2 - 14 + "px", top: b.top + 4 + "px", width: "28px", height: "28px", opacity: ".3", borderRadius: "50%" }); });
    setTimeout(() => c.remove(), 750);
  } catch {}
}

/* ---------- push notifications ---------- */
const PUSH_OK = !!(CFG.VAPID && API && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window);
const keyBytes = k => Uint8Array.from(atob(k.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((k.length + 3) % 4)), c => c.charCodeAt(0));
const todayStr = () => new Date().toISOString().slice(0, 10);
async function pushSubscribe() {
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(CFG.VAPID) });
  await api("/api/push/subscribe", { method: "POST", body: JSON.stringify({ sub: sub.toJSON() }) });
  ls.set("dd_push_day", todayStr());
}
async function pushSeen() {
  if (!PUSH_OK || Notification.permission !== "granted" || ls.get("dd_push_day", "") === todayStr()) return;
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (!sub) return pushSubscribe();
    const d = await api("/api/push/seen", { method: "POST", body: JSON.stringify({ endpoint: sub.endpoint }) });
    if (!d.known) await pushSubscribe(); else ls.set("dd_push_day", todayStr());
  } catch {}
}
function showPushAsk(force) {
  if (!PUSH_OK || Notification.permission !== "default") return;
  if (!force && Date.now() - ls.get("dd_push_no", 0) < 7 * 864e5) return;
  if (stack.length) return setTimeout(() => showPushAsk(force), 8000);
  $("#np").classList.add("on");
}
$("#npNo").onclick = () => { $("#np").classList.remove("on"); ls.set("dd_push_no", Date.now()); };
$("#npYes").onclick = async () => {
  $("#np").classList.remove("on");
  try { const p = await Notification.requestPermission(); if (p === "granted") { await pushSubscribe(); toast("اعلان‌ها فعال شد 💚"); } else ls.set("dd_push_no", Date.now()); }
  catch { toast("فعال‌سازی اعلان انجام نشد"); }
};
if (PUSH_OK) { setTimeout(() => showPushAsk(false), 25000); setTimeout(pushSeen, 4000); }

/* ---------- boot ---------- */
if (!sessionStorage.getItem("dd_v")) { sessionStorage.setItem("dd_v", 1); track("visit"); }
badge(); reveal(); load();
addEventListener("hashchange", openFromHash);
})();
