/* PALASH app glue v2.0: lessons, translate, voice, search, offline badge. */
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  let DATA = null, LANG = "sat";
  async function load() {
    try {
      const r = await fetch("data/fln_lessons.json");
      if (r.ok) { const j = await r.json(); if (j && j.lessons) { DATA = j; } }
      if (!DATA) throw new Error("no lessons via fetch");
    } catch (e) {
      DATA = window.FLN_LESSONS ? JSON.parse(JSON.stringify(window.FLN_LESSONS)) : { nipun: {}, lessons: [] };
    }
    const sel = $("lesson");
    if (DATA.lessons) DATA.lessons.forEach(l => { const o = document.createElement("option"); o.value = l.id; o.textContent = l.id + " • " + l.title_hi; sel.appendChild(o); });
    renderLesson(); badge();
    if (window.PalashCorr) renderCorrScreen();
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
    aiStatus();
  }
  function aiStatus() {
    const st = $("aiStatus");
    if (!st) return;
    if (!window.PalashAI) { st.textContent = "AI offline."; return; }
    if (!navigator.onLine) { st.textContent = "🌐 AI needs internet"; return; }
    const on = PalashAI.enabled();
    st.textContent = on ? "✅ AI चालू — अनुवाद में Sarvam AI (sat-IN) इस्तेमाल होगा" : "💤 AI बंद — सिर्फ on-device शब्दकोश";
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
  function showResult(r, aiUsed) {
    $("tout").innerHTML = '<div>' + r.output + '</div>' +
      '<div class="meta">⏱ ' + r.ms + 'ms • coverage ' + Math.round(r.coverage * 100) + '% • ' + (r.fullPhrase ? "phrase-match ✅" : "word-gloss") + " • " + { sat: "Santali", hoc: "Ho", unr: "Mundari" }[LANG] + (aiUsed ? ' <span class="ai-badge">✨ Sarvam AI</span>' : "") + "</div>";
    if (window.PalashCorr && r.output) attachCorrBar($("tout"), r);
  }
  function lessonCtx() {
    const l = cur();
    return { lesson_id: l ? l.id : "", category: l ? (l.nipun || []).join(",") : "" };
  }
  function attachCorrBar(container, r) {
    const ctx = lessonCtx();
    PalashCorr.attachActions(container, {
      hindi: r.input, original: r.output, lang: LANG, method: "text",
      lesson_id: ctx.lesson_id, category: ctx.category
    });
  }
  function renderCorrScreen() {
    if (!window.PalashCorr) return;
    PalashCorr.renderStats($("corrStats"));
    const lang = $("corrFilter") ? $("corrFilter").value : "";
    PalashCorr.renderList($("corrList"), { lang });
  }
  function doTranslate() {
    const t = $("hin").value.trim() || ($("lessonScript") ? $("lessonScript").textContent : "");
    const r = PalashMT.translate(t, LANG);
    showResult(r, false);
    if (window.PalashAI && PalashAI.enabled() && PalashAI.online() && r.coverage < 1) {
      PalashAI.translate(t, LANG, 6000).then(ai => {
        if (!ai || $("hin").value.trim() !== t) return;
        $("tout").innerHTML = '<div class="tri">' + ai + '</div>' +
          '<div class="meta">✨ Sarvam AI (hi-IN → sat-IN) • full-sentence translation</div>';
        if (window.PalashCorr) { const ctx = lessonCtx(); PalashCorr.attachActions($("tout"), { hindi: t, original: ai, lang: LANG, method: "text", lesson_id: ctx.lesson_id, category: ctx.category }); }
      }).catch(() => {});
    }
    return r;
  }
  function renderLesson() {
    const l = cur();
    if (l) {
      if ($("lessonScript")) $("lessonScript").innerHTML = l.script_hi.map(s => "<div>• " + s + "</div>").join("");
      if (DATA && DATA.nipun) $("sheet").innerHTML = PalashGen.worksheetHTML(l, LANG, DATA.nipun);
    }
    $("cards").innerHTML = PalashGen.flashcardsHTML(["पेड़", "फूल", "नदी", "फल", "आम", "केला", "गाय", "कुत्ता", "घोड़ा", "सूरज", "बारिश", "पहाड़", "मोर", "पानी", "किताब", "एक", "दो", "तीन"], LANG);
  }
  function shareWorksheet() {
    const l = cur(); if (!l) return;
    const txt = PalashGen.worksheetText(l, LANG);
    if (window.Android && window.Android.share) window.Android.share("VaniSanchar " + l.id, txt);
    else if (navigator.share) navigator.share({ title: "VaniSanchar", text: txt }).catch(() => {});
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
      PalashVoice.speak(PalashVoice.speakable(r.output), "hi-IN", 0.85);
    });
    $("micBtn").addEventListener("click", () => {
      const ok = PalashVoice.toggleListen(LANG, (s) => {
        if (s.stage === "hearing") $("vstat").textContent = "🎙 सुन रहे हैं: " + s.text;
        if (s.stage === "hindi") { $("vstat").textContent = "🗣 शिक्षक (Hindi): " + s.text; $("hin").value = s.text; }
        if (s.stage === "ai") $("vstat").textContent = "✨ Sarvam AI पूरा-वाक्य अनुवाद कर रहा है…";
        if (s.stage === "tribal") {
          $("vout").innerHTML = '<div class="tri">' + s.text + '</div><div class="meta">MT ' + s.ms + 'ms • coverage ' + Math.round(s.coverage * 100) + "%" + (s.ai ? ' <span class="ai-badge">✨ Sarvam AI</span>' : "") + "</div>";
          if (window.PalashCorr && s.text) { const ctx = lessonCtx(); PalashCorr.attachActions($("vout"), { hindi: $("hin").value, original: s.text, lang: LANG, method: "voice", lesson_id: ctx.lesson_id, category: ctx.category }); }
        }
        if (s.stage === "done") {
          $("vlat").innerHTML = "कुल वॉइस-लेटेंसी: <span class=\"lat " + (s.ok ? "ok" : "bad") + "\">" + s.ms + "ms " + (s.ok ? "✅" : "⚠️") + "</span>";
          $("vstat").textContent = "तैयार — फिर बोलें।";
        }
        if (s.stage === "aifin") {
          $("vlat").innerHTML += ' <span class="meta">✨ AI version बोल गया (कुल ' + s.ms + "ms)</span>";
          $("vstat").textContent = "✅ AI बेहतर अनुवाद सुनाया — फिर बोलें।";
        }
      }, (e) => { $("vstat").textContent = "⚠️ " + e; });
      if (ok) $("vstat").textContent = "🎙 बोलें… (hi-IN)";
    });
    $("vgo").addEventListener("click", () => {
      const t = $("hin").value.trim() || "तालियाँ बजाओ — बहुत अच्छा!";
      PalashVoice.pipeline(t, LANG, (s) => {
        if (s.stage === "tribal") {
          $("vout").innerHTML = '<div class="tri">' + s.text + '</div><div class="meta">MT ' + s.ms + 'ms</div>';
          if (window.PalashCorr && s.text) { const ctx = lessonCtx(); PalashCorr.attachActions($("vout"), { hindi: t, original: s.text, lang: LANG, method: "voice", lesson_id: ctx.lesson_id, category: ctx.category }); }
        }
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
    if (window.PalashCorr) {
      $("exportCsv").addEventListener("click", () => PalashCorr.exportAs("csv"));
      $("exportJsonl").addEventListener("click", () => PalashCorr.exportAs("jsonl"));
      $("corrFilter").addEventListener("change", renderCorrScreen);
      $("corrRefresh").addEventListener("click", renderCorrScreen);
    }
    $("shareBtn").addEventListener("click", shareWorksheet);
    const aiChk = $("aiOn");
    if (aiChk && window.PalashAI) {
      aiChk.checked = PalashAI.enabled();
      aiChk.addEventListener("change", () => {
        PalashAI.setEnabled(aiChk.checked);
        if (aiChk.checked && navigator.onLine) {
          aiChk.disabled = true;
          $("aiStatus").textContent = "⏳ Sarvam AI key जाँच रहे हैं…";
          PalashAI.test(true).then(ok => {
            aiChk.disabled = false;
            aiStatus();
            if (!ok) $("aiStatus").textContent = "⚠️ AI key नहीं चला — फिर से कोशिश करो।";
          });
        } else aiStatus();
      });
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  });
})();
