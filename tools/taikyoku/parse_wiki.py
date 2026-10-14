import re, json
W = open("taikyoku_en.wiki", encoding="utf-8").read()
lines = W.split("\n")

def clean(t):
    t = re.sub(r"\{\{efn[^{}]*(\{\{[^{}]*\}\}[^{}]*)*\}\}", "", t)
    t = re.sub(r"<ref[^>]*/>", "", t); t = re.sub(r"<ref[^>]*>.*?</ref>", "", t)
    t = re.sub(r"\[\[([^|\]]*\|)?([^\]]*)\]\]", r"\2", t)
    t = re.sub(r"\{\{nihongo\|([^|}]*)\|[^}]*\}\}", r"\1", t)
    t = re.sub(r"\{\{[^}]*\}\}", "", t)
    return t.replace("''", "").strip()

# ---- 1. promotion table (Game equipment section) ----
eq = "\n".join(lines[13:470])
rows = []
for chunk in eq.split("\n|-"):
    c = chunk.strip()
    if not c.startswith("|") or c.startswith("|}"): continue
    cells = [clean(x) for x in c.lstrip("|").split("||")]
    if len(cells) >= 4:
        rows.append(cells)
table = []
for r in rows:
    name, kanji = r[0], r[1]
    promo = r[3] if len(r) > 3 else ""
    promo_k = r[4] if len(r) > 4 else ""
    if name.lower() in ("piece",): continue
    star = promo.startswith("*")
    table.append({"en": name, "kanji": kanji, "promoEn": promo.lstrip("*").strip() if promo not in ("—", "-", "") else None,
                  "promoKanji": promo_k or None, "promoOnly": star})
print("table rows:", len(table))
json.dump(table, open("promotions.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)

# ---- 2. individual piece entries ----
start = next(i for i,l in enumerate(lines) if l.startswith("===Individual pieces==="))
end = next(i for i,l in enumerate(lines) if l.startswith("== See also"))
entries = []
cur = None
for i in range(start, end):
    l = lines[i]
    m = re.match(r"^'''(.+?)'''\s*$", l.strip())
    if m and "(" in m.group(1):
        cur = {"header": clean(m.group(1)), "line": i+1, "bullets": [], "notation": None}
        entries.append(cur); continue
    if cur is None: continue
    if l.startswith("*"):
        b = clean(l.lstrip("*").strip())
        cur["bullets"].append(b)
        mm = re.match(r"^(?:Betza['’]s funny notation\|)?(?:Betza Notation|Notation)\s*:\s*(.*)$", b)
        if mm and cur["notation"] is None: cur["notation"] = mm.group(1).strip()
for e in entries:
    e["names"] = [{"en": a.strip(" ,").removeprefix("and ").strip(), "kanji": k.strip()} for a,k in re.findall(r"([^,()]+?)\s*\(([^)]*)\)", e["header"])]
print("entries:", len(entries), "with notation:", sum(1 for e in entries if e["notation"]))
json.dump(entries, open("entries.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
for e in entries:
    if not e["notation"]: print("NO NOTATION:", e["header"], "|", e["bullets"][:2])
