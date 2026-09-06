import sys, os, unicodedata, random

BASE = os.path.dirname(__file__)
OUT = os.path.join(BASE, "..", "corpus")
SRC = {
    "nllb": r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\opus_hi_sat\nllb",
    "wikimedia": r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\opus_hi_sat\wikimedia",
    "tatoeba": r"C:\Users\bhuwa\AppData\Local\Temp\opencode\adb\opus_hi_sat\tatoeba",
}

SCORE_MIN = 1.040

def has_ol_chiki(t):
    return any(0x1C50 <= ord(c) <= 0x1C7F for c in t)

def has_devanagari(t):
    return any(0x0900 <= ord(c) <= 0x097F for c in t)

def has_ascii_alpha(t):
    return any(c.isascii() and c.isalpha() for c in t)

def is_clean_olchiki(t):
    # only Ol Chiki letters/digits + common punct (comma, full stop, danda, etc.)
    allowed_extra = set(",.।॥;:!?()[]'\"-–— \t")
    for c in t:
        o = ord(c)
        if 0x1C50 <= o <= 0x1C7F:
            continue
        if c in allowed_extra or c.isspace():
            continue
        return False
    return True

def norm(s):
    s = unicodedata.normalize("NFKC", s or "")
    return " ".join(s.split()).strip()

def valid_pair(hi, sat):
    hi = norm(hi); sat = norm(sat)
    if len(hi) < 3 or len(sat) < 3:
        return None, None
    if len(hi) > 500 or len(sat) > 500:
        return None, None
    if hi == sat:
        return None, None
    if not has_devanagari(hi):
        return None, None
    if not has_ol_chiki(sat) or not is_clean_olchiki(sat):
        return None, None
    if has_ascii_alpha(hi):
        return None, None
    r = len(sat) / len(hi)
    if r < 0.25 or r > 4.0:
        return None, None
    return hi, sat

def load_pairs(name):
    d = SRC[name]
    hi_f = [f for f in os.listdir(d) if f.endswith(".hi")][0]
    sat_f = [f for f in os.listdir(d) if f.endswith(".sat")][0]
    hi = open(os.path.join(d, hi_f), encoding="utf-8").read().split("\n")
    sat = open(os.path.join(d, sat_f), encoding="utf-8").read().split("\n")
    scores = None
    if name == "nllb":
        sf = [f for f in os.listdir(d) if f.endswith(".scores")][0]
        sv = [x for x in open(os.path.join(d, sf), encoding="utf-8").read().split("\n") if x.strip()]
        scores = {}
        for i, x in enumerate(sv):
            scores[i] = float(x)
    rows = []
    for i, (h, s) in enumerate(zip(hi, sat)):
        sc = scores.get(i) if scores else None
        rows.append((h, s, sc))
    return rows

def main():
    sys.stdout.reconfigure(encoding="utf-8")
    os.makedirs(OUT, exist_ok=True)

    cleaned = {k: [] for k in SRC}
    for name in SRC:
        raw = load_pairs(name)
        seen_pair = set()
        seen_sat = {}
        for h, s, sc in raw:
            if name == "nllb" and (sc is None or sc < SCORE_MIN):
                continue
            hi, sat = valid_pair(h, s)
            if hi is None:
                continue
            pk = (hi, sat)
            if pk in seen_pair:
                continue
            seen_pair.add(pk)
            key_sat = sat.replace(" ", "")
            if name == "nllb":
                if key_sat in seen_sat:
                    if sc > seen_sat[key_sat][0]:
                        seen_sat[key_sat] = (sc, hi, sat)
                    continue
                seen_sat[key_sat] = (sc, hi, sat)
            else:
                if key_sat in seen_sat:
                    continue
                seen_sat[key_sat] = (None, hi, sat)
        if name == "nllb":
            for sc, hi, sat in seen_sat.values():
                cleaned[name].append((hi, sat))
        else:
            for _, hi, sat in seen_sat.values():
                cleaned[name].append((hi, sat))

    for name in SRC:
        print(f"{name}: {len(cleaned[name])} clean unique pairs")

    # combine + tag
    all_rows = []
    for name in ["nllb", "wikimedia", "tatoeba"]:
        for hi, sat in cleaned[name]:
            all_rows.append((name, hi, sat))

    random.seed(42)
    random.shuffle(all_rows)

    # tatoeba -> closed human test (no training pollution)
    closed = [r for r in all_rows if r[0] == "tatoeba"]
    rest = [r for r in all_rows if r[0] != "tatoeba"]

    n = len(rest)
    n_test = int(n * 0.1)
    n_dev = int(n * 0.1)
    test = rest[:n_test]
    dev = rest[n_test:n_test + n_dev]
    train = rest[n_test + n_dev:]

    def write(path, rows):
        with open(path, "w", encoding="utf-8") as f:
            for src, hi, sat in rows:
                f.write(f"{src}\t{hi}\t{sat}\n")

    write(os.path.join(OUT, "hi_sat_all.tsv"), all_rows)
    write(os.path.join(OUT, "train.tsv"), train)
    write(os.path.join(OUT, "dev.tsv"), dev)
    write(os.path.join(OUT, "test.tsv"), test)
    write(os.path.join(OUT, "closed_human_test.tsv"), closed)

    print("TOTAL cleaned:", len(all_rows))
    print("closed (tatoeba):", len(closed))
    print("train/dev/test:", len(train), len(dev), len(test))
    # sample QA
    print("\nsample train rows:")
    for src, hi, sat in train[:4]:
        print(f"  [{src}] {hi[:60]}\n          -> {sat[:60]}")


if __name__ == "__main__":
    main()