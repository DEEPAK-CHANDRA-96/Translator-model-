/* Offline-first SW: cache all app shell on install, serve cache-first. */
const C = "palash-v1";
const A = ["./","./index.html","./css/style.css","./js/dictionaries.js","./js/translator.js","./js/speech.js","./js/worksheets.js","./js/app.js","./data/fln_lessons.json","./manifest.json"];
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(A)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", e => { e.respondWith(caches.match(e.request).then(h => h || fetch(e.request).then(r => { const cp = r.clone(); caches.open(C).then(c => c.put(e.request, cp)); return r; }).catch(() => caches.match("./index.html")))); });
