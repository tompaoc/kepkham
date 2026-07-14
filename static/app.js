/* KepKham UI v2 — shared chrome + juice layer */
const API = "";

/* โหมดออฟไลน์ (build_static.py ตั้ง window.KK_STATIC=true ให้): ไม่มีเซิร์ฟเวอร์
   ทุก /api/* ถูกตอบโดย kk-local.js ในเครื่อง — หน้าเว็บไม่ต้องรู้เรื่องเลย */
const KK_READY = window.KK_STATIC ? KK.init() : Promise.resolve();

async function apiGet(path) {
    if (window.KK_STATIC) { await KK_READY; return KK.get(path); }
    const res = await fetch(API + path);
    if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
    return res.json();
}

async function apiPost(path, body) {
    if (window.KK_STATIC) { await KK_READY; return KK.post(path, body); }
    const res = await fetch(API + path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
    return res.json();
}

/* หน้า review/unit อุ่นเสียงล่วงหน้าด้วย fetch('/api/tts?...') ตรงๆ —
   โหมดออฟไลน์เปลี่ยนให้ชี้ไฟล์ mp3 จริงแทน โดยไม่ต้องแก้โค้ดหน้าเว็บ */
if (window.KK_STATIC) {
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input?.url || "";
        if (url.startsWith("/api/tts")) {
            const q = new URLSearchParams(url.split("?")[1] || "");
            await KK_READY;
            return nativeFetch(await KK.audioUrl(q.get("text") || "", q.get("voice"), q.get("rate")));
        }
        return nativeFetch(input, init);
    };
}

function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
}

function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/* ---------- ไอคอนระบบ (Phosphor Icons, duotone, MIT license — self-hosted, ไม่พึ่ง CDN)
   ใช้แทน emoji เฉพาะ "chrome" ที่เป็นโครงสร้าง/ฟังก์ชัน (nav, ปุ่มระบบ, pill) เพื่อให้เส้น/
   น้ำหนักตรงกันทั้งแอป — ไอคอนเนื้อหา (ธีมหน่วยเรียน, ของวิเศษใน board) ยังเป็น emoji ต่อ
   เพราะสื่อ "ของสะสมสนุกๆ" ได้ดีกว่า (Duolingo เองก็คงไอคอนวิชาสีสันไว้ ใช้ระบบไอคอนจริง
   แค่กับ nav/ปุ่มฟังก์ชันเหมือนกัน) ---------- */
