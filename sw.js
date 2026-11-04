// Service worker: ưu tiên mạng, dùng bản lưu khi mất mạng
const CACHE = 'binhmy-qltk-v1';
const SHELL = [
  './', './index.html', './css/styles.css', './icon.svg', './manifest.webmanifest',
  './js/main.js', './js/app.js', './js/config.js', './js/utils.js', './js/icons.js', './js/db.js',
  './js/model.js', './js/columns.js', './js/forms.js', './js/views.js', './js/insights.js', './js/export.js', './js/files.js', './js/bulk.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }) // luôn hỏi lại máy chủ để nhận bản cập nhật mới nhất
      .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
