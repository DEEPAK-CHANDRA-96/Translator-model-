/* PALASH app glue v2.0: lessons, translate, voice, search, offline badge. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let DATA = null, LANG = "sat";
  async function load() {
    try {
      const r = await fetch("data/fln_lessons.json");
      DATA = await r.json();
    } catch (e) { DATA = { nipun: {}, lessons: [] }; }
    const sel = $("lesson");
    if (DATA.lessons) DATA.lessons.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.id + " • " + l.title_hi; sel.appendChild(o); });
    renderLesson(); badge();
    window.addEventListener("online", badge); window.addEventListener("offline", badge);
    if ($("loading")) $("loading").style.display = "none";
  }
  function badge() {
    const b = $("net");
    const off = !navigator.onLine;
    b.textContent = off ? "● OFFLINE" : "● ONLINE";
    b.classList.toggle("off", off);
    const note = $("syncNote");
    if (note) note.textContent = off
      ? "ऑफ़लाइन मोड: सभी अनुवाद + वर्कशीट डिवाइस पर ही चल रहे हैं।"
      : "कंटेंट सिंक हो चुका है — अब इंटरनेट बंद करके भी पूरा ऐप चलेगा।";
  }
  function cur() { return DATA && DATA.lessons ? DATA.lessons.find(l => l.id === $("lesson").value) : null; }
  function dictSearch() {
    const q = ($("dictSearch").value || "").trim();
    const box = $("dictResults");
    if (!q) { box.innerHTML = "ऊपर शब्द लिखते ही अर्थ दिखेगा।"; return; }
    const hits = Object.keys(PALASH_DICTS.words).filter(w => w.includes(q)).slice(0, 20);
    const lname = { sat: "Santali", hoc: "Ho", unr: "Mundari" }[LANG];
    if (!hits.length) { box.innerHTML = "❌ \"" + q + "\" शब्दकोश में नहीं — पूरा वाक्य ऊपर अनुवाद में डालकर देखो।"; return; }
    box.innerHTML = hits.map(w => {
      const t = PALASH_DICTS.words[w][LANG];
      const roman = PalashMT.romanOnly(t);
      return '<div class="dict-item"><b>' + w + '</b> → <span class="tri">' + t + '</span> <span class="meta">(' + roman + ')</span> <button class="sec sm" onclick="PalashVoice.speak(\'' + roman.replace(/'/g, "") + '\', \'hi-IN\', 0.9)">🔊</button></div>';
    }).join("") + '<div class="meta">' + hits.length + " परिणाम • " + lname + "</div>";
  }
  function doTranslate() {
    const t = $("hin").value.trim() || ($("lessonScript") ? $("lessonScript").textContent : "");
    const r = PalashMT.translate(t, LANG);
    $("tout").innerHTML = '<div>' + r.output + '</div>' +
      '<div class="meta">⏱ ' + r.ms + 'ms • coverage ' + Math.round(r.coverage * 100) + '% • ' + (r.fullPhrase ? "phrase-match ✅" : "word-gloss") + " • " + { sat: "Santali", hoc: "Ho", unr: "Mundari" }[LANG] + "</div>";
    return r;
  }
  function renderLesson() {
    const l = cur(); if (!l) return;
    if ($("lessonScript")) $("lessonScript").innerHTML = l.script_hi.map(s => "<div>• " + s + "</div>").join("");
    if (DATA && DATA.nipun) $("sheet").innerHTML = PalashGen.worksheetHTML(l, LANG, DATA.nipun);
    $("cards").innerHTML = PalashGen.flashcardsHTML(["पेड़", "फूल", "नदी", "फल", "आम", "केला", "गाय", "कुत्ता", "घोड़ा", "सूरज", "बारिश", "पहाड़", "मोर", "पानी", "किताब", "एक", "दो", "तीन"], LANG);
  }
  function shareWorksheet() {
    const l = cur(); if (!l) return;
    const txt = PalashGen.worksheetText(l, LANG);
    if (window.Android && window.Android.share) window.Android.share("PALASH " + l.id, txt);
    else if (navigator.share) navigator.share({ title: "PALASH", text: txt }).catch(() => {});
    else { navigator.clipboard && navigator.clipboard.writeText(txt); alert("वर्कशीट copy ho gayi — WhatsApp me paste karo!"); }
  }
  window.addEventListener("DOMContentLoaded", () => {
    load();
    document.querySelectorAll("input[name=lang]").forEach(r => r.addEventListener("change", e => { LANG = e.target.value; doTranslate(); renderLesson(); dictSearch(); }));
    $("lesson").addEventListener("change", renderLesson);
    $("tbtn").addEventListener("click", doTranslate);
    $("speakBtn").addEventListener("click", () => {
      const r = PalashMT.translate($("hin").value.trim() || "सभी बच्चे खड़े हो जाओ", LANG);
      $("tout").innerHTML = "<div>" + r.output + "</div>";
      PalashVoice.speak(PalashMT.romanOnly(r.output), "hi-IN", 0.85);
    });
    $("micBtn").addEventListener("click", () => {
      const ok = PalashVoice.toggleListen(LANG, (s) => {
        if (s.stage === "hearing") $("vstat").textContent = "🎙 सुन रहे हैं: " + s.text;
        if (s.stage === "hindi") { $("vstat").textContent = "🗣 शिक्षक (Hindi): " + s.text; $("hin").value = s.text; }
        if (s.stage === "tribal") $("vout").innerHTML = '<div class="tri">' + s.text + '</div><div class="meta">MT ' + s.ms + 'ms • coverage ' + Math.round(s.coverage * 100) + "%</div>";
        if (s.stage === "done") {
          $("vlat").innerHTML = "कुल वॉइस-लेटेंसी: <span class=\"lat " + (s.ok ? "ok" : "bad") + "\">" + s.ms + "ms " + (s.ok ? "✅" : "⚠️") + "</span>";
          $("vstat").textContent = "तैयार — फिर बोलें।";
        }
      }, (e) => { $("vstat").textContent = "⚠️ " + e; });
      if (ok) $("vstat").textContent = "🎙 बोलें… (hi-IN)";
    });
    $("vgo").addEventListener("click", () => {
      const t = $("hin").value.trim() || "तालियाँ बजाओ — बहुत अच्छा!";
      PalashVoice.pipeline(t, LANG, (s) => {
        if (s.stage === "tribal") $("vout").innerHTML = '<div class="tri">' + s.text + '</div><div class="meta">MT ' + s.ms + 'ms</div>';
        if (s.stage === "done") $("vlat").innerHTML = "कुल वॉइस-लेटेंसी: <span class=\"lat " + (s.ok ? "ok" : "bad") + "\">" + s.ms + "ms " + (s.ok ? "✅ (3000ms" : "⚠️") + "</span>";
      });
    });
    $("printBtn").addEventListener("click", () => window.print());
    let zoom = 1;
    $("zoomBtn").addEventListener("click", () => {
      zoom = zoom >= 1.3 ? 1 : +(zoom + 0.15).toFixed(2);
      document.querySelector("main").style.zoom = zoom;
      $("zoomBtn").textContent = zoom > 1 ? "🔍 सामान्य (A) — " + Math.round(zoom * 100) + "%" : "🔍 अक्षर बड़े (A+)";
    });
    $("speakAllBtn").addEventListener("click", () => {
      const l = cur(); if (!l) return;
      $("speakAllBtn").textContent = "⏳ सुना रहे हैं…";
      PalashVoice.speakAll([l.title_hi].concat(l.script_hi), LANG, () => { $("speakAllBtn").textContent = "🔊 पूरा पाठ सुनाओ"; });
    });
    $("dictSearch").addEventListener("input", dictSearch);
    $("shareBtn").addEventListener("click", shareWorksheet);
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  });
})();