const ICON_PATHS = {
    house: '<path d="M216,120v96H152V152H104v64H40V120a8,8,0,0,1,2.34-5.66l80-80a8,8,0,0,1,11.32,0l80,80A8,8,0,0,1,216,120Z" opacity="0.2"/><path d="M219.31,108.68l-80-80a16,16,0,0,0-22.62,0l-80,80A15.87,15.87,0,0,0,32,120v96a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V160h32v56a8,8,0,0,0,8,8h64a8,8,0,0,0,8-8V120A15.87,15.87,0,0,0,219.31,108.68ZM208,208H160V152a8,8,0,0,0-8-8H104a8,8,0,0,0-8,8v56H48V120l80-80,80,80Z"/>',
    map: '<path d="M160,72V216L96,184V40Z" opacity="0.2"/><path d="M228.92,49.69a8,8,0,0,0-6.86-1.45L160.93,63.52,99.58,32.84a8,8,0,0,0-5.52-.6l-64,16A8,8,0,0,0,24,56V200a8,8,0,0,0,9.94,7.76l61.13-15.28,61.35,30.68A8.15,8.15,0,0,0,160,224a8,8,0,0,0,1.94-.24l64-16A8,8,0,0,0,232,200V56A8,8,0,0,0,228.92,49.69ZM104,52.94l48,24V203.06l-48-24ZM40,62.25l48-12v127.5l-48,12Zm176,131.5-48,12V78.25l48-12Z"/>',
    repeat: '<path d="M216,128a88,88,0,1,1-88-88A88,88,0,0,1,216,128Z" opacity="0.2"/><path d="M224,48V96a8,8,0,0,1-8,8H168a8,8,0,0,1,0-16h28.69L182.06,73.37a79.56,79.56,0,0,0-56.13-23.43h-.45A79.52,79.52,0,0,0,69.59,72.71,8,8,0,0,1,58.41,61.27a96,96,0,0,1,135,.79L208,76.69V48a8,8,0,0,1,16,0ZM186.41,183.29a80,80,0,0,1-112.47-.66L59.31,168H88a8,8,0,0,0,0-16H40a8,8,0,0,0-8,8v48a8,8,0,0,0,16,0V179.31l14.63,14.63A95.43,95.43,0,0,0,130,222.06h.53a95.36,95.36,0,0,0,67.07-27.33,8,8,0,0,0-11.18-11.44Z"/>',
    backpack: '<path d="M208,96V216a8,8,0,0,1-8,8H176V152a16,16,0,0,0-16-16H96a16,16,0,0,0-16,16v72H56a8,8,0,0,1-8-8V96A48,48,0,0,1,96,48h64A48,48,0,0,1,208,96Z" opacity="0.2"/><path d="M168,40.58V32A24,24,0,0,0,144,8H112A24,24,0,0,0,88,32v8.58A56.09,56.09,0,0,0,40,96V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V96A56.09,56.09,0,0,0,168,40.58ZM112,24h32a8,8,0,0,1,8,8v8H104V32A8,8,0,0,1,112,24Zm56,136H88v-8a8,8,0,0,1,8-8h64a8,8,0,0,1,8,8ZM88,176h48v8a8,8,0,0,0,16,0v-8h16v40H88Zm112,40H184V152a24,24,0,0,0-24-24H96a24,24,0,0,0-24,24v64H56V96A40,40,0,0,1,96,56h64a40,40,0,0,1,40,40V216ZM152,88a8,8,0,0,1-8,8H112a8,8,0,0,1,0-16h32A8,8,0,0,1,152,88Z"/>',
    notepencil: '<path d="M200,88l-72,72H96V128l72-72Z" opacity="0.2"/><path d="M229.66,58.34l-32-32a8,8,0,0,0-11.32,0l-96,96A8,8,0,0,0,88,128v32a8,8,0,0,0,8,8h32a8,8,0,0,0,5.66-2.34l96-96A8,8,0,0,0,229.66,58.34ZM124.69,152H104V131.31l64-64L188.69,88ZM200,76.69,179.31,56,192,43.31,212.69,64ZM224,128v80a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V48A16,16,0,0,1,48,32h80a8,8,0,0,1,0,16H48V208H208V128a8,8,0,0,1,16,0Z"/>',
    fire: '<path d="M208,144a80,80,0,0,1-160,0c0-30.57,14.42-58.26,31-80l33,32,26.27-72C159.86,41.92,208,88.15,208,144Z" opacity="0.2"/><path d="M183.89,153.34a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68ZM216,144a88,88,0,0,1-176,0c0-27.92,11-56.47,32.66-84.85a8,8,0,0,1,11.93-.89l24.12,23.41,22-60.41a8,8,0,0,1,12.63-3.41C165.21,36,216,84.55,216,144Zm-16,0c0-46.09-35.79-85.92-58.21-106.33L119.52,98.74a8,8,0,0,1-13.09,3L80.06,76.16C64.09,99.21,56,122,56,144a72,72,0,0,0,144,0Z"/>',
    coin: '<path d="M232,104c0,24-40,48-104,48S24,128,24,104,64,56,128,56,232,80,232,104Z" opacity="0.2"/><path d="M207.58,63.84C186.85,53.48,159.33,48,128,48S69.15,53.48,48.42,63.84,16,88.78,16,104v48c0,15.22,11.82,29.85,32.42,40.16S96.67,208,128,208s58.85-5.48,79.58-15.84S240,167.22,240,152V104C240,88.78,228.18,74.15,207.58,63.84ZM128,64c62.64,0,96,23.23,96,40s-33.36,40-96,40-96-23.23-96-40S65.36,64,128,64Zm-8,95.86v32c-19-.62-35-3.42-48-7.49V153.05A203.43,203.43,0,0,0,120,159.86Zm16,0a203.43,203.43,0,0,0,48-6.81v31.31c-13,4.07-29,6.87-48,7.49ZM32,152V133.53a82.88,82.88,0,0,0,16.42,10.63c2.43,1.21,5,2.35,7.58,3.43V178C40.17,170.16,32,160.29,32,152Zm168,26V147.59c2.61-1.08,5.15-2.22,7.58-3.43A82.88,82.88,0,0,0,224,133.53V152C224,160.29,215.83,170.16,200,178Z"/>',
    speaker: '<path d="M80,88v80H32a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8Z" opacity="0.2"/><path d="M155.51,24.81a8,8,0,0,0-8.42.88L77.25,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V32A8,8,0,0,0,155.51,24.81ZM32,96H72v64H32ZM144,207.64,88,164.09V91.91l56-43.55Zm54-106.08a40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.58,24,24,0,0,0,0-31.72,8,8,0,0,1,12-10.58ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z"/>',
    speakermute: '<path d="M80,88v80H32a8,8,0,0,1-8-8V96a8,8,0,0,1,8-8Z" opacity="0.2"/><path d="M53.92,34.62A8,8,0,1,0,42.08,45.38L73.55,80H32A16,16,0,0,0,16,96v64a16,16,0,0,0,16,16H77.25l69.84,54.31A8,8,0,0,0,160,224V175.09l42.08,46.29a8,8,0,1,0,11.84-10.76ZM32,96H72v64H32ZM144,207.64,88,164.09V95.89l56,61.6Zm42-63.77a24,24,0,0,0,0-31.72,8,8,0,1,1,12-10.57,40,40,0,0,1,0,52.88,8,8,0,0,1-12-10.59Zm-80.16-76a8,8,0,0,1,1.4-11.23l39.85-31A8,8,0,0,1,160,32v74.83a8,8,0,0,1-16,0V48.36l-26.94,21A8,8,0,0,1,105.84,67.91ZM248,128a79.9,79.9,0,0,1-20.37,53.34,8,8,0,0,1-11.92-10.67,64,64,0,0,0,0-85.33,8,8,0,1,1,11.92-10.67A79.83,79.83,0,0,1,248,128Z"/>',
    play: '<path d="M228.23,134.69,84.15,222.81A8,8,0,0,1,72,216.12V39.88a8,8,0,0,1,12.15-6.69l144.08,88.12A7.82,7.82,0,0,1,228.23,134.69Z" opacity="0.2"/><path d="M232.4,114.49,88.32,26.35a16,16,0,0,0-16.2-.3A15.86,15.86,0,0,0,64,39.87V216.13A15.94,15.94,0,0,0,80,232a16.07,16.07,0,0,0,8.36-2.35L232.4,141.51a15.81,15.81,0,0,0,0-27ZM80,215.94V40l143.83,88Z"/>',
    mic: '<path d="M168,64v64a40,40,0,0,1-40,40h0a40,40,0,0,1-40-40V64a40,40,0,0,1,40-40h0A40,40,0,0,1,168,64Z" opacity="0.2"/><path d="M128,176a48.05,48.05,0,0,0,48-48V64a48,48,0,0,0-96,0v64A48.05,48.05,0,0,0,128,176ZM96,64a32,32,0,0,1,64,0v64a32,32,0,0,1-64,0Zm40,143.6V240a8,8,0,0,1-16,0V207.6A80.11,80.11,0,0,1,48,128a8,8,0,0,1,16,0,64,64,0,0,0,128,0,8,8,0,0,1,16,0A80.11,80.11,0,0,1,136,207.6Z"/>',
    bank: '<path d="M240,112v32a16,16,0,0,1-16,16h-8l-18.1,50.69a8,8,0,0,1-7.54,5.31H177.64a8,8,0,0,1-7.54-5.31L166.29,200H97.71L93.9,210.69A8,8,0,0,1,86.36,216H73.64a8,8,0,0,1-7.54-5.31L53,174a79.7,79.7,0,0,1-21-54h0a80,80,0,0,1,80-80h32a80,80,0,0,1,73.44,48.22,82.22,82.22,0,0,1,2.9,7.78H224A16,16,0,0,1,240,112Z" opacity="0.2"/><path d="M192,116a12,12,0,1,1-12-12A12,12,0,0,1,192,116ZM152,64H112a8,8,0,0,0,0,16h40a8,8,0,0,0,0-16Zm96,48v32a24,24,0,0,1-24,24h-2.36l-16.21,45.38A16,16,0,0,1,190.36,224H177.64a16,16,0,0,1-15.07-10.62L160.65,208h-57.3l-1.92,5.38A16,16,0,0,1,86.36,224H73.64a16,16,0,0,1-15.07-10.62L46,178.22a87.69,87.69,0,0,1-21.44-48.38A16,16,0,0,0,16,144a8,8,0,0,1-16,0,32,32,0,0,1,24.28-31A88.12,88.12,0,0,1,112,32H216a8,8,0,0,1,0,16H194.61a87.93,87.93,0,0,1,30.17,37c.43,1,.85,2,1.25,3A24,24,0,0,1,248,112Zm-16,0a8,8,0,0,0-8-8h-3.66a8,8,0,0,1-7.64-5.6A71.9,71.9,0,0,0,144,48H112A72,72,0,0,0,58.91,168.64a8,8,0,0,1,1.64,2.71L73.64,208H86.36l3.82-10.69A8,8,0,0,1,97.71,192h68.58a8,8,0,0,1,7.53,5.31L177.64,208h12.72l18.11-50.69A8,8,0,0,1,216,152h8a8,8,0,0,0,8-8Z"/>',
    check: '<path d="M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z" opacity="0.2"/><path d="M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z"/>',
    plus: '<path d="M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z" opacity="0.2"/><path d="M224,128a8,8,0,0,1-8,8H136v80a8,8,0,0,1-16,0V136H40a8,8,0,0,1,0-16h80V40a8,8,0,0,1,16,0v80h80A8,8,0,0,1,224,128Z"/>',
    sparkle: '<path d="M194.82,151.43l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0l-20.3-55.09-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3A7.92,7.92,0,0,1,194.82,151.43Z" opacity="0.2"/><path d="M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z"/>',
    search: '<path d="M192,112a80,80,0,1,1-80-80A80,80,0,0,1,192,112Z" opacity="0.2"/><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"/>',
    moon: '<path d="M227.89,147.89A96,96,0,1,1,108.11,28.11,96.09,96.09,0,0,0,227.89,147.89Z" opacity="0.2"/><path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.34A88,88,0,0,1,65.66,67.11a89,89,0,0,1,31.4-26A106,106,0,0,0,96,56,104.11,104.11,0,0,0,200,160a106,106,0,0,0,14.92-1.06A89,89,0,0,1,188.9,190.34Z"/>',
    sun: '<path d="M184,128a56,56,0,1,1-56-56A56,56,0,0,1,184,128Z" opacity="0.2"/><path d="M120,40V32a8,8,0,0,1,16,0v8a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-8-8A8,8,0,0,0,50.34,61.66Zm0,116.68-8,8a8,8,0,0,0,11.32,11.32l8-8a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l8-8a8,8,0,0,0-11.32-11.32l-8,8A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l8,8a8,8,0,0,0,11.32-11.32ZM40,120H32a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Zm88,88a8,8,0,0,0-8,8v8a8,8,0,0,0,16,0v-8A8,8,0,0,0,128,208Zm96-88h-8a8,8,0,0,0,0,16h8a8,8,0,0,0,0-16Z"/>',
    themeauto: '<path d="M224,128a96,96,0,0,1-96,96V32A96,96,0,0,1,224,128Z" opacity="0.2"/><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24ZM40,128a88.11,88.11,0,0,1,80-87.63V215.63A88.11,88.11,0,0,1,40,128Zm96,87.63V40.37a88,88,0,0,1,0,175.26Z"/>',
};

