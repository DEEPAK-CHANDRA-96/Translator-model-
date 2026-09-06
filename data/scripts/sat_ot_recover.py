import re
import os
import sys

SRC = r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\sat_bible_djvu.txt"
HIN_TSV = os.path.join(os.path.dirname(__file__), "..", "corpus", "hin_irv.tsv")
OUT = os.path.join(os.path.dirname(__file__), "..", "corpus", "sat_ot_v1.tsv")

CYR_TO_LAT = {
    ord("а"): "a", ord("б"): "b", ord("в"): "b", ord("г"): "r", ord("д"): "d",
    ord("е"): "e", ord("ё"): "e", ord("ж"): "z", ord("з"): "s", ord("и"): "i",
    ord("й"): "i", ord("к"): "k", ord("л"): "l", ord("м"): "m", ord("н"): "n",
    ord("о"): "o", ord("п"): "n", ord("р"): "p", ord("с"): "c", ord("т"): "t",
    ord("у"): "y", ord("ф"): "p", ord("х"): "x", ord("ц"): "c", ord("ч"): "c",
    ord("ш"): "Sh", ord("щ"): "Sh", ord("ъ"): "", ord("ы"): "i", ord("ь"): "",
    ord("э"): "e", ord("ю"): "Yu", ord("я"): "Ya",
    ord("А"): "A", ord("Б"): "B", ord("В"): "B", ord("Г"): "R", ord("Д"): "D",
    ord("Е"): "E", ord("Ж"): "Z", ord("З"): "S", ord("И"): "I", ord("Й"): "I",
    ord("К"): "K", ord("Л"): "L", ord("М"): "M", ord("Н"): "N", ord("О"): "O",
    ord("П"): "N", ord("Р"): "P", ord("С"): "C", ord("Т"): "T", ord("У"): "Y",
    ord("Ф"): "P", ord("Х"): "X", ord("Ц"): "C", ord("Ч"): "C", ord("Ш"): "Sh",
    ord("Щ"): "Sh", ord("Ъ"): "", ord("Ы"): "I", ord("Ь"): "", ord("Э"): "E",
    ord("Ю"): "Yu", ord("Я"): "Ya",
    ord("ѕ"): "s", ord("і"): "i", ord("ј"): "j", ord("һ"): "h", ord("Ү"): "y",
    ord("Ѕ"): "S", ord("І"): "I", ord("Ј"): "J", ord("ӕ"): "a", ord("Ғ"): "N",
    ord("ә"): "a", ord("ӯ"): "u", ord("қ"): "k", ord("ӄ"): "k", ord("ғ"): "g",
    ord("ӈ"): "n", ord("Ӆ"): "L", ord("҆"): "",
}

# (standard abbrev, [OCR name stems in order of specificity])
OT_BOOKS = [
    ("GEN", ["GEÑESIS", "GENESIS"]),
    ("EXO", ["EXODUS", "EXӨӨCЄ"]),
    ("LEV", ["LEVITIKUS", "TEMITIK", "LEVIT"]),
    ("NUM", ["NUMERI", "NUMERE"]),
    ("DEU", ["DEUTERONOMIUM", "DEUTERON"]),
    ("JOS", ["JOSUA"]),
    ("JDG", ["BIK CARKO"]),
    ("RUT", ["RUTH"]),
    ("1SA", ["PAHIL SAMUEL", "PAN. SAMUEL", "PAHI. SAMUEL"]),
    ("2SA", ["DOSAR SAMUEL", "DOSAR.SAMUEL"]),
    ("1KI", ["PAHIL BIBORON"]),
    ("2KI", ["DOSAR BIBORON"]),
    ("1CH", ["PAHIL ITIHAS", "PAKIL ITIHAS"]),
    ("2CH", ["DOSAR ITIHAS", "DOSAR.ITIHAS"]),
    ("EZR", ["ESRA", "RAPAJKO REAK", "RAPAJKO KEAK", "RAPAJKO BEAK"]),
    ("NEH", ["NEHEMIA"]),
    ("EST", ["ESTER", "ESTHER"]),
    ("JOB", ["JOB"]),
    ("PSA", ["SALEMA", "SALEMKO", "SEBEMKO", "SANAMKO"]),
    ("PRO", ["DAOAK", "HITKO DARE", "HITKO DAE"]),
    ("ECC", ["PRECHAK"]),
    ("SNG", ["MOKOKA", "MAKOKA"]),
    ("ISA", ["ISAIAS", "ISAIA", "ISAYAS"]),
    ("JER", ["JEREMIAS", "JEREMIA", "JEREMI"]),
    ("LAM", ["LAMENTACION", "LAMINTACION"]),
    ("EZK", ["EZEKIEL", "EZEKIEL"]),
    ("DAN", ["DANIEL", "DANIEL"]),
    ("HOS", ["HOSEA", "OŠEA", "OSEA"]),
    ("JOL", ["JOEL", "JOEEL"]),
    ("AMO", ["AMOS"]),
    ("OBA", ["OBADIA"]),
    ("JON", ["JONA", "JONAS"]),
    ("MIC", ["MICHA", "MIKA"]),
    ("NAM", ["NAHUM", "NAHOM"]),
    ("HAB", ["HABAKUK", "HABAKKUK"]),
    ("ZEP", ["SEFANIA", "ZEPHANIA"]),
    ("HAG", ["HAGGAI", "HAGAI"]),
    ("ZEC", ["SEKARIA", "ZECHARIA"]),
    ("MAL", ["MALACHI", "MALAKI"]),
]

