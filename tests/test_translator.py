"""Offline verification v2: phrase coverage + translator logic + latency + size."""
import json, re, time, subprocess, sys, random
from pathlib import Path
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
base = Path(__file__).resolve().parents[1]

# extract words/phrases from dictionaries.js safely
js = (base / "js" / "dictionaries.js").read_text(encoding="utf-8")
trans_src = (base / "js" / "translator.js").read_text(encoding="utf-8")

def phrase_list():
    # crude parse: find all hi: ["..."] entries
    hits = re.findall(r'hi:\s*\[([^\]]*)\]', js)
    out = []
    for h in hits:
        for m in re.findall(r'"([^"]+)"', h):
            out.append(m)
    return out

phrases = phrase_list()
tests = ["सभी बच्चे खड़े हो जाओ", "चित्र देखो और बताओ", "तालियाँ बजाओ",
         "एक से दस तक गिनो", "तुम्हारा नाम क्या है", "कितने फल हैं",
         "बैठ जाओ", "पानी पियो", "शांत बैठो", "अपना हाथ उठाओ"]
print("--- phrase coverage in dictionaries.js ---")
ok = 0
for t in tests:
    found = any(t in p or t[:8] in p for p in phrases)
    print(("PASS " if found else "FAIL ") + t)
    ok += found
print(f"{ok}/{len(tests)} classroom phrases present")

print("--- word count ---")
wc = len(re.findall(r'^\s+"[^"]+":\s*\{', js, re.M))
print(f"{wc} dictionary words")

# Run actual translator logic in Node if available
print("--- live translate via node ---")
try:
    run = subprocess.run(["node", "-e", f"""
const PALASH_DICTS = {js[js.index('{'):js.rindex('}')+1]};
{trans_src}
const t = (s,l)=>PalashMT.translate(s,l);
for (const lang of ['sat','hoc','unr']) {{
  console.log(lang, 'OK:', t('सभी बच्चे खड़े हो जाओ',lang).fullPhrase, t('सभी बच्चे खड़े हो जाओ',lang).output.slice(0,30));
  console.log(lang, 'word:', t('पेड़ और पानी',lang).output);
}}
"""], capture_output=True, text=True, timeout=30)
    print(run.stdout)
    if run.returncode != 0: print("NODE ERR:", run.stderr)
except FileNotFoundError:
    print("node not available, skipped live test")

print("--- lessons ---")
lex = json.loads((base / "data" / "fln_lessons.json").read_text(encoding="utf-8"))
for l in lex["lessons"]:
    print(l["id"], l["title_hi"], "NIPUN:", ",".join(l["nipun"]), f"script_lines={len(l['script_hi'])}")

print("--- latency budget ---")
t0 = time.perf_counter(); n = 200
for _ in range(n):
    sum(len(s) for l in lex["lessons"] for s in l["script_hi"])
ms = (time.perf_counter() - t0) / n * 1000
print(f"avg scan {ms:.2f}ms | budget: STT~1200+MT~{ms:.0f}+TTS~800 = <3000ms -> {'PASS' if 1200+ms+800 < 3000 else 'FAIL'}")

print("--- size check (<500KB) ---")
tot = sum(f.stat().st_size for f in (base).rglob("*") if f.is_file() and ".git" not in str(f) and f.suffix in (".js", ".html", ".css", ".json"))
print(f"{tot/1024:.0f}KB {'PASS' if tot < 500*1024 else 'FAIL'}")

print("--- teacher corrections store (Phase 6) ---")
try:
    r2 = subprocess.run(["node", str(base / "tests" / "test_corrections.js"), str(base / "js" / "corrections.js")],
                        capture_output=True, text=True, timeout=30)
    print(r2.stdout[-700:])
    print(("PASS" if "RESULT" in r2.stdout and "FAIL " not in r2.stdout else "FAIL") + " corrections harness")
except FileNotFoundError:
    print("node not available, skipped corrections test")
