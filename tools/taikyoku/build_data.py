"""Build shared/src/taikyoku/pieces.data.ts from the compiled Wikipedia data.

Pipeline (run from this directory):
  curl -s "https://en.wikipedia.org/w/index.php?oldid=1378938316&action=raw" > taikyoku_en.wiki   # 固定版本,2026-10-07
  python3 parse_wiki.py      # -> promotions.json, entries.json
  python3 compile_betza.py   # -> compiled.json (+ cross-check against the diagrams)
  python3 build_data.py      # -> ../shared/src/taikyoku/pieces.data.ts
"""
import json, re, os, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "..", "shared", "src", "taikyoku", "pieces.data.ts")
C = json.load(open("compiled.json", encoding="utf-8"))
T = json.load(open("promotions.json", encoding="utf-8"))

k2entry, en2k = {}, {}
for e in C:
    for n in e["names"]:
        for k in re.split(r"\s*/\s*", n["kanji"]):
            k2entry[k.strip()] = e
        en2k[n["en"].lower()] = n["kanji"].split("/")[0].strip()

def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")

# range-capturing hierarchy (1 = highest). Everything else is rank 5.
RANK = {"王将": 1, "太子": 1, "大将": 2, "副将": 3, "飛将": 4, "角将": 4, "猛龍": 4, "飛鰐": 4}
# promotions whose kanji are not encodable in Unicode (shown on Wikipedia as images)
NOT_ENCODABLE_PROMO = {"Huai chicken", "Old rat"}

kinds = {}
def add(en, kanji):
    kanji = kanji.split("/")[0].strip()
    e = k2entry.get(kanji)
    if e is None:
        return None
    pid = slug(en)
    if pid in kinds:
        assert kinds[pid]["kanji"] == kanji, (pid, kanji)
        return pid
    kinds[pid] = {"id": pid, "kanji": kanji, "en": en[0].upper() + en[1:], "rules": e["rules"],
                  "rank": RANK.get(kanji, 5), "notation": e["notation"], "fix": e.get("fix")}
    return pid

for t in T:
    pid = add(t["en"], t["kanji"])
    kinds[pid]["base"] = True
    promo = None
    if t["promoEn"]:
        pk = t["promoKanji"] or ""
        if pk not in k2entry:
            pk = en2k.get(t["promoEn"].lower(), "")
        promo = add(t["promoEn"], pk) if pk else None
    kinds[pid]["promotesTo"] = promo
    kinds[pid]["inPool"] = t["en"] not in ("King", "Crown prince") and t["en"] not in NOT_ENCODABLE_PROMO
for k in kinds.values():
    k.setdefault("base", False); k.setdefault("promotesTo", None); k.setdefault("inPool", False)

def compact(r):
    r = dict(r)
    if r.get("mode") == "mc": r.pop("mode")
    if r.get("jmode") == "mc": r.pop("jmode")
    return r

rows = []
for k in sorted(kinds.values(), key=lambda k: k["id"]):
    row = {"id": k["id"], "kanji": k["kanji"], "en": k["en"], "rank": k["rank"], "base": k["base"],
           "inPool": k["inPool"], "promotesTo": k["promotesTo"], "betza": k["notation"],
           "rules": [compact(r) for r in k["rules"]]}
    rows.append(row)
body = json.dumps(rows, ensure_ascii=False, separators=(",", ":"))
src = f'''// 自动生成:tools/taikyoku/build_data.py → 请勿手改
// 数据来源:https://en.wikipedia.org/wiki/Taikyoku_shogi (CC BY-SA 4.0)
// 每种棋子的走法由词条中的 Betza 记法编译,并与同页走法图逐一核对(见 docs/TAIKYOKU_DATA.md)。
import type {{ KindDef }} from "./types";

export const KINDS: KindDef[] = {body};
'''
open(OUT, "w", encoding="utf-8").write(src)
print("kinds:", len(rows), "base:", sum(r["base"] for r in rows), "pool:", sum(r["inPool"] for r in rows), "->", OUT)