NT_BOOKS = [
    ("MAT", ["MATHAEYE", "MATNAEYE", "MATNEY"]),
    ("MRK", ["MARKE", "MAPKE"]),
    ("LUK", ["LUKO"]),
    ("JHN", ["JONAME", "JONI", "JOHANE", "JOHAN"]),
    ("ACT", ["PRAKITIO", "APOSTOLKOAK", "APOSTOLAK", "APOSTLOK"]),
    ("ROM", ["ROMIKO", "ROMANIKO", "ROMAN"]),
    ("1CO", ["KORINTHIKO LAGIT PAUL APOSTOLAK PAHIL", "KORINTHIKO LAGIT PAUL APOSTOLAK' PAHIL", "KORINTHIKO LAGIT PAUL APOSTOLAK' DOSAR"]),
    ("2CO", ["KORINTHIKO LAGIT PAUL DOSAR", "KORINTHIKO LAGIT PAUL APOSTOLAK DOSAR"]),
    ("GAL", ["GALATIKO", "GALATI"]),
    ("EPH", ["EPHESIKO", "EPHESI"]),
    ("PHP", ["PHILIPPIKO", "PHILIPPI", "FILIPI"]),
    ("COL", ["KOLOSIKO", "COLOSSI"]),
    ("1TH", ["THESSALONIKIKO"]),
    ("2TH", ["THESSALONIKIKO DOSAR"]),
    ("1TI", ["TIMOTIKO"]),
    ("2TI", ["TIMOTIKO DOSAR"]),
    ("TIT", ["TITIKO", "TITI"]),
    ("PHM", ["PHILEMONIKO", "PHILEMON"]),
    ("HEB", ["HEREWAREN", "HEBREW", "IBRIKO"]),
    ("JAS", ["JASUKO", "JAMES", "JASU"]),
    ("1PE", ["PIETAREN", "PIETA PETER", "PETER"]),
    ("2PE", ["PIETAREN DOSAR", "PETER DOSAR"]),
    ("1JN", ["JOHAN THEN PAHIL", "JOHANAK PAHIL"]),
    ("2JN", ["JOHAN THEN DOSAR", "JOHANAK DOSAR"]),
    ("3JN", ["JOHAN THEN TINA", "JOHANAK TINA"]),
    ("JUD", ["JUDA", "JUDAS"]),
    ("REV", ["SODORAK"]),
]

ALL_BOOKS = OT_BOOKS + NT_BOOKS


def norm(t):
    return t.translate(CYR_TO_LAT)


def detect_book(phrase):
    up = phrase.upper()
    for ab, stems in ALL_BOOKS:
        for st in stems:
            if st in up:
                return ab
    return None


