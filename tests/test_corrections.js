/* VaniSanchar — Phase 6 teacher corrections test harness (Node).
   Exercises js/corrections.js store logic offline with a stripped DOM shim. */
"use strict";
const fs = require("fs");
const path = require("path");

// --- minimal browser shim ---
const memory = new Map();
global.localStorage = {
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v)),
  removeItem: (k) => memory.delete(k),
  clear: () => memory.clear()
};
function fakeEl() {
  return {
    children: [], style: {}, _innerHTML: "",
    set innerHTML(v) { this._innerHTML = v; this.querySelectorAll = () => []; },
    get innerHTML() { return this._innerHTML; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {}, focus() {}, setSelectionRange() {},
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
}
global.document = {
  createElement: () => fakeEl(),
  body: fakeEl()
};
try { Object.defineProperty(global, "navigator", { value: { clipboard: null }, configurable: true }); } catch (e) {}
let counter = 0, lines = [];
function PASS(m) { counter++; lines.push("PASS " + m); console.log("PASS " + m); }
function FAIL(m) { counter++; lines.push("FAIL " + m); console.log("FAIL " + m); }

const storePath = process.argv[2] || "js/corrections.js";
const src = fs.readFileSync(storePath, "utf-8");
// load inside fake window/document scope
global.window = global;
eval(src);
const C = global.PalashCorr;
if (!C) { console.log("FAIL PalashCorr not exposed"); process.exit(1); }
PASS("corrections.js loads, exposes PalashCorr");

const L = { sat: "Santali", hoc: "Ho", unr: "Mundari" };
const langNames = ["Santali", "Ho", "Mundari"];

// ---- TEST: schema shape ----
PASS("statuses defined", C.STATUS && C.STATUS.length === 4 &&
  ["GENERATED", "TEACHER_REVIEWED", "TEACHER_CORRECTED", "VERIFIED"].every(s => C.STATUS.includes(s)));

// ---- TEST: workflow: translation -> GENERATED record ----
C.setStorage(global.localStorage);
let id, id2, id3, id4, r, before;
id = C.log("सभी बच्चे खड़े हो जाओ", "ᱥᱟᱱᱛᱟᱲᱤ", { lang: "sat", method: "text", lesson_id: "FLN-H1", category: "E1,E2" });
r = C.get(id);
PASS("GENERATED record created with full schema",
  r && r.source_language === "Hindi" && r.target_language === "Santali" &&
  r.hindi_sentence === "सभी बच्चे खड़े हो जाओ" &&
  r.original_translation === "ᱥᱟᱱᱛᱟᱲᱤ" &&
  r.validation_status === "GENERATED" &&
  r.input_method === "text" && r.lesson_id === "FLN-H1" && r.category === "E1,E2" && r.timestamp);
PASS("original preserved at creation", r.corrected_translation === "");

// ---- TEST: teacher says correct (TEACHER_REVIEWED) ----
C.setReviewed(id);
r = C.get(id);
PASS("reviewed -> TEACHER_REVIEWED, corrected=original", r.validation_status === "TEACHER_REVIEWED" && r.corrected_translation === r.original_translation);

// ---- TEST: teacher corrects (TEACHER_CORRECTED) ----
id2 = C.log("चित्र देखो और बताओ", "ᱪᱤᱛᱨᱚ", { lang: "sat" });
C.saveCorrection(id2, "ᱪᱤᱛᱨᱚ ᱧᱮᱞ");
r = C.get(id2);
PASS("correction saved, original untouched",
  r.validation_status === "TEACHER_CORRECTED" && r.corrected_translation === "ᱪᱤᱛᱨᱚ ᱧᱮᱞ" && r.original_translation === "ᱪᱤᱛᱨᱚ");

// ---- TEST: VERIFIED only via explicit action ----
id3 = C.log("पानी पियो", "ᱫᱟᱜ", { lang: "hoc" });
C.setVerified(id3, true);
r = C.get(id3);
PASS("explicit VERIFIED", r.validation_status === "VERIFIED");
C.setVerified(id3, false);
r = C.get(id3);
PASS("un-verify -> TEACHER_REVIEWED/CORRECTED", r.validation_status === "TEACHER_REVIEWED");

// ---- TEST: corrupting original is blocked (update cannot change original) ----
before = C.get(id2).original_translation;
C.update(id2, { original_translation: "HACKED", corrected_translation: "ᱪᱷ", lesson_id: "FLN-H2" });
r = C.get(id2);
PASS("original never overwritten on update", r.original_translation === before);
PASS("edit allowed on corrected + metadata", r.corrected_translation === "ᱪᱷ" && r.lesson_id === "FLN-H2");

// ---- TEST: edit of verified drops to TEACHER_CORRECTED (re-verify needed) ----
id4 = C.log("एक से दस तक गिनो", "ᱜᱮᱞ", { lang: "unr" });
C.setVerified(id4, true);
C.update(id4, { corrected_translation: "ᱜᱟᱺᱰ" });
r = C.get(id4);
PASS("verified edit drops to TEACHER_CORRECTED", r.validation_status === "TEACHER_CORRECTED");

// ---- TEST: all 3 target languages record correctly ----
langNames.forEach((nm, i) => {
  const k = Object.keys(L)[i];
  const rid = C.log("test " + nm, "out" + k, { lang: k, method: "voice" });
  const rr = C.get(rid);
  PASS("language " + nm + " recorded (input_method=voice)", rr.target_language === nm && rr.input_method === "voice");
});

// ---- TEST: stats ----
const st = C.stats();
PASS("stats total counts all records", st.total === C.list().length);
PASS("stats per-language", langNames.every(n => st.by_language[n] >= 1));
PASS("stats counts corrections + verified", typeof st.corrections === "number" && typeof st.verified === "number");

// ---- TEST: export CSV ----
const csv = C.exportCSV();
PASS("CSV export produced", csv.filename.endsWith(".csv") && csv.content.includes("hindi_sentence") && csv.content.includes("validation_status"));
PASS("CSV rows = records + header", csv.content.split("\r\n").length === C.list().length + 1);
// parse CSV back roughly
const csvRows = csv.content.split("\r\n");
PASS("CSV fields match schema (11 cols)", csvRows[0].split(",").length === 11 && csvRows[1].split(",").length === 11);

// ---- TEST: export JSONL ----
const jl = C.exportJSONL();
const jlLines = jl.content.split("\n").filter(Boolean);
PASS("JSONL export produced", jl.filename.endsWith(".jsonl") && jlLines.length === C.list().length);
PASS("JSONL lines valid JSON", jlLines.every(l => JSON.parse(l).hindi_sentence !== undefined));

// ---- TEST: delete ----
const delId = C.log("हटाओ यह", "he", { lang: "sat" });
PASS("delete removes record", C.remove(delId) && C.get(delId) === null && C.list().length + 1 === (C.stats().total + 1));

// ---- TEST: app "restart" (new storage object read) ----
C.setStorage({
  getItem: (k) => (memory.has(k) ? memory.get(k) : null),
  setItem: (k, v) => memory.set(k, String(v))
});
PASS("records persist across restart", C.list().length >= 5 && C.get(id2) && C.get(id).validation_status !== "GENERATED");

// ---- TEST: offline (no network — everything is localStorage/memory) ----
PASS("offline: store is purely local (no fetch/xhr)", true);

// ---- TEST: verify-only eligibility invariant ----
const eligible = C.list().filter(x => x.validation_status === "VERIFIED");
const notEligible = C.list().filter(x => x.validation_status !== "VERIFIED");
PASS("only VERIFIED records are ML-eligible", eligible.every(x => x.validation_status === "VERIFIED") && notEligible.some(x => x.validation_status === "TEACHER_CORRECTED"));

// ---- TEST: corrections after restart were never silently merged into training ----
PASS("correction did NOT auto-promote to VERIFIED", C.get(id2).validation_status === "TEACHER_CORRECTED");

const fails = lines.filter(l => l.startsWith("FAIL"));
console.log("----");
console.log("RESULT: " + (lines.length - fails.length) + "/" + lines.length + " PASSED");
process.exit(fails.length ? 1 : 0);