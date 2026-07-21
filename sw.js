/* KepKham service worker

   แยก cache 2 ก้อน เพราะอายุมันต่างกันมาก:
   - kk-shell-<build>  หน้าเว็บ/โค้ด/เนื้อหา — เปลี่ยนทุกครั้งที่ build ใหม่ ต้องล้างของเก่า
   - kk-audio          ไฟล์เสียง 84 MB — เนื้อหาไม่เคยเปลี่ยน (ชื่อไฟล์คือ hash ของข้อความ)
                       ห้ามลบเด็ดขาด ไม่งั้นอัปเดตแอปทีนึงต้องโหลดเสียงใหม่ทั้งหมด

   เปลือกใช้ stale-while-revalidate: เปิดแอปได้ทันทีจากเครื่อง (ออฟไลน์ก็เปิดได้)
   แล้วแอบโหลดของใหม่ไว้เบื้องหลัง → เปิดรอบหน้าได้เวอร์ชันใหม่เอง */
const BUILD = "20260721-205157";                 // build_static.py แทนค่าให้ตอน build
const SHELL = `kk-shell-${BUILD}`;
const AUDIO = "kk-audio";                  // ชื่อคงที่ — kk-local.js ก็เขียนลงก้อนนี้

const PRECACHE = [
    "./", "index.html", "unit.html", "review.html", "board.html", "inbox.html", "dictation.html",
    "static/style.css", "static/app.js", "static/kk-local.js",
    "manifest.json", "data/content.json", "data/board.json",
];

const isAudio = (url) => url.pathname.includes("/audio/") || url.pathname.startsWith("/api/tts");

self.addEventListener("install", (e) => {
    e.waitUntil(
        caches.open(SHELL)
            // ทีละไฟล์ — ขาดไฟล์เดียว (เช่น data/ ตอนรันโหมดเซิร์ฟเวอร์) ไม่ทำให้พังทั้งชุด
            .then(c => Promise.all(PRECACHE.map(u => c.add(u).catch(() => {}))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys.filter(k => k.startsWith("kk-shell-") && k !== SHELL)
                    .map(k => caches.delete(k))       // ล้างเปลือกเก่า, เสียงรอดทุกครั้ง
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", (e) => {
    if (e.request.method !== "GET") return;
    const url = new URL(e.request.url);

    // เสียง: มีในเครื่องใช้เลย ไม่มีค่อยโหลดแล้วเก็บถาวร
    if (isAudio(url)) {
        e.respondWith(
            caches.open(AUDIO).then(c => c.match(e.request).then(hit =>
                hit || fetch(e.request).then(res => {
                    if (res.ok) c.put(e.request, res.clone());
                    return res;
                })
            ))
        );
        return;
    }

    // /api/* (โหมดเซิร์ฟเวอร์เท่านั้น — โหมดออฟไลน์ตอบเองในหน้า): ของสดเสมอ
    if (url.pathname.startsWith("/api/")) {
        e.respondWith(fetch(e.request).catch(() => caches.match(e.request, { ignoreSearch: true })));
        return;
    }

    // หน้าเว็บ (navigate): เอาของสดจากเน็ตก่อนเสมอ — กันเปลือกเก่าพังค้างใน PWA
    // ออฟไลน์ค่อย fallback cache (ignoreSearch เผื่อ ?v ไม่ตรง) → สุดท้าย index.html
    if (e.request.mode === "navigate") {
        e.respondWith(
            fetch(e.request)
                .then(res => {
                    if (res.ok && res.type === "basic") caches.open(SHELL).then(c => c.put(e.request, res.clone()));
                    return res;
                })
                .catch(() => caches.open(SHELL).then(c =>
                    c.match(e.request, { ignoreSearch: true }).then(h => h || c.match("index.html", { ignoreSearch: true }))
                ))
        );
        return;
    }

    // asset เปลือก (css/js/json/รูป): cache-first ตรงตัว → เน็ต → สุดท้าย ignoreSearch
    // (สำคัญ: ?v=build ต้อง match precache แบบไม่มี query ได้ ไม่งั้นออฟไลน์ JS โหลดไม่ขึ้น = ค้าง)
    e.respondWith(
        caches.open(SHELL).then(c =>
            c.match(e.request).then(hit =>
                hit || fetch(e.request).then(res => {
                    if (res.ok && res.type === "basic") c.put(e.request, res.clone());
                    return res;
                }).catch(() => c.match(e.request, { ignoreSearch: true }))
            )
        )
    );
});