def load_hindi():
    maxv = {}
    hin = {}
    with open(HIN_TSV, encoding="utf-8") as f:
        for line in f:
            b, c, v, t = line.rstrip("\n").split("\t", 3)
            b, c, v = b, int(c), int(v)
            maxv[(b, c)] = max(maxv.get((b, c), 0), v)
            hin[(b, c, v)] = t
    return hin, maxv


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    hin, maxv = load_hindi()
    text = norm(open(SRC, encoding="utf-8", errors="replace").read())
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if "=" not in l]

    header_re = re.compile(r"^([A-Za-z][^0-9]{2,55}?)\s+(\d{1,2})\s+(\d{2,3})\s*$")
    vs_re = re.compile(r"^(\d{1,3})\s+([A-Z].*)$")
    fused_re = re.compile(r"(?<![0-9A-Za-z])(\d{1,3})(?=[A-Z])")

    events = []
    for l in lines:
        if not l:
            continue
        m = header_re.match(l)
        if m:
            phrase = m.group(1).strip()
            sc = sum(c.isupper() for c in l)
            b = detect_book(phrase)
            if b is not None:
                events.append(("H", b, int(m.group(2)), None))
                continue
            if (sc >= 5 or "LEKA" in l or "SODORAK" in l or "LAGIT" in l) and len(phrase) > 5:
                events.append(("X", phrase, int(m.group(2)), None))
                continue
        if len(l) < 40 and detect_book(l) is not None and sum(c.isupper() for c in l) >= 3:
            events.append(("H", detect_book(l), 0, None))
            continue
        m = vs_re.match(l)
        if m:
            events.append(("V", None, int(m.group(1)), m.group(2).strip()))
            continue
        hits = list(fused_re.finditer(l))
        if hits:
            prev = 0
            for k, h in enumerate(hits):
                seg_end = hits[k + 1].start() if k + 1 < len(hits) else len(l)
                lead = l[prev:h.start()]
                if lead.strip():
                    events.append(("T", None, None, lead))
                # require at least 2 words of content to trust the marker
                seg = l[h.end():seg_end].strip()
                if len(seg.split()) >= 2:
                    events.append(("V", None, int(h.group(1)), seg))
                else:
                    events.append(("T", None, None, h.group(1) + seg))
                prev = h.end()
        else:
            events.append(("T", None, None, l))

    # reconstruct using Hindi canonical max-verse per chapter
    # events now use ("H", book_abbrev, chapter) | ("H", None, chapter) | ("V",None,v,text) | ("T",None,None,text)
    book_order = [ab for ab, _ in ALL_BOOKS]
    result = {}
    bi = None
    chapter = 1
    prev_v = None
    buf = None
    last_h_ch = None
    pending_v1 = False
    for ekind, phrase, v, text in events:
        if ekind == "H":
            if phrase is not None:
                b = phrase
                idx = book_order.index(b)
                if bi is None or idx > bi:
                    bi = idx
            new_ch = min(v, 150) if v > 0 else 1
            was_new_ch = (new_ch != last_h_ch) or (bi is not None and ekind == "H" and phrase is not None and last_h_ch is None)
            if v > 0:
                chapter = new_ch
            elif phrase is not None:
                chapter = 1
            last_h_ch = chapter
            prev_v = None
            buf = None
            # leading unnumbered lines after a NEW chapter header are verse 1
            pending_v1 = was_new_ch
            continue
        if ekind == "V":
            if bi is None:
                continue
            book = book_order[bi]
            if buf is not None and prev_v is not None:
                result.setdefault((book, chapter), {})[prev_v] = " ".join(buf)
                buf = None
            pending_v1 = False
            mx = maxv.get((book, chapter))
            if mx is not None and (prev_v is not None and (v <= prev_v or (v > mx and v <= prev_v + 3))):
                chapter += 1
                # skip empty chapters if next chapter exceeds bounds
                while chapter in range(1, 200) and (book, chapter) not in maxv and chapter < 200:
                    chapter += 1
            elif mx is not None and v > mx + 2:
                # outlier OCR number; treat as continuation
                pass
            prev_v = v
            buf = [text] if text.strip() else []
            continue
        if ekind == "T" and buf is not None:
            buf.append(text)
        elif ekind == "T" and pending_v1:
            buf = [text]
            prev_v = 1
            pending_v1 = False
    if buf is not None and prev_v is not None and bi is not None:
        book = book_order[bi]
        result.setdefault((book, chapter), {})[prev_v] = " ".join(buf)

    clean = {}
    for (book, ch), vmap in result.items():
        c = {}
        for v, t in vmap.items():
            t = re.sub(r"\s+", " ", t).strip()
            if (book, ch, v) in hin and len(t) >= 12 and len(t.split()) >= 2:
                c[v] = t
        if c:
            clean[(book, ch)] = c

    totals = {}
    for (book, ch), vmap in clean.items():
        totals[book] = totals.get(book, 0) + len(vmap)
    print("== OT+full-bible recovery, pairs validated against Hindi (book,ch,v) ==")
    grand = 0
    for ab, _ in ALL_BOOKS:
        if totals.get(ab, 0) > 0:
            grand += totals[ab]
            print(f"  {ab}: {totals[ab]}")
    print("TOTAL valid sat verses (from full Bible):", grand)

    out_lines = []
    for (book, ch), vmap in sorted(clean.items()):
        for v in sorted(vmap):
            out_lines.append(f"{book}\t{ch}\t{v}\t{hin[(book, ch, v)]}\t{vmap[v]}")
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(out_lines))
    print("wrote", OUT, "lines:", len(out_lines))


if __name__ == "__main__":
    main()