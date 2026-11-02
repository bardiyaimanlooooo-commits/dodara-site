/* Dodara service worker — instant repeat visits
 * - static files (css/js/images/fonts): served from cache at once, refreshed in the background
 *   (pages reference versioned URLs like style.css?v=15, so a new release fetches new files)
 * - pages: network first, but fall back to the cached page after 3.5 s on a slow connection
 * Bump V on every release: old caches are deleted on activate.
 */
const V = "dodara-v16";
const CORE = ["/", "/assets/fonts/vazirmatn-var.woff2", "/assets/fonts/nastaliq-fa.woff2", "/assets/3d/front.webp?v=2", "/assets/3d/right.webp?v=2", "/assets/3d/back.webp?v=2", "/assets/3d/top.webp?v=2", "/assets/logo-full.webp", "/assets/icon-192.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(V).then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
const put = (req, res) => { if (res && (res.ok || res.type === "opaque")) { const cl = res.clone(); caches.open(V).then(c => c.put(req, cl)).catch(() => {}); } return res; };
self.addEventListener("fetch", e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== "GET") return;
  if (u.hostname.endsWith("workers.dev") || u.pathname.startsWith("/p/") || u.pathname.startsWith("/c/") || u.pathname.endsWith(".xml") || u.pathname.endsWith(".txt")) return;
  const same = u.origin === location.origin;
  if (r.mode === "navigate") {                                   // page: network first, cache after 3.5 s
    e.respondWith(new Promise(resolve => {
      let done = false;
      const fromCache = () => caches.match(r, { ignoreSearch: true }).then(h => h || caches.match("/"));
      const t = setTimeout(() => fromCache().then(h => { if (h && !done) { done = true; resolve(h); } }), 3500);
      fetch(r).then(res => { put(r, res.clone()); if (!done) { done = true; clearTimeout(t); resolve(res); } })
        .catch(() => fromCache().then(h => { if (!done) { done = true; clearTimeout(t); resolve(h || Response.error()); } }));
    }));
    return;
  }
  if (same && (u.pathname === "/config.js" || u.pathname === "/sw.js")) {   // always fresh, cache only as offline fallback
    e.respondWith(fetch(r).then(res => put(r, res)).catch(() => caches.match(r, { ignoreSearch: true })));
    return;
  }
  const isStatic = same && /\.(css|js|webp|png|jpg|svg|woff2?|webmanifest)$/.test(u.pathname);
  const isRemoteImg = !same && (r.destination === "image" || u.hostname === "i.ibb.co");
  if (isStatic || isRemoteImg) {                                 // stale-while-revalidate
    e.respondWith(caches.match(r).then(hit => {
      const net = fetch(r).then(res => put(r, res)).catch(() => hit);
      if (hit) { e.waitUntil(net.then(() => {})); return hit; }
      return net;
    }));
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
