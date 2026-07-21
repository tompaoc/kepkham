/* kk-local.js — เครื่องยนต์ออฟไลน์
   ทำให้แอปทั้งชุดทำงานในเบราว์เซอร์ล้วนๆ ไม่ต้องมีเซิร์ฟเวอร์ Python

   วิธีทำงาน: ดักที่ apiGet/apiPost ใน app.js แล้วตอบเองด้วย path เดิมทุกอัน
   หน้าเว็บ (index/unit/review/board/inbox) จึงไม่ต้องแก้แม้แต่บรรทัดเดียว

   - เนื้อหา: data/content.json (โหลดครั้งเดียว แล้ว service worker cache ไว้)
   - ความคืบหน้า: IndexedDB บนเครื่อง (คลังคำ/SRS/เหรียญ/แสตมป์/streak/inbox)
   - เสียง: audio/<hash>.mp3 — hash คำนวณเองจาก sha256(voice::rate::text) สูตรเดียวกับ tts.py

   ข้อมูลอยู่บนเครื่องคุณคนเดียว ไม่มีใครแตะได้ แต่ต้องกด "สำรองข้อมูล" เก็บไฟล์ไว้บ้าง
   (เผื่อล้างเบราว์เซอร์/เปลี่ยนเครื่อง) — ปุ่มอยู่หน้ากระเป๋า */

