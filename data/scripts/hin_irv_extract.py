import os
import re
import sys

ZIP_DIR = r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\hin2017"
OUT = os.path.join(os.path.dirname(__file__), "..", "corpus")


def parse_usfm(text):
    book = None
    chapter = None
    verse = None
    buf = []
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"\\(id|h|toc)\d*\s+(\S+)", line)
        if m and m.group(1) == "id":
            book = m.group(2)
            continue
        m = re.match(r"\\c\s+(\d+)", line)
        if m:
            chapter = m.group(1)
            continue
        m = re.match(r"\\v\s+(\d+)\s*(.*)", line)
        if m:
            if book and chapter and verse is not None:
                yield (book, chapter, verse, " ".join(buf).strip())
            verse = m.group(1)
            buf = [m.group(2)]
            continue
        text_markers = re.match(r"\\(\w+)", line)
        if text_markers:
            continue
        if verse is not None:
            buf.append(line)
    if book and chapter and verse is not None:
        yield (book, chapter, verse, " ".join(buf).strip())


def main():
    counts = {}
    rows = []
    for fn in os.listdir(ZIP_DIR):
        if not fn.endswith(".usfm"):
            continue
        path = os.path.join(ZIP_DIR, fn)
        with open(path, encoding="utf-8", errors="replace") as f:
            for book, ch, v, txt in parse_usfm(f.read()):
                if not txt or len(txt) < 3:
                    continue
                rows.append((book, int(ch), int(v), txt))
    rows.sort(key=lambda r: (r[0], r[1], r[2]))
    for row in rows:
        counts[row[0]] = counts.get(row[0], 0) + 1
    os.makedirs(OUT, exist_ok=True)
    out_path = os.path.join(OUT, "hin_irv.tsv")
    with open(out_path, "w", encoding="utf-8") as f:
        for b, c, v, t in rows:
            f.write(f"{b}\t{c}\t{v}\t{t}\n")
    print(f"total verses: {len(rows)}")
    print(f"books: {len(counts)}")
    for b, n in sorted(counts.items()):
        print(f"  {b}: {n}")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()