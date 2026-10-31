/* Dodara service worker — fast repeat visits */
const V = "dodara-v8";
const CORE = ["/", "/style.css", "/app.js", "/config.js", "/assets/tin-front.webp", "/assets/tin-right.webp", "/assets/tin-back.webp", "/assets/tin-top.webp", "/assets/tin-hero.webp", "/assets/icon-192.png", "/assets/logo-full.webp"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.hostname.endsWith("workers.dev") || u.pathname.startsWith("/p/") || u.pathname.startsWith("/c/") || u.pathname.endsWith(".xml") || u.pathname.endsWith(".txt")) return;
  const isImg = r.destination === "image" || u.hostname === "i.ibb.co";
  const isStatic = u.origin === location.origin && /\.(css|js|webp|png|jpg|svg|woff2?)$/.test(u.pathname);
  const isFont = /jsdelivr|gstatic|googleapis/.test(u.hostname);
  if (isImg || isFont) { // cache-first
    e.respondWith(caches.match(r).then(h => h || fetch(r).then(res => { if (res.ok || res.type === "opaque") { const cl = res.clone(); caches.open(V).then(c => c.put(r, cl)); } return res; })));
  } else if (isStatic || r.mode === "navigate") { // network-first: updates show immediately, cache only when offline
    e.respondWith(fetch(r).then(res => { if (res.ok) { const cl = res.clone(); caches.open(V).then(c => c.put(r, cl)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: r.mode === "navigate" })));
  }
});

/* ---------- push notifications ---------- */
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { body: e.data && e.data.text() }; }
  const opt = { body: d.body || "", icon: "/assets/icon-192.png", badge: "/assets/icon-192.png", dir: "rtl", lang: "fa", tag: d.tag || "dodara", renotify: true, data: { url: d.url || "/" } };
  if (d.image) opt.image = d.image;
  e.waitUntil(self.registration.showNotification(d.title || "دود آرا", opt));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL(e.notification.data && e.notification.data.url || "/", self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    for (const w of ws) if (w.url.startsWith(self.location.origin) && "focus" in w) { w.navigate(url); return w.focus(); }
    return clients.openWindow(url);
  }));
});