const KK = (() => {
    const DB_NAME = "kepkham", STORE = "state", KEY = "v1";
    const DAILY_GOAL = 10, DAILY_NEW_CAP = 20, STREAK_REPAIR_COST = 50;

    const VOICES = {
        default: "en-US-JennyNeural", clear: "en-US-AriaNeural",
        aussie: "en-AU-NatashaNeural", aussie_m: "en-AU-WilliamNeural",
        irish: "en-IE-EmilyNeural", irish_m: "en-IE-ConnorNeural",
        british: "en-GB-SoniaNeural", british_m: "en-GB-RyanNeural",
    };
    const RATES = { slow: "-20%", normal: "+0%", fast: "+25%" };

    let content = null, board = null, state = null, idb = null;

    /* ---------- IndexedDB (เก็บ state ก้อนเดียว อ่านตอนเปิด เขียนตอนเปลี่ยน) ----------
       iOS Safari (โดยเฉพาะ PWA standalone) มีบั๊ก: indexedDB.open() บางครั้งแขวน
       ไม่ยิง event เลย → ทำ timeout ไว้ ถ้าเกิน 3.5s ถือว่าพัง แล้วเล่นแบบ in-memory
       (แอปใช้ได้ปกติ แค่ความคืบหน้าไม่เซฟข้ามการเปิดใหม่รอบนั้น) */
    function openDB() {
        return new Promise((res, rej) => {
            let settled = false;
            const done = (fn, v) => { if (!settled) { settled = true; fn(v); } };
            let rq;
            try { rq = indexedDB.open(DB_NAME, 1); }
            catch (e) { return rej(e); }
            rq.onupgradeneeded = () => { try { rq.result.createObjectStore(STORE); } catch (e) {} };
            rq.onsuccess = () => done(res, rq.result);
            rq.onerror = () => done(rej, rq.error);
            rq.onblocked = () => done(rej, new Error("idb blocked"));
            setTimeout(() => done(rej, new Error("idb open timeout")), 2500);
        });
    }
    /* iOS PWA: บางที transaction ก็แขวน (ไม่ยิง success/error) แม้ openDB สำเร็จ
       → ทุก op มี timeout 2s กันหน้าค้าง (เขียนไม่สำเร็จก็แค่ไม่เซฟรอบนั้น) */
    function idbGet(k) {
        if (!idb) return Promise.resolve(undefined);
        return new Promise((res) => {
            let s = false; const done = (v) => { if (!s) { s = true; res(v); } };
            try {
                const r = idb.transaction(STORE, "readonly").objectStore(STORE).get(k);
                r.onsuccess = () => done(r.result); r.onerror = () => done(undefined);
            } catch (e) { return done(undefined); }
            setTimeout(() => done(undefined), 2000);
        });
    }
    function idbPut(k, v) {
        if (!idb) return Promise.resolve();
        return new Promise((res) => {
            let s = false; const done = () => { if (!s) { s = true; res(); } };
            try {
                const r = idb.transaction(STORE, "readwrite").objectStore(STORE).put(v, k);
                r.onsuccess = done; r.onerror = done;
            } catch (e) { return done(); }
            setTimeout(done, 2000);
        });
    }

    const blank = () => ({
        vocab: {},      // content_item_id -> {created_at}
        cards: {},      // content_item_id -> {reps, interval, ef, due, last}
        activity: {},   // "YYYY-MM-DD" -> {collected, reviewed, repaired}
        wallet: { coins: 0, stamps_total: 0, chain_best: 0, perfect_rounds: 0 },
        stamps: {},     // "YYYY-MM-DD|source" -> 1
        inbox: [],      // {id, raw_text, status, answer..., created_at}
    });

    let saveTimer = null;
    function save() {                       // debounce — กันเขียน IndexedDB ถี่เกิน
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => idbPut(KEY, state).catch(() => {}), 120);
    }
    const flush = () => idbPut(KEY, state).catch(() => {});
    window.addEventListener("pagehide", flush);   // กันข้อมูลหายตอนปิดแอปกะทันหัน

    /* ---------- วันที่ (ใช้เวลาเครื่อง ไม่ใช่ UTC — streak ต้องตรงกับชีวิตจริง) ---------- */
    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const today = () => iso(new Date());
    const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return iso(d); };
    function addDays(fromIso, n) {
        const [y, m, dd] = fromIso.split("-").map(Number);
        const d = new Date(y, m - 1, dd + n);
        return iso(d);
    }

    function bump(field) {
        const t = today();
        const a = state.activity[t] || (state.activity[t] = { collected: 0, reviewed: 0, repaired: 0 });
        a[field] += 1;
        save();
    }

    /* ---------- SM-2 (พอร์ตตรงจาก srs.py — จำได้ = ไม่แตะ ease factor) ---------- */
    function srsReview(card, quality) {
        let { reps, interval, ef } = card;
        if (quality < 3) {
            reps = 0; interval = 1; ef -= 0.20;
        } else {
            if (reps === 0) interval = 1;
            else if (reps === 1) interval = 6;
            else interval = Math.round(interval * ef);
            if (quality >= 5) { interval = Math.round(interval * 1.3); ef += 0.15; }
            reps += 1;
        }
        ef = Math.max(1.3, Math.round(ef * 1000) / 1000);
        return { reps, interval, ef, due: addDays(today(), interval), last: new Date().toISOString() };
    }

    /* ---------- สถานะผู้เล่น ---------- */
    const activeDays = () => new Set(Object.entries(state.activity)
        .filter(([, a]) => a.collected > 0 || a.reviewed > 0 || a.repaired)
        .map(([d]) => d));

    function calcStreak() {
        const days = activeDays();
        const activeToday = days.has(today());
        let cur = activeToday ? today() : shift(-1);   // ยังไม่เรียนวันนี้ = นับจากเมื่อวาน
        let n = 0;
        while (days.has(cur)) { n += 1; cur = addDays(cur, -1); }
        return { streak: n, activeToday };
    }

    const totalReviews = () => Object.values(state.activity).reduce((s, a) => s + a.reviewed, 0);
    const dueCount = () => Object.values(state.cards).filter(c => c.due <= today()).length;

    function repairOffer() {
        if (state.wallet.coins < STREAK_REPAIR_COST) return false;
        const days = activeDays();
        return !days.has(shift(-1)) && days.has(shift(-2));
    }

    /* ---------- กระดานของวิเศษ (พอร์ตจาก board.py) ---------- */
    function unlockedSet() {
        const w = state.wallet, { streak } = calcStreak();
        const set = new Set();
        const normals = Math.min(23, Math.floor(w.stamps_total / 3));
        for (let i = 1; i <= normals; i++) set.add(i);
        const gold = {
            24: streak >= 7,
            25: Object.keys(state.vocab).length >= 100,
            26: w.chain_best >= 10,
            27: totalReviews() >= 300,
            28: w.perfect_rounds >= 5,
        };
        for (const [s, ok] of Object.entries(gold)) if (ok) set.add(+s);
        if (normals >= 23) set.add(29);
        if (Object.values(gold).every(Boolean)) set.add(30);
        return set;
    }

    /* ---------- เนื้อหา ---------- */
    const itemById = new Map();
    function indexContent() {
        content.items.forEach(i => itemById.set(i.id, i));
    }
    const collectable = (t) => ["word", "chunk", "slang", "sentence"].includes(t);

    function cardPayload(id) {
        const it = itemById.get(id);
        return {
            card_id: id, content_item_id: id, text_en: it.text_en, text_th: it.text_th,
            item_type: it.item_type, note_th: it.note_th, example_en: it.example_en,
            example_th: it.example_th, register: it.register, origin: it.origin,
            unit_id: it.unit_id, unit_name: content.unit_name[it.unit_id],
            repetitions: state.cards[id].reps, interval_days: state.cards[id].interval,
            ease_factor: state.cards[id].ef,
        };
    }

    function newCardDue() {
        // การ์ดใหม่ 20 ใบแรกของวัน → นัดวันนี้, ใบที่ 21-40 → พรุ่งนี้ (กันคิวท่วม)
        const t = today();
        const madeToday = Object.values(state.vocab).filter(v => v.created_at.startsWith(t)).length;
        return addDays(t, Math.floor(Math.max(0, madeToday - 1) / DAILY_NEW_CAP));
    }

    function collect(id) {
        if (state.vocab[id]) return { ok: true, card_id: id, is_new: false };
        state.vocab[id] = { created_at: new Date().toISOString() };
        state.cards[id] = { reps: 0, interval: 0, ef: 2.5, due: newCardDue(), last: null };
        bump("collected");
        return { ok: true, card_id: id, is_new: true };
    }

    /* ---------- earn: เหรียญ/แสตมป์/ปลดของวิเศษ ---------- */
    function earn(body) {
        const before = unlockedSet();
        const w = state.wallet;
        if (body.coins > 0) w.coins += Math.min(body.coins, 5000);
        if (body.chain > 0) w.chain_best = Math.max(w.chain_best, body.chain);
        if (body.perfect) w.perfect_rounds += 1;

        let stamp_awarded = false;
        if (["review_session", "game_round", "daily_goal"].includes(body.stamp_source)) {
            const k = `${today()}|${body.stamp_source}`;
            if (!state.stamps[k]) { state.stamps[k] = 1; w.stamps_total += 1; stamp_awarded = true; }
        }
        save();

        const after = unlockedSet();
        const newly = [...after].filter(s => !before.has(s)).sort((a, b) => a - b)
            .map(n => board.find(b => b.slot === n))
            .map(s => ({ slot: s.slot, rarity: s.rarity, icon: s.icon, name_th: s.name_th, quote: s.quote }));
        return { ok: true, coins: w.coins, stamps_total: w.stamps_total, stamp_awarded,
                 next_slot_progress: w.stamps_total % 3, newly_unlocked: newly };
    }

    /* ---------- เมนูวันนี้ (พอร์ตจาก /api/today) ---------- */
    function todayMenu(limit) {
        limit = Math.max(4, Math.min(limit || 20, 40));
        const nRev = Math.max(1, Math.round(limit * 0.4));
        const nNew = Math.max(1, Math.round(limit * 0.3));
        const nBar = Math.max(1, Math.round(limit * 0.15));
        const nSurp = Math.max(0, limit - nRev - nNew - nBar);

        const reviews = Object.keys(state.cards).map(Number)
            .filter(id => state.cards[id].due <= today())
            .sort((a, b) => state.cards[a].due.localeCompare(state.cards[b].due))
            .slice(0, nRev)
            .map(id => ({ ...cardPayload(id), kind: "review" }));

        const pool = (pred, n) => {
            if (n <= 0) return [];
            const cand = content.items.filter(i =>
                !state.vocab[i.id] && i.text_th && collectable(i.item_type) && pred(i));
            for (let i = cand.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]];
            }
            return cand.slice(0, n).map(i => ({
                content_item_id: i.id, text_en: i.text_en, text_th: i.text_th, item_type: i.item_type,
                note_th: i.note_th, example_en: i.example_en, example_th: i.example_th,
                register: i.register, origin: i.origin, unit_id: i.unit_id,
                unit_name: content.unit_name[i.unit_id], kind: "new",
            }));
        };

        // "ด่านปัจจุบัน" = บทที่เก็บล่าสุดและยังเก็บไม่ครบ
        const unitsById = Object.fromEntries(content.units.map(u => [u.id, u]));
        const hasUnseen = (uid) => content.items.some(i =>
            i.unit_id === uid && collectable(i.item_type) && !state.vocab[i.id]);
        const recent = Object.keys(state.vocab).map(Number)
            .sort((a, b) => state.vocab[b].created_at.localeCompare(state.vocab[a].created_at))
            .map(id => itemById.get(id)?.unit_id).find(uid => uid && hasUnseen(uid));
        const curUnit = recent || (content.units.find(u => u.pack_type === "core" && hasUnseen(u.id)) || {}).id;

        const rest = [
            ...pool(i => i.unit_id === curUnit, nNew),
            ...pool(i => i.unit_id === "bar_life", nBar),
            ...pool(i => unitsById[i.unit_id]?.pack_type === "core" && i.unit_id !== curUnit, nSurp),
        ];
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1)); [rest[i], rest[j]] = [rest[j], rest[i]];
        }

        const menu = reviews.slice(0, 2).concat(rest);
        reviews.slice(2).forEach((r, i) => menu.splice(Math.min(2 + (i + 1) * 3, menu.length), 0, r));
        return menu;
    }

    /* ---------- Router: ตอบ path เดิมทุกอัน ---------- */
    async function get(path) {
        const [p, qs] = path.split("?");
        const q = new URLSearchParams(qs || "");

        if (p === "/api/units") {
            return content.units.map(u => ({
                ...u,
                collected_count: content.items.filter(i => i.unit_id === u.id && state.vocab[i.id]).length,
            }));
        }
        if (p.startsWith("/api/units/")) {
            const id = decodeURIComponent(p.split("/").pop());
            const unit = content.units.find(u => u.id === id);
            if (!unit) throw new Error("unit not found");
            return { ...unit, items: content.items.filter(i => i.unit_id === id)
                .map(i => ({ ...i, collected: !!state.vocab[i.id] })) };
        }
        if (p === "/api/stats") {
            const { streak, activeToday } = calcStreak();
            const a = state.activity[today()] || { reviewed: 0 };
            return {
                total_collected: Object.keys(state.vocab).length, due_today: dueCount(),
                streak_days: streak, active_today: activeToday, reviewed_today: a.reviewed,
                daily_goal: DAILY_GOAL, coins: state.wallet.coins, stamps_total: state.wallet.stamps_total,
                repair_offer: repairOffer(), repair_cost: STREAK_REPAIR_COST,
            };
        }
        if (p === "/api/review/queue") {
            return Object.keys(state.cards).map(Number)
                .filter(id => state.cards[id].due <= today())
                .sort((a, b) => state.cards[a].due.localeCompare(state.cards[b].due))
                .map(cardPayload);
        }
        if (p === "/api/today") return todayMenu(parseInt(q.get("limit")) || 20);
        if (p === "/api/search") {
            const term = (q.get("q") || "").trim().toLowerCase();
            if (!term) return [];
            return content.items
                .filter(i => i.item_type !== "technique" &&
                    ((i.text_en || "").toLowerCase().includes(term) || (i.text_th || "").includes(term)))
                .sort((a, b) => (b.unit_id === "bar_life") - (a.unit_id === "bar_life")
                    || a.text_en.length - b.text_en.length)
                .slice(0, 20)
                .map(i => ({ id: i.id, text_en: i.text_en, text_th: i.text_th, item_type: i.item_type,
                             unit_id: i.unit_id, unit_name: content.unit_name[i.unit_id],
                             collected: state.vocab[i.id] ? 1 : 0 }));
        }
        if (p === "/api/board") {
            const un = unlockedSet();
            return {
                slots: board.map(s => {
                    const e = { slot: s.slot, rarity: s.rarity, icon: s.icon,
                                name_th: s.name_th, hint: s.hint, unlocked: un.has(s.slot) };
                    if (e.unlocked) e.quote = s.quote;
                    return e;
                }),
                wallet: { ...state.wallet, next_slot_progress: state.wallet.stamps_total % 3 },
                unlocked_count: un.size,
            };
        }
        if (p === "/api/heard-at-work") return state.inbox.slice().reverse();
        throw new Error("unknown GET " + p);
    }

    async function post(path, body) {
        body = body || {};
        if (path === "/api/collect") { const r = collect(body.content_item_id); save(); return r; }
        if (path.startsWith("/api/collect-unit/")) {
            const uid = decodeURIComponent(path.split("/").pop());
            let added = 0;
            content.items.filter(i => i.unit_id === uid && collectable(i.item_type))
                .forEach(i => { if (!state.vocab[i.id]) { collect(i.id); added += 1; } });
            save();
            return { ok: true, added };
        }
        if (path.startsWith("/api/review/")) {
            const id = parseInt(path.split("/").pop());
            const card = state.cards[id];
            if (!card) throw new Error("card not found");
            state.cards[id] = srsReview(card, body.quality);
            bump("reviewed");
            return { ...state.cards[id], next_review_date: state.cards[id].due };
        }
        if (path === "/api/earn") return earn(body);
        if (path === "/api/streak/repair") {
            if (!repairOffer()) throw new Error("ซ่อมไม่ได้ตอนนี้");
            state.wallet.coins -= STREAK_REPAIR_COST;
            const y = shift(-1);
            state.activity[y] = { ...(state.activity[y] || { collected: 0, reviewed: 0 }), repaired: 1 };
            save();
            return { ok: true, streak_days: calcStreak().streak, coins: state.wallet.coins };
        }
        if (path === "/api/heard-at-work") {
            const id = Date.now();
            state.inbox.push({ id, raw_text: body.raw_text, status: "pending",
                               created_at: new Date().toISOString() });
            save();
            return { ok: true, id };
        }
        throw new Error("unknown POST " + path);
    }

    /* ---------- เสียง: หาไฟล์จาก hash เดียวกับ tts.py ---------- */
    async function audioUrl(text, voiceKey, rateKey) {
        const voice = VOICES[voiceKey] || VOICES.default;
        const rate = RATES[rateKey] || RATES.normal;
        const buf = new TextEncoder().encode(`${voice}::${rate}::${text}`);
        const hash = await crypto.subtle.digest("SHA-256", buf);
        const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
        return `audio/${hex.slice(0, 24)}.mp3`;
    }

    /* ---------- โหลดเสียงเก็บไว้ล่วงหน้า (ห้องเย็นบาร์ไม่มีสัญญาณ) ----------
       service worker เก็บเฉพาะคลิปที่เคยฟัง — คำที่ยังไม่เคยเปิดจะเงียบตอนออฟไลน์
       ปุ่มนี้ดึงเสียงทั้งชุดมาไว้ในเครื่องก่อน (ต้องเรียกตอนต่อ wifi) */
    function clipsFor(filter) {
        const set = new Set();
        const add = (text, v, r) => text && text.trim() && set.add(JSON.stringify([text, v, r]));
        content.items.filter(filter).forEach(i => {
            const v = i.origin === "aussie" ? "aussie_m"
                : i.origin === "irish" ? "irish_m"
                : (i.origin === "scottish" || i.origin === "british") ? "british_m"
                : i.unit_id === "bar_life" ? "aussie_m" : "default";
            if (collectable(i.item_type)) { add(i.text_en, v, "normal"); add(i.text_en, v, "slow"); }
            if (i.item_type === "dialogue") {
                (i.example_en || "").split("\n").filter(l => l.trim()).forEach(line => {
                    const m = line.match(/^([^:]+):\s*"?(.*?)"?$/);
                    add((m ? m[2] : line).replace(/^"|"$/g, ""), v, "normal");
                });
            } else if (i.example_en) add(i.example_en, v, "normal");
        });
        return [...set].map(s => JSON.parse(s));
    }

    async function downloadAudio(scope, onProgress) {
        const filter = scope === "bar" ? (i => i.unit_id === "bar_life") : (() => true);
        const clips = clipsFor(filter);
        const cache = await caches.open("kk-audio");   // ก้อนเดียวกับ sw.js ห้ามเปลี่ยนชื่อ
        let done = 0, failed = 0;
        const queue = [...clips];
        const worker = async () => {
            while (queue.length) {
                const [text, v, r] = queue.pop();
                const url = await audioUrl(text, v, r);
                try {
                    if (!(await cache.match(url))) await cache.add(url);
                } catch { failed += 1; }
                onProgress?.(++done, clips.length, failed);
            }
        };
        await Promise.all(Array.from({ length: 6 }, worker));
        return { total: clips.length, failed };
    }

    /* ---------- สำรอง/กู้ข้อมูล (ข้อมูลอยู่บนเครื่องเดียว ต้องมีทางออก) ---------- */
    function exportBackup() {
        const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `kepkham-backup-${today()}.json`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
    async function importBackup(file) {
        const data = JSON.parse(await file.text());
        if (!data.vocab || !data.cards || !data.wallet) throw new Error("ไฟล์สำรองไม่ถูกต้อง");
        state = { ...blank(), ...data };
        await flush();
    }

    async function init() {
        // IndexedDB เป็น optional — เปิดไม่ได้/แขวน ก็เล่นแบบ in-memory ได้ (ไม่ค้าง)
        idb = null;
        for (let attempt = 0; attempt < 2 && !idb; attempt++) {
            try { idb = await openDB(); }
            catch (e) { idb = null; }        // ลองซ้ำอีกครั้ง (บั๊ก iOS มักหายรอบสอง)
        }
        try { state = (await idbGet(KEY)) || blank(); }
        catch (e) { state = blank(); }
        for (const k of Object.keys(blank())) if (!(k in state)) state[k] = blank()[k];

        // เนื้อหาต้องโหลดให้ได้เพื่อให้ UI ขึ้น — ไม่ผูกกับ IDB
        const base = document.querySelector("base")?.getAttribute("href") || "";
        [content, board] = await Promise.all([
            fetch(base + "data/content.json").then(r => r.json()),
            fetch(base + "data/board.json").then(r => r.json()),
        ]);
        indexContent();

        // ขอให้เบราว์เซอร์อย่าลบข้อมูลเราตอนเครื่องพื้นที่เหลือน้อย
        if (idb && navigator.storage?.persist) navigator.storage.persist().catch(() => {});
        return true;
    }

    return { init, get, post, audioUrl, downloadAudio, exportBackup, importBackup,
             stats: () => state, flush };
})();

window.KK = KK;
