import re
import os

SRC_NT = r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\sat_nt_djvu.txt"
SRC_BIBLE = r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\sat_bible_djvu.txt"
HIN_TSV = os.path.join(os.path.dirname(__file__), "..", "corpus", "hin_irv.tsv")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "corpus")

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

BOOK_ORDER = [
    "MAT", "MRK", "LUK", "JHN", "ACT", "ROM", "1CO", "2CO", "GAL", "EPH",
    "PHP", "COL", "1TH", "2TH", "1TI", "2TI", "TIT", "PHM", "HEB", "JAS",
    "1PE", "2PE", "1JN", "2JN", "3JN", "JUD", "REV",
]
CANON_CH = {
    "MAT": 28, "MRK": 16, "LUK": 24, "JHN": 21, "ACT": 28, "ROM": 16,
    "1CO": 16, "2CO": 13, "GAL": 6, "EPH": 6, "PHP": 4, "COL": 4,
    "1TH": 5, "2TH": 3, "1TI": 6, "2TI": 4, "TIT": 3, "PHM": 1,
    "HEB": 13, "JAS": 5, "1PE": 5, "2PE": 3, "1JN": 5, "2JN": 1,
    "3JN": 1, "JUD": 1, "REV": 22,
}

HEADER_KEYWORDS = [
    ("SODORAK", "REV"),
    ("PRAKITIO", "ACT"), ("APOSTOLKOAK", "ACT"), ("APOSTOLAK", "ACT"),
    ("MATHAEYE", "MAT"), ("MATNAEYE", "MAT"), ("MATNEY", "MAT"),
    ("MARKE", "MRK"), ("MAPKE", "MRK"),
    ("LUKO", "LUK"),
    ("JONAME", "JHN"), ("JONI", "JHN"),
    ("ROMIKO", "ROM"), ("ROMAN", "ROM"), ("ROMANIKO", "ROM"),
    ("KORINTHIKO", "1CO"), ("KORINTHI", "1CO"),
    ("PHILIPPIKO", "PHP"), ("PHILIPPI", "PHP"), ("FILIPI", "PHP"),
    ("GALATIKO", "GAL"),
    ("EPHESIKO", "EPH"), ("EPHESI", "EPH"),
    ("KOLOSIKO", "COL"), ("COLOSSI", "COL"),
    ("THESSALONIKIKO", "1TH"), ("THESSALONIKI", "1TH"),
    ("TIMOTIKO", "1TI"), ("TIMOTI", "1TI"),
    ("TITIKO", "TIT"),
    ("PHILEMONIKO", "PHM"), ("PHILEMON", "PHM"),
    ("HEREWAREN", "HEB"), ("HEBREW", "HEB"),
    ("JASUKO", "JAS"), ("JAMES", "JAS"), ("JASU", "JAS"),
    ("PIETAREN", "1PE"), ("PIETA", "1PE"), ("PETER", "1PE"),
]


def norm_line(t):
    return t.translate(CYR_TO_LAT)


def detect_book(phrase):
    up = phrase.upper()
    for kw, book in HEADER_KEYWORDS:
        if kw in up:
            return book
    return None


