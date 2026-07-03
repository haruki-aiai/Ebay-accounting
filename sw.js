// eBay会計 サービスワーカー — アプリ本体をキャッシュしてオフライン起動を可能にする
const CACHE = 'ebay-acct-v5';
const ASSETS = [
  './',
  './home.html',
  './index.html',
  './expense.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  // GET以外（GASへのPOST等）はキャッシュ対象外
  if (req.method !== 'GET') return;
  // GAS（データAPI）は常にネットワーク優先で最新を取得
  if (req.url.includes('script.google.com')) {
    e.respondWith(fetch(req).catch(() => new Response('{"ok":false,"error":"offline"}', { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  // HTML本体（ページ遷移）はネットワーク優先 → コード更新が即反映される。オフライン時のみキャッシュ
  if (req.mode === 'navigate' || req.destination === 'document') {
    e.respondWith(
      fetch(req)
        .then(res => { caches.open(CACHE).then(c => c.put(req, res.clone())); return res; })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }
  // その他のアセット（JS/アイコン）はキャッシュ優先
  e.respondWith(caches.match(req).then(r => r || fetch(req)));
});
