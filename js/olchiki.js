/* Ol Chiki -> Latin transliterator for Santali TTS.
   Ol Chiki block U+1C50..U+1C7F (letters + digits + danda). */
(function () {
  "use strict";
  var MAP = {
    "\u1C5A": "a", "\u1C5B": "t", "\u1C5C": "g", "\u1C5D": "ng", "\u1C5E": "l",
    "\u1C5F": "a", "\u1C60": "k", "\u1C61": "j", "\u1C62": "m", "\u1C63": "w",
    "\u1C64": "i", "\u1C65": "s", "\u1C66": "h", "\u1C67": "ny", "\u1C68": "r",
    "\u1C69": "u", "\u1C6A": "c", "\u1C6B": "d", "\u1C6C": "nn", "\u1C6D": "y",
    "\u1C6E": "e", "\u1C6F": "p", "\u1C70": "dd", "\u1C71": "n", "\u1C72": "rr",
    "\u1C73": "o", "\u1C74": "tt", "\u1C75": "b", "\u1C76": "m", "\u1C77": "h",
    "\u1C78": "m",
    "\u1C50": "0", "\u1C51": "1", "\u1C52": "2", "\u1C53": "3", "\u1C54": "4",
    "\u1C55": "5", "\u1C56": "6", "\u1C57": "7", "\u1C58": "8", "\u1C59": "9"
  };
  function toLatin(s) {
    if (!s) return s;
    return (s || "")
      .replace(/[\u1C78-\u1C7C]/g, "")
      .replace(/[\u1C7D\u1C7E]/g, " ")
      .replace(/[\u1C50-\u1C77]/g, function (ch) { return MAP[ch] !== undefined ? MAP[ch] : ""; })
      .replace(/\s+/g, " ")
      .trim() || s;
  }
  window.OlChiki = { toLatin: toLatin };
})();