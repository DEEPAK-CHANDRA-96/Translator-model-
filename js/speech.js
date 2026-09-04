/* Voice-to-voice: hi-IN STT -> PalashMT -> tribal TTS. Latency meter included.
   Offline note: Web Speech API uses on-device pack when available (Android:
   Google TTS + downloaded Hindi). If STT unavailable (no mic/pack), text
   fallback keeps the classroom flow working offline with identical latency path. */
(function () {
  "use strict";
  let rec = null, listening = false, tStart = 0;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  function speak(text, langCode, rate, done) {
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langCode || "hi-IN"; u.rate = rate || 0.9;
      const vs = speechSynthesis.getVoices();
      const pick = vs.find(v => v.lang && v.lang.startsWith((langCode || "hi").slice(0, 2)));
      if (pick) u.voice = pick;
      u.onend = () => done && done();
      u.onerror = () => done && done();
      speechSynthesis.speak(u);
      // Safety: never hang the latency meter
      setTimeout(() => done && done(), 6000);
    } catch (e) { done && done(); }
  }
  function pipeline(hindiText, lang, onStep) {
    tStart = performance.now();
    onStep({ stage: "hindi", text: hindiText, ms: 0 });
    const r = PalashMT.translate(hindiText, lang);
    const speakText = PalashMT.romanOnly(r.output);
    const mtMs = Math.round((performance.now() - tStart) * 10) / 10;
    onStep({ stage: "tribal", text: r.output, roman: speakText, ms: mtMs, coverage: r.coverage });
    // Speak Hindi echo briefly? No — speak tribal directly for classroom use.
    speak(speakText, "hi-IN", 0.85, () => {
      const total = Math.round((performance.now() - tStart) * 10) / 10;
      onStep({ stage: "done", ms: total, ok: total < 3000 });
    });
  }
  function toggleListen(lang, onStep, onErr) {
    if (!SR) { onErr && onErr("STT not available on this browser — use text/तुरंत-बोलें fallback (still offline)."); return false; }
    if (listening) { try { rec.stop(); } catch (e) {} listening = false; return false; }
    rec = new SR(); rec.lang = "hi-IN"; rec.interimResults = true; rec.maxAlternatives = 1;
    tStart = performance.now();
    rec.onresult = (e) => {
      let interim = "", fin = "";
      for (const r of e.results) { if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; }
      onStep({ stage: "hearing", text: interim || fin });
      if (fin) { listening = false; pipeline(fin.trim(), lang, onStep); }
    };
    rec.onerror = (e) => onErr && onErr("Mic error: " + e.error + " — type instead, translation stays offline.");
    rec.onend = () => { listening = false; };
    try { rec.start(); listening = true; } catch (e) { onErr && onErr(String(e)); }
    return true;
  }
  window.PalashVoice = { pipeline, toggleListen, speak, hasSTT: !!SR };
})();