/* ธีม: หมุน auto → light → dark (auto = ตาม OS)
   data-theme บน <html> ชนะ @media เสมอ ทั้งสองทาง — ผู้ใช้เลือกทับ OS ได้ */
const THEME_CYCLE = ["auto", "light", "dark"];
const THEME_ICON = { auto: "themeauto", light: "sun", dark: "moon" };
const _osDark = window.matchMedia("(prefers-color-scheme: dark)");
function currentTheme() { return localStorage.getItem("kk_theme") || "auto"; }
function applyTheme(mode) {
    // "auto" = แปลงเป็น light/dark จริงตาม OS แล้ว set data-theme เสมอ
    // (CSS จึงมี dark block เดียว — auto กับ toggle ใช้ selector เดียวกัน)
    const effective = mode === "auto" ? (_osDark.matches ? "dark" : "light") : mode;
    document.documentElement.setAttribute("data-theme", effective);
    localStorage.setItem("kk_theme", mode);
}
applyTheme(currentTheme());   // เรียกทันทีตอนโหลด script กันหน้าจอกระพริบสว่างก่อนสลับ
_osDark.addEventListener("change", () => { if (currentTheme() === "auto") applyTheme("auto"); });

function icon(name, cls) {
    const path = ICON_PATHS[name];
    if (!path) return "";
    return `<svg class="icon${cls ? " " + cls : ""}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${path}</svg>`;
}

