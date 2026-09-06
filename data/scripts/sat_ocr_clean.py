import re
import os

SRC_NT = r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\sat_nt_djvu.txt"
SRC_BIBLE = r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\sat_bible_djvu.txt"
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


def parse_events(lines):
    header_re = re.compile(r"^([A-Za-z][^0-9]{2,55}?)\s+(\d{1,2})\s+(\d{2,3})\s*$")
    verse_re = re.compile(r"(?<![\dA-Za-z])(\d{1,3})\s*(?=[A-Z])")
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
        hits = list(verse_re.finditer(l))
        if hits:
            prev_end = 0
            for idx, hit in enumerate(hits):
                v = int(hit.group(1))
                nxt = hits[idx + 1].start() if idx + 1 < len(hits) else len(l)
                seg = l[hit.end():nxt].strip()
                if hit.start() > 0:
                    lead = l[prev_end:hit.start()].strip()
                    events.append(("T", None, None, None, lead))
                events.append(("V", None, v, None, seg))
                prev_end = nxt
        else:
            events.append(("T", None, None, None, l))
    return events


def reconstruct(events):
    result = {}
    bi = 0
    book = BOOK_ORDER[0]
    chapter = 1
    prev_v = None
    buf = None
    header_seen = False
    for ekind, phrase, v, page_no, text in events:
        if ekind == "H":
            b = detect_book(phrase)
            if b is not None:
                idx = BOOK_ORDER.index(b)
                if idx >= bi:
                    bi = idx
                    book = b
            chapter = min(v, CANON_CH[book])
            prev_v = None
            buf = None
            header_seen = True
            continue
        if ekind == "V":
            if buf is not None and prev_v is not None:
                result.setdefault((book, chapter), {})[prev_v] = " ".join(buf)
                buf = None
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
    if buf is not None and prev_v is not None:
        result.setdefault((book, chapter), {})[prev_v] = " ".join(buf)
    return result


def extract(src_path):
    raw = open(src_path, encoding="utf-8", errors="replace").read()
    text = norm_line(raw)
    lines = [l.strip() for l in text.splitlines()]
    lines = [l for l in lines if "=" not in l]
    events = parse_events(lines)
    result = reconstruct(events)
    clean = {}
    for (book, ch), vmap in result.items():
        c = {}
        for v, t in vmap.items():
            t = re.sub(r"\s+", " ", t).strip()
            if len(t.split()) >= 2:
                c[v] = t
        if c:
            clean[(book, ch)] = c
    return clean


def main():
    merged = extract(SRC_NT)
    grand = 0
    for book in BOOK_ORDER:
        chapters = {ch: vmap for (b, ch), vmap in merged.items() if b == book}
        total = sum(len(v) for v in chapters.values())
        grand += total
        chs = sorted(chapters)
        print(f"{book}: chs={len(chapters)} verses={total} chapters={chs}")
    print("TOTAL recovered verses:", grand)

    print()
    for ref in [("MAT", 5), ("JHN", 3), ("ACT", 2), ("REV", 21)]:
        vmap = merged.get(ref, {})
        print(ref, "sample verses:")
        for v in sorted(vmap)[:3]:
            print("  v", v, ":", vmap[v][:150])


if __name__ == "__main__":
    main()