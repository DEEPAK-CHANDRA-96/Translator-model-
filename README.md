# PALASH MTB-MLE Bridge — Hindi → Santali / Ho / Mundari (Offline PWA)

Technology bridge for Jharkhand's PALASH programme: Hindi-medium teachers deliver
mother-tongue FLN instruction without prior tribal-language training.

## What it does (all on-device, offline after first sync)
1. **Hindi FLN → tribal translation** — phrase-first engine (`js/translator.js` + `js/dictionaries.js`):
   ~110 headwords × 3 languages + 20 classroom sentence patterns, Ol Chiki + Roman.
   Text latency <50ms (measured in UI).
2. **Real-time voice→voice** — hi-IN STT → PalashMT → TTS (`js/speech.js`) with live
   latency meter; target **<3000ms**. Works with on-device Google TTS/Hindi pack;
   one-tap text-to-speech fallback when mic/STT pack absent (same pipeline).
3. **Bilingual worksheets + flashcards** — auto-generated from `data/fln_lessons.json`,
   tagged to **NIPUN Bharat** outcomes, print/PDF via `window.print` (`js/worksheets.js`).
4. **Offline on 2GB / Android 9+** — vanilla JS, zero deps, <500KB total,
   Service-Worker cache-first; also runs from `file://`.

## Run (30 seconds)
```bash
cd palash-mtb-mle
python -m http.server 8000
# open http://localhost:8000  → pick Santali/Ho/Mundari → Translate → 🎙 Speak
# tablet: same URL over hotspot once, then airplane-mode ON — app keeps working
```
Or double-click `index.html` (SW skipped on file://, app still works).

## Demo video script (2 min) — see `demo_script.md`
1. Type Hindi FLN line → Santali (Ol Chiki+Roman) + Speak. 2. 🎙 Hindi voice →
   tribal audio, show latency <3000ms. 3. Select FLN-H1/N1 → worksheet + flashcards →
   Print/PDF. 4. DevTools → Network: Offline → repeat 1–3 (proves offline).

## Limits & next steps (honest)
Prototype lexicon is community-validatable, not a full MT model. Bracketed
`[word]` = out-of-lexicon (coverage % shown). Path to scale: expand wordlists with
teacher crowdsourcing → distil to INT8 on-device NMT (e.g. small Transformer) →
record native-speaker TTS corpus for Santali/Ho/Mundari.

## Repo layout
`index.html` `css/` `js/` (dictionaries, translator, speech, worksheets, app)
`data/fln_lessons.json` `sw.js` `manifest.json` `tests/`