/* ---------- Chrome: header + tab bar (ฉีดทุกหน้า — จุดเดียว เลิก copy-paste) ---------- */
/* path ทั้งหมดเป็น relative (ไม่มี / นำหน้า) — ต้องทำงานได้ทั้งบน uvicorn ที่ราก /
   และบน GitHub Pages ที่แอปอยู่ใต้ /kepkham/ ถ้าใส่ / นำหน้าเมื่อไหร่ กดบน Pages
   จะเด้งออกนอกแอปแล้ว 404 (ทุกหน้าอยู่โฟลเดอร์เดียวกัน relative จึงถูกเสมอ) */
const TABS = [
    { id: "home",   href: "index.html",       iconName: "house",    label: "วันนี้" },
    { id: "path",   href: "index.html#path",  iconName: "map",      label: "เส้นทาง" },
    { id: "review", href: "review.html",      iconName: "repeat",   label: "ทบทวน" },
    { id: "board",  href: "board.html",       iconName: "backpack", label: "กระเป๋า" },
    { id: "inbox",  href: "inbox.html",       iconName: "notepencil", label: "จดไว้" },
];
/* nav ล่าง = ตาม mockup (ไอคอน raster + label ฟาร์ม) */
const NAV = [
    { id: "home",   href: "index.html",  label: "หน้าหลัก", svg: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="rgba(251,235,184,.22)"/></svg>' },
    { id: "board",  href: "board.html",  label: "คลังคำ",  img: "static/art/nav_words.png" },
    { id: "review", href: "review.html", label: "ทบทวน",   img: "static/art/nav_review.png" },
    { id: "inbox",  href: "inbox.html",  label: "จดไว้",   img: "static/art/nav_notes.png" },
];

function initChrome(active) {
    const header = `
        <header class="kk-header">
            <h1><a href="index.html">🫙 เก็บคำ</a></h1>
            <nav class="top-nav">
                ${TABS.filter(t => t.id !== "path").map(t => `
                    <a href="${t.href}" class="${t.id === active ? "active" : ""}">${t.label}</a>`).join("")}
            </nav>
            <div class="kk-pills">
                <button class="kk-pill" id="pill-coins" onclick="location.href='board.html'">${icon("coin", "pill-ic")} <span class="num" id="coin-num">–</span></button>
                <button class="kk-pill" id="pill-streak" onclick="location.href='index.html'"><span id="streak-flame">${icon("fire", "pill-ic")}</span> <span class="num" id="streak-num">–</span></button>
                <button class="kk-pill" id="pill-theme" title="สลับสว่าง/มืด"></button>
                <button class="kk-pill" id="pill-mute" title="เปิด/ปิดเสียง"></button>
            </div>
        </header>`;
    const tabbar = `
        <nav class="tabbar">
            ${NAV.map(t => `
                <a class="tab ${t.id === active ? "active" : ""}" href="${t.href}">
                    <span class="t-ico">${t.svg ? t.svg : `<img class="tab-img" src="${t.img}" alt="">`}</span>
                    <span class="t-lbl">${t.label}</span>
                </a>`).join("")}
        </nav>`;
    document.body.dataset.page = active;
    document.body.insertAdjacentHTML("afterbegin", header);
    document.body.insertAdjacentHTML("beforeend", tabbar);

    const muteBtn = document.getElementById("pill-mute");
    const paintMute = () => { muteBtn.innerHTML = icon(sfx.muted() ? "speakermute" : "speaker", "pill-ic"); };
    muteBtn.onclick = () => { sfx.toggleMute(); paintMute(); };
    paintMute();

    const themeBtn = document.getElementById("pill-theme");
    const paintTheme = () => { themeBtn.innerHTML = icon(THEME_ICON[currentTheme()], "pill-ic"); };
    themeBtn.onclick = () => {
        const next = THEME_CYCLE[(THEME_CYCLE.indexOf(currentTheme()) + 1) % THEME_CYCLE.length];
        applyTheme(next);
        paintTheme();
    };
    paintTheme();

    refreshPills();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
}

let _lastStats = null;
async function refreshPills() {
    try {
        const s = await apiGet("/api/stats");
        _lastStats = s;
        const coinEl = document.getElementById("coin-num");
        const streakEl = document.getElementById("streak-num");
        if (coinEl) countUp(coinEl, parseInt(coinEl.textContent) || 0, s.coins);
        if (streakEl) {
            streakEl.textContent = s.streak_days;
            const flame = document.getElementById("streak-flame");
            flame.className = !s.active_today ? "flame-off"
                : (s.reviewed_today >= s.daily_goal ? "flame-goal" : "");
        }
        return s;
    } catch (e) { return null; }
}

/* เข้ากันได้กับโค้ดหน้าเก่า */
function renderStatsBar() { return refreshPills(); }

/* ---------- โหลดแบบมี error state (เลิกค้าง "กำลังโหลด..." ตลอดกาล) ---------- */
async function safeLoad(containerId, fn) {
    const el = document.getElementById(containerId);
    try {
        await fn();
    } catch (e) {
        el.innerHTML = `
            <div class="card error-card">
                <div class="e-ico">😴</div>
                <p>เซิร์ฟเวอร์ยังไม่ตื่น หรือเน็ตสะดุดนิดหน่อย</p>
                <button onclick="location.reload()">ลองใหม่</button>
            </div>`;
    }
}

/* ---------- เสียง: WebAudio synth (ไม่มีไฟล์ asset) ---------- */
const sfx = (() => {
    let ctx = null;
    const get = () => (ctx = ctx || new (window.AudioContext || window.webkitAudioContext)());
    const isMuted = () => localStorage.getItem("kk_mute") === "1";
    function tone(freq, dur, type = "sine", vol = 0.16, when = 0) {
        if (isMuted()) return;
        try {
            const ac = get();
            if (ac.state === "suspended") ac.resume();
            const o = ac.createOscillator(), g = ac.createGain();
            o.type = type; o.frequency.value = freq;
            g.gain.setValueAtTime(vol, ac.currentTime + when);
            g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + when + dur);
            o.connect(g); g.connect(ac.destination);
            o.start(ac.currentTime + when); o.stop(ac.currentTime + when + dur + 0.05);
        } catch (e) {}
    }
    return {
        correct: () => { tone(880, 0.12); tone(1318, 0.16, "sine", 0.13, 0.09); },
        wrong:   () => tone(196, 0.22, "square", 0.09),
        bank:    () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.13, "triangle", 0.14, i * 0.07)),
        bell:    () => { tone(1568, 0.5, "sine", 0.18); tone(2093, 0.4, "sine", 0.07, 0.02); },
        fanfare: () => [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.13, i * 0.1)),
        muted: isMuted,
        toggleMute: () => localStorage.setItem("kk_mute", isMuted() ? "0" : "1"),
    };
})();

