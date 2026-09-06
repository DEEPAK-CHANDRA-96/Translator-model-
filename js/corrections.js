/* VaniSanchar — Teacher Correction Store v1 (PHASE 6).
   Turn teacher feedback into structured, reviewable linguistic records.
   Principles:
   - Offline-first: records live in localStorage; no PII, no network.
   - The ORIGINAL translation is immutable (never silently overwritten).
   - A correction is NOT ground truth: only records marked VERIFIED are
     considered suitable for future ML training.
   Statuses: GENERATED -> TEACHER_REVIEWED | TEACHER_CORRECTED -> VERIFIED.
*/
(function () {
  "use strict";
  const KEY = "vani_corrections_v1";
  const LANGS = { sat: "Santali", hoc: "Ho", unr: "Mundari" };
  const STATUS = ["GENERATED", "TEACHER_REVIEWED", "TEACHER_CORRECTED", "VERIFIED"];
  let storage = null;

  function store() {
    if (storage) return storage;
    if (typeof window !== "undefined" && window.localStorage) return window.localStorage;
    return null;
  }
  function read() {
    const s = store(); if (!s) return [];
    try { const v = JSON.parse(s.getItem(KEY) || "[]"); return Array.isArray(v) ? v : []; } catch (e) { return []; }
  }
  function commit(arr) {
    const s = store(); if (!s) return false;
    try { s.setItem(KEY, JSON.stringify(arr)); return true; } catch (e) { return false; }
  }
  function uid() { return "c_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function baseRecord(hindi, original, method, lang) {
    return {
      source_language: "Hindi",
      target_language: LANGS[lang] || "Santali",
      hindi_sentence: hindi || "",
      original_translation: original || "",
      corrected_translation: "",
      input_method: method === "voice" ? "voice" : "text",
      validation_status: "GENERATED",
      timestamp: new Date().toISOString(),
      lesson_id: "",
      category: ""
    };
  }

  /* Add a GENERATED record for a produced translation.
     Dedupe: same sentence+lang+original while still GENERATED just refreshes. */
  function log(hindi, original, opts) {
    opts = opts || {};
    const lang = opts.lang || "sat";
    const rec = baseRecord(hindi, original, opts.method, lang);
    rec.lesson_id = opts.lesson_id || "";
    rec.category = opts.category || "";
    let arr = read();
    for (let i = arr.length - 1; i >= 0; i--) {
      const r = arr[i];
      if (r.hindi_sentence === rec.hindi_sentence && r.target_language === rec.target_language
        && r.original_translation === rec.original_translation && r.validation_status === "GENERATED") {
        r.timestamp = rec.timestamp; commit(arr); return r.id;
      }
    }
    rec.id = uid(); rec.updated_at = rec.timestamp;
    arr.push(rec); commit(arr); return rec.id;
  }

  function touch(record) { record.updated_at = new Date().toISOString(); }

  /* Teacher confirms the translation is correct (no edit). */
  function setReviewed(id) {
    const arr = read();
    const r = arr.find(x => x.id === id); if (!r) return false;
    if (r.validation_status === "VERIFIED") return true;
    r.validation_status = "TEACHER_REVIEWED";
    r.corrected_translation = r.corrected_translation || r.original_translation;
    touch(r); commit(arr); return true;
  }

  /* Teacher corrects the translation. Original_translation is never changed. */
  function saveCorrection(id, correctedText) {
    const arr = read();
    const r = arr.find(x => x.id === id); if (!r) return false;
    r.corrected_translation = correctedText;
    if (r.validation_status !== "VERIFIED") r.validation_status = "TEACHER_CORRECTED";
    touch(r); commit(arr); return true;
  }

  /* Explicitly mark as verified — the ONLY status eligible for ML training. */
  function setVerified(id, verified) {
    const arr = read();
    const r = arr.find(x => x.id === id); if (!r) return false;
    if (verified) {
      r.validation_status = "VERIFIED";
      if (!r.corrected_translation) r.corrected_translation = r.original_translation;
    } else {
      r.validation_status = r.corrected_translation === r.original_translation
        ? "TEACHER_REVIEWED" : "TEACHER_CORRECTED";
    }
    touch(r); commit(arr); return true;
  }

  /* Edit allowed metadata + corrected text (original immutably preserved).
     Re-verification is required after a verified record is edited. */
  function update(id, patch) {
    const arr = read();
    const r = arr.find(x => x.id === id); if (!r) return false;
    if (typeof patch.corrected_translation === "string" && patch.corrected_translation !== r.corrected_translation) {
      r.corrected_translation = patch.corrected_translation;
      if (r.validation_status === "VERIFIED") r.validation_status = "TEACHER_CORRECTED";
    }
    if (patch.lesson_id !== undefined) r.lesson_id = patch.lesson_id;
    if (patch.category !== undefined) r.category = patch.category;
    touch(r); commit(arr); return true;
  }

  function remove(id) {
    const arr = read();
    const i = arr.findIndex(x => x.id === id); if (i < 0) return false;
    arr.splice(i, 1); commit(arr); return true;
  }

  function get(id) { return read().find(x => x.id === id) || null; }
  function list() { return read().sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1)); }

  function csvField(v) {
    const s = String(v == null ? "" : v);
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function exportCSV() {
    const rows = read();
    const head = ["id", "source_language", "target_language", "hindi_sentence", "original_translation",
      "corrected_translation", "input_method", "validation_status", "timestamp", "lesson_id", "category"];
    const lines = [head.map(csvField).join(",")];
    rows.forEach(r => {
      lines.push([r.id || "", r.source_language, r.target_language, r.hindi_sentence, r.original_translation,
        r.corrected_translation, r.input_method, r.validation_status, r.timestamp, r.lesson_id, r.category]
        .map(csvField).join(","));
    });
    return { filename: "vani_sudhar_" + new Date().toISOString().slice(0, 10) + ".csv", content: lines.join("\r\n") };
  }
  function exportJSONL() {
    const rows = read();
    return {
      filename: "vani_sudhar_" + new Date().toISOString().slice(0, 10) + ".jsonl",
      content: rows.map(r => JSON.stringify(r)).join("\n")
    };
  }
  function stats() {
    const rows = read();
    const by = { Santali: 0, Ho: 0, Mundari: 0 };
    let corr = 0, verified = 0, reviewed = 0;
    rows.forEach(r => {
      if (by[r.target_language] !== undefined) by[r.target_language]++;
      if (r.validation_status === "TEACHER_CORRECTED" || r.validation_status === "VERIFIED") corr++;
      if (r.validation_status === "VERIFIED") verified++;
      if (r.validation_status === "TEACHER_REVIEWED") reviewed++;
    });
    return { total: rows.length, corrections: corr, verified, reviewed,
      by_language: by, generated: rows.filter(r => r.validation_status === "GENERATED").length };
  }

  /* ---------- UI ---------- */
  let toastEl = null;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "vs-toast"; toastEl.style.cssText =
        "position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);background:#14532a;color:#fff;" +
        "padding:10px 18px;border-radius:12px;font-weight:700;font-size:14px;opacity:0;transition:all .3s;z-index:9999;box-shadow:0 4px 18px #0004";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = "1"; toastEl.style.transform = "translateX(-50%) translateY(0)";
    clearTimeout(toastEl._t); toastEl._t = setTimeout(() => { toastEl.style.opacity = "0"; toastEl.style.transform = "translateX(-50%) translateY(20px)"; }, 1800);
  }

  /* Action bar attached under a translation render. */
  function attachActions(container, opts) {
    if (!container || typeof document === "undefined") return;
    const id = log(opts.hindi, opts.original, opts);
    const bar = document.createElement("div");
    bar.className = "corrbar";
    const b1 = document.createElement("button");
    b1.className = "sec sm"; b1.textContent = "✅ सही है";
    b1.onclick = () => { setReviewed(id); toast("सही के रूप में सहेजा गया (TEACHER_REVIEWED)"); };
    const b2 = document.createElement("button");
    b2.className = "sm warn"; b2.textContent = "✏️ सुधारें";
    const edit = document.createElement("textarea");
    edit.style.marginTop = "6px"; edit.style.display = "none";
    edit.value = opts.original || "";
    const save = document.createElement("button");
    save.className = "sec sm"; save.style.display = "none"; save.textContent = "💾 सुधार सहेजें";
    b2.onclick = () => {
      const show = edit.style.display === "none";
      edit.style.display = show ? "block" : "none";
      save.style.display = show ? "inline-block" : "none";
      b1.style.display = show ? "none" : "inline-block";
      if (show) { edit.focus(); edit.setSelectionRange(edit.value.length, edit.value.length); }
    };
    save.onclick = () => {
      saveCorrection(id, edit.value);
      edit.style.display = "none"; save.style.display = "none"; b1.style.display = "inline-block";
      toast("सुधार सहेजा गया (TEACHER_CORRECTED) — मूल अनुवाद सुरक्षित है");
    };
    bar.appendChild(b1); bar.appendChild(b2); bar.appendChild(edit); bar.appendChild(save);
    container.appendChild(bar);
  }

  function langFilter(v) { return { Santali: "sat", Ho: "hoc", Mundari: "unr" }[v] || "sat"; }

  function statusBadge(s) {
    const map = { GENERATED: "#757575", TEACHER_REVIEWED: "#0b4fa3", TEACHER_CORRECTED: "#b35000", VERIFIED: "#137a2a" };
    return '<span class="vs-badge" style="background:' + (map[s] || "#888") + '">' + esc(s) + "</span>";
  }

  /* Render stats row into a container */
  function renderStats(container) {
    if (!container || typeof document === "undefined") return;
    const s = stats(); const b = s.by_language;
    container.innerHTML =
      '<div class="vs-stats"><div><b>' + s.total + '</b><span>कुल अनुवाद</span></div>' +
      '<div><b class="c-flag">' + s.corrections + '</b><span>शिक्षक सुधार</span></div>' +
      '<div><b class="c-ok">' + s.verified + '</b><span>Verified (ML-ready)</span></div>' +
      '<div><b>' + b.Santali + '</b><span>Santali</span></div>' +
      '<div><b>' + b.Ho + '</b><span>Ho</span></div>' +
      '<div><b>' + b.Mundari + '</b><span>Mundari</span></div></div>';
  }

  /* Render the full Saved Corrections list (view/edit/delete/verify) into a container. */
  function renderList(container, filter) {
    if (!container || typeof document === "undefined") return;
    filter = filter || {};
    let rows = list();
    if (filter.lang) rows = rows.filter(r => r.target_language === filter.lang);
    if (filter.status) rows = rows.filter(r => r.validation_status === filter.status);
    if (!rows.length) { container.innerHTML = '<div class="meta">अभी कोई सुधार रिकॉर्ड नहीं। नीचे अनुवाद करके "✅ सही है" या "✏️ सुधारें" दबाओ।</div>'; return; }
    let h = "";
    rows.forEach(r => {
      const diff = r.corrected_translation && r.corrected_translation !== r.original_translation;
      h += '<div class="vrec"><div class="vrec-head">' +
        statusBadge(r.validation_status) +
        '<span class="vrec-lang">' + esc(r.target_language) + '</span>' +
        '<span class="meta">' + esc(r.input_method) + " • " + esc(String(r.timestamp).slice(0, 16).replace("T", " ")) + "</span></div>" +
        '<div class="vrec-hi">' + esc(r.hindi_sentence) + "</div>" +
        '<div class="vrec-orig"><span class="meta">मूल:</span> ' + esc(r.original_translation) + "</div>" +
        '<div class="vrec-corr' + (diff ? " diff" : "") + '"><span class="meta">सुधार:</span> ' + esc(r.corrected_translation || "—") + "</div>" +
        '<div class="meta">📚 ' + esc(r.lesson_id || "—") + " • 🏷 " + esc(r.category || "—") + "</div>" +
        '<div class="row vrec-actions no-print">' +
        '<button class="sec sm" data-act="edit" data-id="' + r.id + '">✏️ सुधारिए</button>' +
        '<button class="sm ' + (r.validation_status === "VERIFIED" ? "sec" : "") + '" data-act="verify" data-id="' + r.id + '">' +
        (r.validation_status === "VERIFIED" ? "✓ Verified" : "✅ Verified करो") + "</button>" +
        '<button class="sec sm" data-act="expo" data-id="' + r.id + '">📋 कॉपी</button>' +
        '<button class="sm warn" data-act="del" data-id="' + r.id + '">🗑 हटाओ</button></div></div>';
    });
    container.innerHTML = h;
    container.querySelectorAll("button[data-act]").forEach(btn => {
      const id = btn.getAttribute("data-id");
      const r = get(id); if (!r) return;
      const par = btn.closest(".vrec");
      if (btn.dataset.act === "del") btn.onclick = () => {
        if (btn.classList.contains("confirm")) {
          remove(id);
          renderStats(document.getElementById("corrStats"));
          renderList(document.getElementById("corrList"), lastFilter);
          toast("रिकॉर्ड हटा दिया");
          return;
        }
        btn.classList.add("confirm"); btn.textContent = "⚠️ पक्का हटाओ? (फिर दबाओ)";
        setTimeout(() => { btn.classList.remove("confirm"); btn.textContent = "🗑 हटाओ"; }, 2500);
      };
      if (btn.dataset.act === "verify") btn.onclick = () => { setVerified(id, r.validation_status !== "VERIFIED"); renderStats(document.getElementById("corrStats")); renderList(document.getElementById("corrList"), lastFilter); toast(r.validation_status === "VERIFIED" ? "VERIFIED — ML प्रशिक्षण हेतु उपयुक्त" : "VERIFIED हटाया"); };
      if (btn.dataset.act === "expo") btn.onclick = () => { copySingle(r); };
      if (btn.dataset.act === "edit") btn.onclick = () => editRecord(par, r);
    });
  }
  let lastFilter = {};

  function copySingle(r) {
    const one = JSON.stringify(r, null, 2);
    copyText(one, "रिकॉर्ड कॉपी हो गया — कहीं भी पेस्ट करें (केवल VERIFIED ML में जाएगा)");
  }

  function copyText(text, msg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => toast(msg || "कॉपी हो गया")).catch(() => fallbackCopy(text, msg));
    } else fallbackCopy(text, msg);
  }
  function fallbackCopy(text, msg) {
    const ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(msg || "कॉपी हो गया"); } catch (e) { exportModal(text); }
    document.body.removeChild(ta);
  }

  function editRecord(par, r) {
    const btnRow = par.querySelector(".row.vrec-actions");
    btnRow.style.display = "none";
    const f = document.createElement("div");
    f.className = "vrec-edit";
    f.innerHTML = '<label class="meta">सुधारित अनुवाद:</label><textarea rows="2">' + esc(r.corrected_translation || "") +
      '</textarea><label class="meta">📚 पाठ/गतिविधि (optional):</label><input type="text" value="' + esc(r.lesson_id || "") + '" placeholder="जैसे FLN-H1">' +
      '<label class="meta">🏷 श्रेणी (optional):</label><input type="text" value="' + esc(r.category || "") + '" placeholder="जैसे गिनती, पढ़ना"><div class="row"><button class="sm">💾 सहेजें</button><button class="sec sm">✖ रद्द</button></div>';
    par.appendChild(f);
    f.querySelector('button.sm').onclick = () => {
      const c = f.querySelector("textarea").value;
      const lid = f.querySelector("input[type=text]").value;
      const cat = f.querySelectorAll("input[type=text]")[1].value;
      update(r.id, { corrected_translation: c, lesson_id: lid, category: cat });
      par.remove();
      renderStats(document.getElementById("corrStats"));
      renderList(document.getElementById("corrList"), lastFilter);
      toast("अपडेट हो गया — मूल अनुवाद बदला नहीं गया");
    };
    f.querySelector('button.sec').onclick = () => { par.remove(); renderList(document.getElementById("corrList"), lastFilter); };
  }

  function exportModal(payload) {
    if (typeof document === "undefined") return;
    const prev = document.getElementById("vs-export");
    if (prev) prev.remove();
    const m = document.createElement("div");
    m.id = "vs-export"; m.style.cssText = "position:fixed;inset:0;z-index:9998;background:#000a;display:flex;align-items:center;justify-content:center;padding:16px";
    const box = document.createElement("div");
    box.style.cssText = "background:#fff;border-radius:16px;max-width:640px;width:100%;padding:16px;max-height:86vh;display:flex;flex-direction:column;gap:8px";
    box.innerHTML = "<b>📄 " + esc(payload.filename) + "</b>" +
      '<textarea rows="10" style="font-size:12px;font-family:monospace" readonly>' + esc(payload.content.slice(0, 6000)) + "</textarea>";
    const note = document.createElement("div");
    note.className = "meta"; note.textContent = payload.content.length + " बाइट • यहाँ से कॉपी करके कहीं भी (मेल/WhatsApp) भेजें। बड़े डेटा के लिए पूरी फ़ाइल नीचे Share से भेजें।";
    const row = document.createElement("div"); row.className = "row";
    const bCopy = document.createElement("button"); bCopy.className = "sec"; bCopy.textContent = "📋 पूरा कॉपी करें";
    bCopy.onclick = () => copyText(payload.content, payload.filename + " कॉपी हो गया");
    const bShare = document.createElement("button");
    bShare.textContent = "📤 Share (Android)";
    bShare.onclick = () => {
      if (window.Android && window.Android.share) { try { window.Android.share(payload.filename, payload.content); toast("Share खुला — वहाँ सहेजें"); } catch (e) { toast("Share उपलब्ध नहीं"); } }
      else fallbackDownload(payload);
    };
    const bClose = document.createElement("button"); bClose.className = "sec"; bClose.textContent = "✖ बंद करें";
    bClose.onclick = () => m.remove();
    row.appendChild(bCopy); row.appendChild(bShare); row.appendChild(bClose);
    box.appendChild(note); box.appendChild(row);
    m.appendChild(box); document.body.appendChild(m);
    m.addEventListener("click", e => { if (e.target === m) m.remove(); });
  }

  function fallbackDownload(payload) {
    try {
      const blob = new Blob([payload.content], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = payload.filename;
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
      toast("डाउनलोड शुरू");
    } catch (e) { exportModal(payload); }
  }

  function exportAs(format) {
    const payload = format === "jsonl" ? exportJSONL() : exportCSV();
    exportModal(payload);
  }

  window.PalashCorr = {
    STATUS, LANGS, log, setReviewed, saveCorrection, setVerified, update, remove,
    get, list, exportCSV, exportJSONL, stats, attachActions, renderStats, renderList,
    exportAs, copyText, toast, setStorage: function (s) { storage = s; }, read
  };
})();