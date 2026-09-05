/* Voice-to-voice v2.1: hi-IN STT -> PalashMT/AI -> tribal TTS.
   ANDROID: native bridge (window.Android).
   BROWSER: Web Speech API fallback.
   Offline dict speaks instantly; Sarvam AI upgrades text + re-speaks.
   Ol Chiki output is transliterated to Latin for TTS (js/olchiki.js). */
(function () {
  "use strict";
  const NATIVE = () => !!(window.Android && window.Android.speak);
  let rec = null, listening = false, pipelineStart = 0, doneCb = null, doneCb2 = null;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  window.onNativeSpeechError = function (msg) { window.__palashErr && window.__palashErr(msg); };

  function speakable(text) {
    if (!text) return text;
    var rom = PalashMT.romanOnly(text);
    if (/[A-Za-z]/.test(rom)) return rom;
    if (/[\u1C50-\u1C7F]/.test(text) && window.OlChiki) return OlChiki.toLatin(text);
    return text;
  }
  function cancelSpeak() {
    try { if (NATIVE() && window.Android.stopSpeak) window.Android.stopSpeak(); } catch (e) {}
    try { if (window.speechSynthesis && speechSynthesis.cancel) speechSynthesis.cancel(); } catch (e) {}
  }
  function speak(text, langCode, rate, done) {
    const cb = done;
    const finish = () => { if (doneCb === cb) doneCb = null; cb && cb(); };
    if (NATIVE()) {
      doneCb = cb;
      window.onNativeTtsDone = finish;
      try { window.Android.speak(text); } catch (e) { finish(); }
      setTimeout(finish, 9000);
      return;
    }
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = langCode || "hi-IN"; u.rate = rate || 0.9;
      const vs = speechSynthesis.getVoices();
      const pick = vs.find(v => v.lang && v.lang.startsWith((langCode || "hi").slice(0, 2)));
      if (pick) u.voice = pick;
      u.onend = finish;
      u.onerror = finish;
      speechSynthesis.speak(u);
      setTimeout(finish, 7000);
    } catch (e) { finish(); }
  }
  function speakAll(hindiLines, lang, onDone) {
    const romans = hindiLines.map(h => speakable(PalashMT.translate(h, lang).output));
    if (NATIVE() && window.Android.speakQueue) {
      try { window.Android.stopSpeak(); romans.forEach(t => window.Android.speakQueue(t)); } catch (e) {}
      let n = 0;
      window.onNativeTtsDone = function () { n++; if (n >= romans.length) { const cb = doneCb2; doneCb2 = null; cb && cb(); } };
      doneCb2 = onDone;
      setTimeout(() => { const cb = doneCb2; doneCb2 = null; cb && cb(); }, romans.length * 7000 + 4000);
      return;
    }
    let i = 0;
    const next = () => { if (i >= romans.length) { onDone && onDone(); return; } speak(romans[i++], "hi-IN", 0.9, next); };
    next();
  }
  function pipeline(hindiText, lang, onStep) {
    pipelineStart = performance.now();
    onStep({ stage: "hindi", text: hindiText, ms: 0 });
    const r = PalashMT.translate(hindiText, lang);
    const mtMs = Math.round((performance.now() - pipelineStart));
    onStep({ stage: "tribal", text: r.output, roman: speakable(r.output), ms: mtMs, coverage: r.coverage });
    cancelSpeak();
    speak(speakable(r.output), "hi-IN", 0.85, () => {
      const total = Math.round((performance.now() - pipelineStart));
      onStep({ stage: "done", ms: total, ok: total < 3000, ai: false });
    });
    const wantAI = !!(window.PalashAI && PalashAI.enabled() && PalashAI.online() && r.coverage < 1);
    if (wantAI) {
      const aiMs = Math.round((performance.now() - pipelineStart));
      onStep({ stage: "ai", ms: aiMs });
      PalashAI.translate(hindiText, lang, 7000).then(ai => {
        if (!ai) return;
        const arrival = Math.round(performance.now() - pipelineStart);
        cancelSpeak();
        onStep({ stage: "tribal", text: ai, roman: speakable(ai), ms: arrival, coverage: 1, ai: true });
        cancelSpeak();
        speak(speakable(ai), "hi-IN", 0.85, () => {
          onStep({ stage: "aifin", ms: Math.round(performance.now() - pipelineStart), ok: arrival < 3000 });
        });
      });
    }
  }
  function nativeListen(lang, onStep, onErr) {
    pipelineStart = performance.now();
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
    pipelineStart = performance.now();
    rec.onresult = (e) => {
      let interim = "", fin = "";
      for (const x of e.results) { if (x.isFinal) fin += x[0].transcript; else interim += x[0].transcript; }
      onStep({ stage: "hearing", text: interim || fin });
      if (fin) { listening = false; pipeline(fin.trim(), lang, onStep); }
    };
    rec.onerror = (e) => onErr && onErr("Mic error: " + e.error);
    rec.onend = () => { listening = false; };
    try { rec.start(); listening = true; } catch (e) { onErr && onErr(String(e)); }
    return true;
  }
  if (NATIVE()) try { window.Android.prewarmTTS(); } catch (e) {}
  window.PalashVoice = { pipeline, toggleListen, speak, speakable, speakAll, cancelSpeak, hasSTT: !!SR, isNative: NATIVE };
})();