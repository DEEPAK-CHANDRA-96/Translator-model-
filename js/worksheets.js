/* Worksheet + flashcard generator v2.0: bilingual, NIPUN-coded, print-ready. */
(function () {
  "use strict";
  const EMOJI = { "पेड़": "🌳", "फूल": "🌸", "नदी": "🌊", "फल": "🍎", "आम": "🥭", "केला": "🍌", "गाय": "🐄", "बकरी": "🐐", "मुर्गी": "🐔", "मछली": "🐟", "सूरज": "☀️", "चाँद": "🌙", "तारा": "⭐", "घर": "🏠", "स्कूल": "🏫", "किताब": "📖", "पानी": "💧", "जंगल": "🌿", "पत्थर": "🪨", "चित्र": "🖼️", "हाथ": "✋", "पैर": "🦶", "सिर": "🧠", "आँख": "👁️", "नाक": "👃", "मुँह": "👄", "बिल्ली": "🐱", "कुत्ता": "🐶", "हाथी": "🐘", "मोर": "🦚", "तितली": "🦋", "बीज": "🌱", "रंग": "🎨", "गोल": "⭕", "चौकोर": "🔲", "दूध": "🥛", "रोटी": "🫓", "चावल": "🍚", "सेब": "🍏", "नारियल": "🥥", "दाल": "🫘", "हवा": "🌬️", "बारिश": "🌧️", "बिजली": "⚡", "बादल": "☁️", "पहाड़": "⛰️", "रास्ता": "🛤️", "बाज़ार": "🏪", "नमक": "🧂", "तेल": "🫗" };
  function picFor(hi) { for (const k in EMOJI) if (hi.includes(k)) return EMOJI[k]; return "🔸"; }
  function countBlock(lesson) {
    if (!lesson.nipun.some(c => c.indexOf("N") === 0)) return "";
    const items = [
      { e: "🍎🍎🍎", a: 3 }, { e: "🥭🥭", a: 2 }, { e: "⭐⭐⭐⭐⭐", a: 5 },
      { e: "🌸🌸", a: 2 }, { e: "🐟🐟🐟🐟", a: 4 }, { e: "🌳🌳🌳🌳🌳🌳", a: 6 }
    ];
    let h = '<h3>🔢 गिनती — चित्र गिनो</h3><div class="count">';
    items.forEach(i => { h += '<span>' + i.e + ' ___</span> '; });
    h += "</div>";
    return h;
  }
  function wordBank(lesson, lang) {
    const words = [];
    lesson.script_hi.forEach(s => {
      s.split(" ").forEach(w => {
        const nw = w.replace(/[।?!,.]/g, "");
        if (nw.length > 1 && PALASH_DICTS.words[nw]) words.push(nw);
      });
    });
    if (words.length < 3) return "";
    const uniq = Array.from(new Set(words)).slice(0, 12);
    let h = '<h3>🧮 वर्गसीट बैंक</h3><div class="word-bank">';
    uniq.forEach(w => {
      const t = PalashMT.translate(w, lang).output;
      h += '<div class="wb-item"><span class="wb-hi">' + w + '</span><span class="wb-tri">' + PalashMT.romanOnly(t) + '</span></div>';
    });
    h += "</div>";
    return h;
  }
  function worksheetHTML(lesson, lang, nipun) {
    const L = lang || "sat";
    const lname = { sat: "Santali", hoc: "Ho", unr: "Mundari" }[L];
    const tr = (s) => PalashMT.translate(s, L).output;
    let h = '<div class="sheet"><div class="sheet-head"><b>PALASH • ' + lesson.id + " • " + lname + '</b><span>NIPUN: ' + lesson.nipun.join(", ") + '</span></div><h2>' + lesson.title_hi + '</h2><p class="tri">' + tr(lesson.title_hi) + '</p><div class="nipun">';
    lesson.nipun.forEach(c => { h += '<span title="' + nipun[c] + '">' + c + ": " + nipun[c] + "</span>"; });
    h += '</div><h3>📖 पाठ (Bilingual script)</h3><ol>';
    lesson.script_hi.forEach(s => { h += '<li><div>' + s + '</div><div class="tri">' + tr(s) + '</div></li>'; });
    h += '</ol><h3>🎯 गतिविधि</h3><p>' + lesson.activity_hi + '</p><p class="tri">' + tr(lesson.activity_hi) + '</p><h3>✏️ अभ्यास (Worksheet)</h3>';
    lesson.assess_hi.forEach((q, i) => {
      h += '<div class="q"><b>Q' + (i + 1) + ". " + q + '</b><div class="tri">' + tr(q) + '</div><div class="pic">' + picFor(q) + " &nbsp; ✍️ ______</div></div>";
    });
    h += countBlock(lesson);
    h += wordBank(lesson, L);
    h += '<div class="foot">नाम: ______ &nbsp; कक्षा: ______ &nbsp; दिनांक: ______ &nbsp; ✅ शिक्षक हस्ताक्षर</div></div>';
    return h;
  }
  function flashcardsHTML(words, lang) {
    return '<div class="cards">' + words.map(w => {
      const t = (PALASH_DICTS.words[w] && PALASH_DICTS.words[w][lang]) || w;
      const roman = PalashMT.romanOnly(t);
      return '<div class="fcard" onclick="this.classList.toggle(\'flip\')"><div class="fin"><div class="face front"><div class="emo">' + (picFor(w) || "🔸") + '</div><div class="hi">' + w + '</div><div class="meta">tap</div></div><div class="face back"><div class="tri" style="font-size:18px">' + t + '</div><div class="meta" style="font-size:12px;margin-top:4px">' + roman + '</div></div></div></div>';
    }).join("") + "</div>";
  }
  function worksheetText(lesson, lang) {
    const tr = (s) => PalashMT.translate(s, lang || "sat").output;
    let t = "PALASH " + lesson.id + " | " + lesson.title_hi + "\n" + tr(lesson.title_hi) + "\nNIPUN: " + lesson.nipun.join(", ") + "\n\n";
    lesson.script_hi.forEach((s, i) => { t += (i + 1) + ". " + s + "\n   " + tr(s) + "\n"; });
    t += "\nगतिविधि: " + lesson.activity_hi + "\n" + tr(lesson.activity_hi) + "\n\nअभ्यास:\n";
    lesson.assess_hi.forEach((q, i) => { t += "Q" + (i + 1) + ". " + q + "\n   " + tr(q) + "\n"; });
    return t;
  }
  window.PalashGen = { worksheetHTML, flashcardsHTML, worksheetText };
})();