/* ---------- Confetti (~30 บรรทัด ไม่ใช้ library) ---------- */
function confetti(n = 36) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (let i = 0; i < n; i++) {
        const p = document.createElement("div");
        p.style.cssText = `position:fixed; z-index:99; pointer-events:none;
            width:${6 + Math.random() * 6}px; height:${8 + Math.random() * 8}px;
            left:${Math.random() * 100}vw; top:-16px;
            background:hsl(${Math.random() * 360},85%,60%);
            border-radius:${Math.random() > 0.5 ? "50%" : "2px"};
            transform:rotate(${Math.random() * 360}deg);`;
        document.body.appendChild(p);
        p.animate([
            { transform: p.style.transform, top: "-16px", opacity: 1 },
            { transform: `rotate(${Math.random() * 720}deg)`, top: "105vh", opacity: 0.7 },
        ], { duration: 1400 + Math.random() * 800, easing: "cubic-bezier(.2,.6,.4,1)" })
            .onfinish = () => p.remove();
    }
}

/* ---------- ตัวเลขนับขึ้น ---------- */
function countUp(el, from, to, dur = 600) {
    if (from === to) { el.textContent = to; return; }
    const t0 = performance.now();
    (function step(t) {
        const k = Math.min(1, (t - t0) / dur);
        el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
    })(t0);
    // rAF ไม่ fire ตอน tab ถูกซ่อน — การันตีค่าปลายทางเสมอ
    setTimeout(() => { el.textContent = to; }, dur + 80);
}

