const CACHE='cgpr-parent-portal-v2';
const SHELL=[
  '/portal/',
  '/portal/index.html',
  '/portal/styles.css?v=20260920-2',
  '/portal/app.js?v=20260920-secure1',
  '/portal/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin) return;
  if(req.mode==='navigate'){
    e.respondWith(fetch(req).catch(()=>caches.match('/portal/index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{
    if(res&&res.ok) caches.open(CACHE).then(c=>c.put(req,res.clone()));
    return res;
  })));
});