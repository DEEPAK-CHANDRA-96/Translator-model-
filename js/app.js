/* PALASH app glue: lessons load, translate, voice, generate, offline badge. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let DATA = null, LANG = "sat";
  async function load() {
    const r = await fetch("data/fln_lessons.json");
    DATA = await r.json();
    const sel = $("lesson");
    DATA.lessons.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = `${l.id} • ${l.title_hi}`; sel.appendChild(o); });
    renderLesson(); badge();
    window.addEventListener("online", badge); window.addEventListener("offline", badge);
  }
  function badge() {
    const b = $("net");
    const off = !navigator.onLine;
    b.textContent = off ? "● OFFLINE — कार्य जारी" : "● ONLINE — synced";
    b.classList.toggle("off", off);
    $("syncNote").textContent = off
      ? "ऑफ़लाइन मोड: सभी अनुवाद + वर्कशीट डिवाइस पर ही चल रहे हैं।"
      : "कंटेंट सिंक हो चुका है — अब इंटरनेट बंद करके भी पूरा ऐप चलेगा।";
  }
  function cur() { return DATA.lessons.find(l => l.id === $("lesson").value); }
  function dictSearch() {
    const q = ($("dictSearch").value || "").trim();
    const box = $("dictResults");
    if (!q) { box.textContent = "ऊपर शब्द लिखते ही अर्थ दिखेगा।"; return; }
    const hits = Object.keys(PALASH_DICTS.words).filter(w => w.includes(q)).slice(0, 20);
    const lname = { sat: "Santali", hoc: "Ho", unr: "Mundari" }[LANG];
    if (!hits.length) { box.innerHTML = `❌ "${q}" शब्दकोश में नहीं — पूरा वाक्य ऊपर 🔄 अनुवाद में डालकर देखो।`; return; }
    box.innerHTML = hits.map(w => {
      const t = PALASH_DICTS.words[w][LANG];
      return `<div style="padding:6px 0;border-bottom:1px solid #ccd"><b>${w}</b> → <span class="tri">${t}</span> <button class="sec" style="padding:4px 10px;font-size:13px" onclick="PalashVoice.speak(PalashMT.romanOnly('${t}'.replace(/'/g,'')), 'hi-IN', 0.9)">🔊</button></div>`;
    }).join("") + `<div class="meta">${hits.length} परिणाम • ${lname}</div>`;
  }
  function doTranslate() {
    const t = $("hin").value.trim() || $("lessonScript").textContent;
    const r = PalashMT.translate(t, LANG);
    $("tout").innerHTML = `<div>${r.output}</div>
      <div class="meta">⏱ ${r.ms} ms • coverage ${(r.coverage * 100).toFixed(0)}% • ${r.fullPhrase ? "phrase-match ✅" : "word-gloss"} • ${ { sat: "Santali", hoc: "Ho", unr: "Mundari" }[LANG]}</div>`;
    return r;
  }
  function renderLesson() {
    const l = cur(); if (!l) return;
    $("lessonScript").innerHTML = l.script_hi.map(s => `<div>• ${s}</div>`).join("");
    const out = PalashGen.worksheetHTML(l, LANG, DATA.nipun);
    $("sheet").innerHTML = out;
    $("cards").innerHTML = PalashGen.flashcardsHTML(["पेड़", "फूल", "नदी", "फल", "आम", "केला", "गाय", "कुत्ता", "घोड़ा", "सूरज", "बारिश", "पहाड़", "बाज़ार", "पानी", "किताब", "एक", "दो", "तीन"], LANG);
  }
  window.addEventListener("DOMContentLoaded", () => {
    load();
    document.querySelectorAll("input[name=lang]").forEach(r => r.addEventListener("change", e => { LANG = e.target.value; doTranslate(); renderLesson(); dictSearch(); }));
    $("lesson").addEventListener("change", renderLesson);
    $("tbtn").addEventListener("click", doTranslate);
    $("speakBtn").addEventListener("click", () => {
      const r = PalashMT.translate($("hin").value.trim() || "सभी बच्चे खड़े हो जाओ", LANG);
      $("tout").innerHTML = `<div>${r.output}</div>`;
      PalashVoice.speak(PalashMT.romanOnly(r.output), "hi-IN", 0.85);
    });
    $("micBtn").addEventListener("click", () => {
      const ok = PalashVoice.toggleListen(LANG, (s) => {
        if (s.stage === "hearing") $("vstat").textContent = "🎙 सुन रहे हैं: " + s.text;
        if (s.stage === "hindi") { $("vstat").textContent = "🗣 शिक्षक (Hindi): " + s.text; $("hin").value = s.text; }
        if (s.stage === "tribal") $("vout").innerHTML = `<div class="tri">${s.text}</div><div class="meta">MT ${s.ms} ms • coverage ${(s.coverage * 100).toFixed(0)}%</div>`;
        if (s.stage === "done") {
          $("vlat").innerHTML = `कुल वॉइस-लेटेंसी: <span class="lat ${s.ok ? "ok" : "bad"}">${s.ms} ms ${s.ok ? "✅ (<3000ms)" : "⚠️"}</span>`;
          $("vstat").textContent = "तैयार — फिर बोलें।";
        }
      }, (e) => { $("vstat").textContent = "⚠️ " + e; });
      if (ok) $("vstat").textContent = "🎙 बोलें… (hi-IN)";
    });
    $("vgo").addEventListener("click", () => {
      const t = $("hin").value.trim() || "तालियाँ बजाओ — बहुत अच्छा!";
      PalashVoice.pipeline(t, LANG, (s) => {
        if (s.stage === "tribal") $("vout").innerHTML = `<div class="tri">${s.text}</div><div class="meta">MT ${s.ms} ms</div>`;
        if (s.stage === "done") $("vlat").innerHTML = `कुल वॉइस-लेटेंसी: <span class="lat ${s.ok ? "ok" : "bad"}">${s.ms} ms ${s.ok ? "✅ (<3000ms)" : "⚠️"}</span>`;
      });
    });
    $("printBtn").addEventListener("click", () => window.print());
    let zoom = 1;
    $("zoomBtn").addEventListener("click", () => {
      zoom = zoom >= 1.3 ? 1 : +(zoom + 0.15).toFixed(2);
      document.querySelector("main").style.zoom = zoom;
      $("zoomBtn").textContent = zoom > 1 ? `🔍 सामान्य (A) — अभी ${Math.round(zoom * 100)}%` : "🔍 अक्षर बड़े (A+)";
    });
    $("speakAllBtn").addEventListener("click", () => {
      const l = cur();
      $("speakAllBtn").textContent = "⏳ सुना रहे हैं…";
      PalashVoice.speakAll([l.title_hi, ...l.script_hi], LANG, () => { $("speakAllBtn").textContent = "🔊 पूरा पाठ सुनाओ"; });
    });
    $("dictSearch").addEventListener("input", dictSearch);
    $("shareBtn").addEventListener("click", () => {
      const txt = PalashGen.worksheetText(cur(), LANG);
      if (window.Android && window.Android.share) window.Android.share("PALASH " + cur().id, txt);
      else if (navigator.share) navigator.share({ title: "PALASH", text: txt }).catch(() => {});
      else { navigator.clipboard && navigator.clipboard.writeText(txt); alert("Worksheet copy ho gayi — WhatsApp me paste karo!"); }
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  });
})();