/* ---------- เหรียญบินเข้ากระเป๋า ---------- */
function coinFly(fromEl, count = 4) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const target = document.getElementById("pill-coins");
    if (!fromEl || !target) return;
    const f = fromEl.getBoundingClientRect(), t = target.getBoundingClientRect();
    for (let i = 0; i < count; i++) {
        const c = document.createElement("div");
        c.className = "coin-fly";
        c.textContent = "🥟";
        c.style.left = `${f.left + f.width / 2 - 11}px`;
        c.style.top = `${f.top + f.height / 2 - 11}px`;
        document.body.appendChild(c);
        setTimeout(() => {
            c.style.transform = `translate(${t.left + t.width / 2 - (f.left + f.width / 2)}px, ${t.top + t.height / 2 - (f.top + f.height / 2)}px) scale(.5)`;
            c.style.opacity = "0.15";
        }, 30 + i * 90);
        setTimeout(() => c.remove(), 750 + i * 90);
    }
}

/* ---------- เสียงอ่าน: เลือกสำเนียงตาม origin ของ item ---------- */
function voiceFor(item, unitId) {
    const o = item && item.origin;
    if (o === "aussie") return "aussie_m";
    if (o === "irish") return "irish_m";
    if (o === "scottish" || o === "british") return "british_m";
    if (unitId === "bar_life") return "aussie_m";
    return "default";
}

