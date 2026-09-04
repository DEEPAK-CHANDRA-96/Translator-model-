/* Voice-to-voice v2.0: hi-IN STT -> PalashMT -> tribal TTS.
   ANDROID: native bridge (window.Android).
   BROWSER: Web Speech API fallback. */
(function () {
  "use strict";
  const NATIVE = () => !!(window.Android && window.Android.speak);
  let rec = null, listening = false, tStart = 0, doneCb = null, doneCb2 = null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  window.onNativeTtsDone = function () { const cb = doneCb; doneCb = null; cb && cb(); };
  window.onNativeSpeechError = function (msg) { window.__palashErr && window.__palashErr(msg); };

  function speak(text, langCode, rate, done) {
    if (NATIVE()) {
      doneCb = done;
      try { window.Android.speak(text); } catch (e) { done && done(); }
      setTimeout(() => { const cb = doneCb; doneCb = null; cb && cb(); }, 8000);
      return;
    }
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
      setTimeout(() => done && done(), 6000);
    } catch (e) { done && done(); }
  }
  function speakAll(hindiLines, lang, onDone) {
    const romans = hindiLines.map(h => PalashMT.romanOnly(PalashMT.translate(h, lang).output));
    if (NATIVE() && window.Android.speakQueue) {
      try { window.Android.stopSpeak(); romans.forEach(t => window.Android.speakQueue(t)); } catch (e) {}
      let n = 0;
      window.onNativeTtsDone = function () { n++; if (n >= romans.length) { const cb = doneCb2; doneCb2 = null; cb && cb(); } };
      doneCb2 = onDone;
      setTimeout(() => { const cb = doneCb2; doneCb2 = null; cb && cb(); }, romans.length * 6000 + 4000);
      return;
    }
    let i = 0;
    const next = () => { if (i >= romans.length) { onDone && onDone(); return; } speak(romans[i++], "hi-IN", 0.9, next); };
    next();
  }
  function pipeline(hindiText, lang, onStep) {
    tStart = performance.now();
    onStep({ stage: "hindi", text: hindiText, ms: 0 });
    const r = PalashMT.translate(hindiText, lang);
    const speakText = PalashMT.romanOnly(r.output);
    const mtMs = Math.round((performance.now() - tStart) * 10) / 10;
    onStep({ stage: "tribal", text: r.output, roman: speakText, ms: mtMs, coverage: r.coverage });
    speak(speakText, "hi-IN", 0.85, () => {
      const total = Math.round((performance.now() - tStart) * 10) / 10;
      onStep({ stage: "done", ms: total, ok: total < 3000 });
    });
  }
  function nativeListen(lang, onStep, onErr) {
    tStart = performance.now();
    window.onNativeSpeech = function (fin) {
      onStep({ stage: "hearing", text: fin });
      pipeline((fin || "").trim(), lang, onStep);
    };
    window.__palashErr = onErr;
    try { window.Android.listen(); return true; }
    catch (e) { onErr && onErr(String(e)); return false; }
  }
  function toggleListen(lang, onStep, onErr) {
    if (NATIVE()) return nativeListen(lang, onStep, onErr);
    if (!SR) { onErr && onErr("STT not available — type karke dabao (offline)."); return false; }
    if (listening) { try { rec.stop(); } catch (e) {} listening = false; return false; }
    rec = new SR(); rec.lang = "hi-IN"; rec.interimResults = true; rec.maxAlternatives = 1;
    tStart = performance.now();
    rec.onresult = (e) => {
      let interim = "", fin = "";
      for (const r of e.results) { if (r.isFinal) fin += r[0].transcript; else interim += r[0].transcript; }
      onStep({ stage: "hearing", text: interim || fin });
      if (fin) { listening = false; pipeline(fin.trim(), lang, onStep); }
    };
    rec.onerror = (e) => onErr && onErr("Mic error: " + e.error);
    rec.onend = () => { listening = false; };
    try { rec.start(); listening = true; } catch (e) { onErr && onErr(String(e)); }
    return true;
  }
  if (NATIVE()) try { window.Android.prewarmTTS(); } catch (e) {}
  window.PalashVoice = { pipeline, toggleListen, speak, speakAll, hasSTT: !!SR, isNative: NATIVE };
})();