def extract(src_path):
    raw = open(src_path, encoding="utf-8", errors="replace").read()
    text = norm_line(raw)
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if "=" not in l]

    header_re = re.compile(r"^([A-Za-z][^0-9]{2,55}?)\s+(\d{1,2})\s+(\d{2,3})\s*$")
    # line-start verse:  ^12 Text...
    vs_re = re.compile(r"^(\d{1,3})\s+([A-Z].*)$")
    # inline safe marker: space + digit + space + Capital
    mid_re = re.compile(r"(?<=\s)(\d{1,3})(?=\s+[A-Z][a-z])")

    events = []
    for l in lines:
        if not l:
            continue
        m = header_re.match(l)
        if m:
            phrase = m.group(1).strip()
            sc = sum(c.isupper() for c in l)
            if (sc >= 5 or "LEKA" in l or "SODORAK" in l or "LAGIT" in l) and len(phrase) > 5:
                events.append(("H", phrase, int(m.group(2)), int(m.group(3)), None))
                continue
        m = vs_re.match(l)
        if m:
            events.append(("V", None, int(m.group(1)), None, m.group(2).strip()))
            continue
        # midline markers -> split
        hits = list(mid_re.finditer(l))
        if hits:
            prev_end = 0
            for idx, h in enumerate(hits):
                seg_end = hits[idx + 1].start() if idx + 1 < len(hits) else len(l)
                lead = l[prev_end:h.start()]
                events.append(("T", None, None, None, lead))
                events.append(("V", None, int(h.group(1)), None, l[h.end():seg_end].strip()))
                prev_end = h.end()
        else:
            events.append(("T", None, None, None, l))

    # reconstruct chapters/books via canonical continuity
    result = {}
    bi = 0
    book = BOOK_ORDER[0]
    chapter = 1
    prev_v = None
    buf = None
    pending_v1 = False
    for ekind, phrase, v, _page, text in events:
        if ekind == "H":
            b = detect_book(phrase)
            if b is not None:
                idx = BOOK_ORDER.index(b)
                if idx >= bi:
                    bi = idx
                    book = b
            new_ch = min(v, CANON_CH[book]) if v > 0 else 1
            was_new_ch = (new_ch != chapter)
            chapter = new_ch
            prev_v = None
            buf = None
            pending_v1 = was_new_ch
            continue
        if ekind == "V":
            if buf is not None and prev_v is not None:
                result.setdefault((book, chapter), {})[prev_v] = " ".join(buf)
                buf = None
            pending_v1 = False
            if prev_v is not None and v <= prev_v:
                if chapter < CANON_CH[book]:
                    chapter += 1
                else:
                    bi += 1
                    if bi >= len(BOOK_ORDER):
                        break
                    book = BOOK_ORDER[bi]
                    chapter = 1
            prev_v = v
            buf = [text] if text.strip() else []
            continue
        if ekind == "T" and buf is not None:
            buf.append(text)
        elif ekind == "T" and pending_v1:
            buf = [text]
            prev_v = 1
            pending_v1 = False
    if buf is not None and prev_v is not None:
        result.setdefault((book, chapter), {})[prev_v] = " ".join(buf)

    clean = {}
    for (book, ch), vmap in result.items():
        c = {}
        for v, t in vmap.items():
            t = re.sub(r"\s+", " ", t).strip()
            # keep only clearly-start-anchored verses: decent length & >=2 words
            if len(t) >= 12 and len(t.split()) >= 2:
                c[v] = t
        if c:
            clean[(book, ch)] = c
    return clean


def main():
    nt = extract(SRC_NT)
    bib = extract(SRC_BIBLE)

    # merge: prefer NT text for NT verses; add Bible-only verses
    combined = {}
    all_keys = set(nt) | set(bib)
    for k in all_keys:
        combined[k] = nt.get(k) or bib.get(k)

    book_prefix = {"1CO": "1 Corinthians", "2CO": "2 Corinthians"}

    def book_label(b):
        return {"1CO": "1CO", "2CO": "2CO"}.get(b, b)

    # stats
    print("== Santali verse recovery (NT source) ==")
    total_nt = sum(len(v) for v in nt.values())
    print("NT source verses:", total_nt)
    print("== combined ==")
    total_all = 0
    for book in BOOK_ORDER:
        chs = {ch: v for (b, ch), v in combined.items() if b == book}
        verses = sum(len(v) for v in chs.values())
        total_all += verses
        print(f"{book}: {verses}")
    print("TOTAL combined:", total_all)

    # alignment with Hindi
    hin = {}
    with open(HIN_TSV, encoding="utf-8") as f:
        for line in f:
            b, c, v, t = line.rstrip("\n").split("\t", 3)
            hin[(b, int(c), int(v))] = t

    pairs = []
    for (book, ch), vmap in combined.items():
        for v, sat in vmap.items():
            key = (book, ch, v)
            if key in hin:
                pairs.append((book, ch, v, hin[key], sat))

    print("== ALIGNED hi-sat pairs ==")
    print("total aligned verse pairs:", len(pairs))

    book_counts = {}
    for b, ch, v, h, s in pairs:
        book_counts[b] = book_counts.get(b, 0) + 1
    for b in sorted(book_counts):
        print(f"  {b}: {book_counts[b]}")

    # write TSV
    out_path = os.path.join(OUT_DIR, "sat_ovedhi_v1.tsv")
    with open(out_path, "w", encoding="utf-8") as f:
        for b, ch, v, h, s in pairs:
            f.write(f"{b}\t{ch}\t{v}\t{h}\t{s}\n")
    print("wrote", out_path)


if __name__ == "__main__":
    main()