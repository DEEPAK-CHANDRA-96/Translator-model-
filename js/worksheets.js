/* Worksheet + flashcard generator: bilingual (Hindi + tribal), NIPUN-coded, print-ready. */
(function () {
  "use strict";
  const EMOJI = { "पेड़": "🌳", "फूल": "🌸", "नदी": "🌊", "फल": "🍎", "आम": "🥭", "केला": "🍌", "गाय": "🐄", "बकरी": "🐐", "मुर्गी": "🐔", "मछली": "🐟", "सूरज": "☀️", "चाँद": "🌙", "तारा": "⭐", "घर": "🏠", "स्कूल": "🏫", "किताब": "📖", "पानी": "💧", "जंगल": "🌿", "पत्थर": "🪨", "चित्र": "🖼️" };
  function picFor(hi) { for (const k in EMOJI) if (hi.includes(k)) return EMOJI[k]; return "🔸"; }
  function worksheetHTML(lesson, lang, nipun) {
    const L = lang || "sat";
    const lname = { sat: "Santali", hoc: "Ho", unr: "Mundari" }[L];
    const tr = (s) => PalashMT.translate(s, L).output;
    let h = `<div class="sheet"><div class="sheet-head">
      <b>PALASH • ${lesson.id} • ${lname}</b><span>NIPUN: ${lesson.nipun.join(", ")}</span></div>
      <h2>${lesson.title_hi}</h2><p class="tri">${tr(lesson.title_hi)}</p>
      <div class="nipun">${lesson.nipun.map(c => `<span title="${nipun[c]}">${c}: ${nipun[c]}</span>`).join("")}</div>
      <h3>📖 पाठ (Bilingual script)</h3><ol>`;
    for (const s of lesson.script_hi) h += `<li><div>${s}</div><div class="tri">${tr(s)}</div></li>`;
    h += `</ol><h3>🎯 गतिविधि</h3><p>${lesson.activity_hi}</p><p class="tri">${tr(lesson.activity_hi)}</p><h3>✏️ अभ्यास (Worksheet)</h3>`;
    lesson.assess_hi.forEach((q, i) => {
      h += `<div class="q"><b>Q${i + 1}. ${q}</b><div class="tri">${tr(q)}</div>
        <div class="pic">${picFor(q)} &nbsp; ✍️ ______</div></div>`;
    });
    // auto numeracy block if N-lesson
    if (lesson.nipun.some(c => c.startsWith("N"))) {
      h += `<h3>🔢 गिनती — चित्र गिनो</h3><div class="count">🍎🍎🍎 ___ &nbsp; 🥭🥭 ___ &nbsp; ⭐⭐⭐⭐ ___</div>`;
    }
    h += `<div class="foot">नाम: ______ &nbsp; कक्षा: ______ &nbsp; दिनांक: ______ &nbsp; ✅ शिक्षक हस्ताक्षर</div></div>`;
    return h;
  }
  function flashcardsHTML(words, lang) {
    return `<div class="cards">` + words.map(w => {
      const t = (PALASH_DICTS.words[w] && PALASH_DICTS.words[w][lang]) || w;
      return `<div class="card"><div class="emo">${picFor(w) || "🔸"}</div><div class="hi">${w}</div><div class="tri">${t}</div></div>`;
    }).join("") + `</div>`;
  }
  window.PalashGen = { worksheetHTML, flashcardsHTML };
})();
