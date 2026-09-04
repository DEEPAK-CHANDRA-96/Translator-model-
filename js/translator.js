/* PALASH NLP engine v2.0 — offline, phrase-first, sub-word translator.
   Pipeline: normalise -> phrase match (longest) -> word lookup ->
   morphological strip -> postposition match -> fallback [bracket].
   Latency target: <30ms text; voice pipeline <3000ms. */
(function () {
  "use strict";
  const _cache = new Map();
  function norm(s) {
    return (s || "").replace(/[।!?.,;:"'\-\u200C\u200D]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }
  function stripForms(w) {
    const suf = ["ियों", "ियाँ", "ों", "ें", "ों", "े", "ो", "ी", "ा", "ँ", "ं", "ता", "ती", "ते", "ना", "ने", "गा", "गी", "गे", "ओ", "ए", "ना"];
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
    const nw = norm(w);
    if (D[nw] && D[nw][lang]) return { t: D[nw][lang], known: true };
    if (D[w] && D[w][lang]) return { t: D[w][lang], known: true };
    const s = stripForms(nw);
    if (s !== nw && D[s] && D[s][lang]) return { t: D[s][lang], known: true };
    if (D[stripForms(w)] && D[stripForms(w)][lang]) return { t: D[stripForms(w)][lang], known: true };
    return { t: "[" + w + "]", known: false };
  }
  function detectPostpositions(tokens, lang) {
    const pp = PALASH_DICTS.postpositions;
    const out = [];
    let i = 0;
    while (i < tokens.length) {
      const t = norm(tokens[i]);
      if (pp[t] && pp[t][lang] && i > 0) {
        const prev = out[out.length - 1];
        if (prev && prev.known) {
          prev.t = prev.t + "-" + pp[t][lang];
          i++; continue;
        }
      }
      out.push(translateWord(tokens[i], lang));
      i++;
    }
    return out;
  }
  function translate(text, lang) {
    lang = lang || "sat";
    const t0 = performance.now();
    const clean = norm(text);
    if (!clean) return { input: text, output: "", lang, ms: 0, coverage: 1, fullPhrase: false };
    const ck = clean + "|" + lang;
    if (_cache.has(ck)) return _cache.get(ck);
    const full = phraseHit(clean, lang);
    let out, known = 0, total = 0, fullPhrase = false;
    if (full && clean.split(" ").length <= 10) {
      out = full; fullPhrase = true; known = total = clean.split(" ").length;
    } else {
      const toks = clean.split(" ");
      total = toks.length;
      const parts = detectPostpositions(toks, lang);
      parts.forEach(r => { if (r.known) known++; });
      let joined = parts.map(r => r.t).join(" ");
      const inline = phraseHit(clean, lang);
      out = inline ? inline + " \u2726 " + joined : joined;
    }
    const ms = Math.round((performance.now() - t0) * 10) / 10;
    const result = { input: text, output: out, lang, ms, coverage: total ? known / total : 1, fullPhrase };
    if (_cache.size > 200) _cache.clear();
    _cache.set(ck, result);
    return result;
  }
  function romanOnly(s) {
    return (s || "").replace(/[\u1C50-\u1C7F]+/g, "").replace(/\s*\/\s*/g, " ").replace(/\s*∗\s*/g, " ").replace(/\s+/g, " ").replace(/^[()/∗ ]+/, "").trim() || s;
  }
  window.PalashMT = { translate, romanOnly, norm };
})();