let _audio = null;
async function playAudio(text, voice, btn, rate) {
    if (btn) btn.classList.add("loading");
    if (_audio) _audio.pause();
    const v = voice || "default";
    const r = rate || "normal";
    const src = window.KK_STATIC
        ? (await KK_READY, await KK.audioUrl(text, v, r))
        : `/api/tts?text=${encodeURIComponent(text)}&voice=${v}&rate=${r}`;
    _audio = new Audio(src);
    _audio.play().catch(() => {});
    _audio.onloadeddata = () => { if (btn) btn.classList.remove("loading"); };
    _audio.onerror = () => { if (btn) btn.classList.remove("loading"); };
}

/* delegated listener สำหรับปุ่มเสียง (เลิก inline onclick + esc1 — ปิดช่อง quote-break) */
document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-say]");
    if (!btn) return;
    playAudio(btn.dataset.say, btn.dataset.voice || "default", btn, btn.dataset.rate || "normal");
});

/* ---------- โมดัลการ์ดคำคม / ปลดของวิเศษ ---------- */
function showQuoteCard({ icon, name_th, rarity, quote, isNew }) {
    const rarityTh = { normal: "ของวิเศษ", gold: "🏅 ระดับทอง", legend: "🌈 ระดับตำนาน" }[rarity] || "";
    const overlay = document.createElement("div");
    overlay.className = "kk-overlay";
    overlay.innerHTML = `
        <div class="quote-card">
            ${isNew ? `<div style="font-family:'Baloo 2'; font-weight:700; color:#B8862E; margin-bottom:6px;">✨ ปลดของวิเศษชิ้นใหม่!</div>` : ""}
            <div class="q-ico">${icon}</div>
            <div class="q-name">${escapeHtml(name_th)}</div>
            <div class="q-rarity">${rarityTh}</div>
            <hr>
            <div class="q-en">"${escapeHtml(quote.text_en)}"
                <button class="play-btn" data-say="${escapeHtml(quote.text_en)}" data-voice="default" style="vertical-align:middle; width:30px; height:30px; min-height:30px; font-size:12px;">${icon("play")}</button>
            </div>
            <div class="q-th">${escapeHtml(quote.text_th)}</div>
            <div class="q-by">— ${escapeHtml(quote.by)}${quote.source ? ` · ${escapeHtml(quote.source)}` : ""}</div>
            <button class="gold" style="margin-top:18px; width:100%;" data-close>เก็บเข้ากระเป๋า</button>
        </div>`;
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay || e.target.closest("[data-close]")) overlay.remove();
    });
    document.body.appendChild(overlay);
    if (isNew) { sfx.bell(); confetti(28); }
}

/* ปลดหลายชิ้นต่อคิว (จาก /api/earn newly_unlocked) */
function celebrateUnlocks(newly) {
    if (!newly || !newly.length) return;
    let i = 0;
    const next = () => {
        if (i >= newly.length) return;
        const s = newly[i++];
        showQuoteCard({ ...s, isNew: true });
        const watcher = setInterval(() => {
            if (!document.querySelector(".kk-overlay")) { clearInterval(watcher); next(); }
        }, 300);
    };
    next();
}
