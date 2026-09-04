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
    $("cards").innerHTML = PalashGen.flashcardsHTML(["पेड़", "फूल", "नदी", "फल", "आम", "केला", "गाय", "सूरज", "पानी", "किताब", "एक", "दो", "तीन"], LANG);
  }
  window.addEventListener("DOMContentLoaded", () => {
    load();
    document.querySelectorAll("input[name=lang]").forEach(r => r.addEventListener("change", e => { LANG = e.target.value; doTranslate(); renderLesson(); }));
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
    $("shareBtn").addEventListener("click", () => {
      const txt = PalashGen.worksheetText(cur(), LANG);
      if (window.Android && window.Android.share) window.Android.share("PALASH " + cur().id, txt);
      else if (navigator.share) navigator.share({ title: "PALASH", text: txt }).catch(() => {});
      else { navigator.clipboard && navigator.clipboard.writeText(txt); alert("Worksheet copy ho gayi — WhatsApp me paste karo!"); }
    });
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  });
})();
