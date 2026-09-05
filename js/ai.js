/* vanisanchar Sarvam AI bridge — online translation upgrade, offline-first.
   Hindi (hi-IN) -> Santali (sat-IN) via api.sarvam.ai/translate.
   Offline dict always answers instantly; AI upgrades quality when online. */
(function () {
  "use strict";
  var KEY = "sk_0trvlozk_BUXn7F9uic5C7ZbfZvWceR7D";
  var URL = "https://api.sarvam.ai/translate";
  var ENABLE_STORE = "vanisanchar_ai_enabled";
  var CACHE_STORE = "vanisanchar_ai_cache_v1";
  var MAX_CACHE = 400;

  function loadJSON(k, fb) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
  function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  var cache = loadJSON(CACHE_STORE, {});

  function enabled() { return loadJSON(ENABLE_STORE, false); }
  function setEnabled(v) {
    try { localStorage.setItem(ENABLE_STORE, v ? "1" : "0"); } catch (e) {}
  }
  function online() { return navigator.onLine !== false; }

  function norm(s) {
    return (s || "").replace(/[।!?.,;:"'\-\u200C\u200D]+/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function cachePut(k, text) {
    cache[k] = text;
    var keys = Object.keys(cache);
    if (keys.length > MAX_CACHE) {
      var del = keys.slice(0, keys.length - MAX_CACHE);
      del.forEach(function (k2) { delete cache[k2]; });
    }
    saveJSON(CACHE_STORE, cache);
  }

  /* Returns promise<string|null>. null on cache miss+network fail/timeout. */
  function translate(text, lang, timeoutMs) {
    var t = norm(text);
    if (!t) return Promise.resolve(null);
    if (t.length > 240) t = t.slice(0, 240);
    var key = t + "|" + lang;
    if (cache[key]) return Promise.resolve(cache[key]);
    if (!online()) return Promise.resolve(null);
    var body = {
      input: t,
      source_language_code: "hi-IN",
      target_language_code: "sat-IN",
      model: "sarvam-translate:v1",
      mode: "formal",
      numerals_format: "international"
    };
    var limit = timeoutMs || 6000;
    function attempt() {
      var ok = false;
      var ctl = new AbortController();
      var timer = setTimeout(function () { if (!ok) try { ctl.abort(); } catch (e) {} }, limit);
      return fetch(URL, {
        method: "POST",
        headers: { "api-subscription-key": KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctl.signal
      }).then(function (r) { ok = true; clearTimeout(timer); return r.json(); })
        .then(function (j) {
          var out = (j && j.translated_text) ? j.translated_text : null;
          if (out) cachePut(key, out);
          return out;
        })
        .catch(function () { clearTimeout(timer); return null; });
    }
    return attempt().then(function (out) {
      if (out) return out;
      return attempt();
    });
  }

  /* Key sanity probe: returns promise<boolean> */
  function test() {
    return translate("तुम्हारा नाम क्या है", "sat", 8000).then(function (r) { return !!r; });
  }

  window.PalashAI = { translate: translate, enabled: enabled, setEnabled: setEnabled, online: online, test: test };
})();