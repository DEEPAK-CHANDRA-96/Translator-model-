/* PALASH NLP engine — offline, tiny-RAM, phrase-first translator.
   Pipeline: normalise -> phrase match (longest) -> word lookup ->
   morphological strip (े/ों/ें/ो/ी/ा) -> fallback [bracket gloss] + coverage score.
   Latency target: <50ms text; voice pipeline budgets STT+MT+TTS <3000ms. */
(function () {
  "use strict";
  function norm(s) {
    return (s || "").replace(/[।!?.,;:"]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function stripForms(w) {
    const suf = ["ों", "ें", "ों", "ियों", "ियाँ", "ों", "े", "ो", "ी", "ा", "ँ", "ं"];
    for (const s of suf) { if (w.length > s.length + 1 && w.endsWith(s)) return w.slice(0, -s.length); }
    return w;
  }
  function phraseHit(input, lang) {
    const n = " " + norm(input) + " ";
    let best = null;
    for (const p of PALASH_DICTS.phrases) {
      for (const h of p.hi) {
        const hn = " " + norm(h) + " ";
        if (n.includes(hn) && (!best || hn.length > best.len)) best = { len: hn.length, p };
      }
    }
    return best ? best.p[lang] : null;
  }
  function translateWord(w, lang) {
    const D = PALASH_DICTS.words;
    if (D[w] && D[w][lang]) return { t: D[w][lang], known: true };
    const s = stripForms(w);
    if (D[s] && D[s][lang]) return { t: D[s][lang], known: true };
    return { t: "[" + w + "]", known: false };
  }
  function translate(text, lang) {
    lang = lang || "sat";
    const t0 = performance.now();
    const clean = norm(text);
    if (!clean) return { input: text, output: "", lang, ms: 0, coverage: 1, fullPhrase: false };
    const full = phraseHit(clean, lang);
    let out, known = 0, total = 0, fullPhrase = false;
    if (full && clean.split(" ").length <= 8) {
      out = full; fullPhrase = true; known = total = clean.split(" ").length;
    } else {
      const toks = clean.split(" ");
      total = toks.length;
      const parts = toks.map(w => { const r = translateWord(w, lang); if (r.known) known++; return r.t; });
      // splice any embedded phrase hits inline (classroom instructions)
      let joined = parts.join(" ");
      const inline = phraseHit(clean, lang);
      out = inline ? inline + " ॥ " + joined : joined;
    }
    const ms = performance.now() - t0;
    return { input: text, output: out, lang, ms: Math.round(ms * 10) / 10, coverage: total ? known / total : 1, fullPhrase };
  }
  // Roman-only form for TTS (strip Ol Chiki, keep latin) so stock TTS can speak it
  function romanOnly(s) {
    return (s || "").replace(/[\u1C50-\u1C7F]+/g, "").replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").replace(/^[()/ ]+/, "").trim() || s;
  }
  window.PalashMT = { translate, romanOnly, norm };
})();
