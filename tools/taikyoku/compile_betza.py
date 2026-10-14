"""Compile Wikipedia's (extended) Betza notation for Taikyoku shogi pieces into a
small, explicit rule list, and cross-check every piece against the movement
diagram printed next to it on the same page.

Rule kinds (vectors are relative; +y = forward for the moving side):
  slide     {d, max (None = unlimited), mode, hops}   max=1 is a plain step
  leap      {d, mode}
  jumpslide {d (unit), jump k, max (extra squares after landing, None = unlimited), jmode}
            land at distance k ignoring squares in between, optionally continue
  hook      {d (unit, first leg), turn: [unit,...]}   change tack 90 degrees once
  lion      {}  two king steps in one turn (igui / double capture)
  rangecap  {d (unit)}  fly over lower-ranked pieces capturing all of them
mode: "mc" move+capture (default), "m" move only, "c" capture only
"""
import json, re, sys

ORTH = [(0, 1), (0, -1), (-1, 0), (1, 0)]
DIAG = [(1, 1), (-1, 1), (1, -1), (-1, -1)]
ATOMS = {  # letter -> (base vector, family)
    "W": (1, 0), "F": (1, 1), "D": (2, 0), "A": (2, 2), "H": (3, 0), "G": (3, 3),
    "N": (1, 2), "C": (1, 3), "Z": (2, 3),
}
COMPOUND = {"K": ["W", "F"], "Q": ["R", "B"], "R": ["WW"], "B": ["FF"]}


def vectors(a, b):
    """all 8 symmetric images of leaper (a,b)"""
    out = set()
    for x, y in ((a, b), (b, a)):
        for sx in (1, -1):
            for sy in (1, -1):
                out.add((x * sx, y * sy))
    return sorted(out)


def select(vecs, mods):
    """Apply Betza direction modifiers. Component semantics: a letter selects the
    vectors that have that component (f: y>0, b: y<0, l: x<0, r: x>0,
    s: x!=0, v: y!=0). Two-letter diagonal pairs (fr, fl, br, bl) on diagonal
    atoms select a single direction; 'ff'/'fs' etc. on oblique leapers select
    narrow/wide moves."""
    if not mods:
        return vecs
    diag = all(abs(x) == abs(y) for x, y in vecs)
    orth = all(x == 0 or y == 0 for x, y in vecs)
    oblique = any(x != 0 and y != 0 and abs(x) != abs(y) for x, y in vecs)
    if oblique:
        diag = orth = False
    chosen = set()
    i = 0
    while i < len(mods):
        pair = mods[i:i + 2]
        if oblique and len(pair) == 2 and pair[0] in "fb" and pair[1] in "fbsrl" :
            # ff = narrow forward (|y|>|x|), fs/fr/fl = wide forward
            fy = 1 if pair[0] == "f" else -1
            for x, y in vecs:
                if y * fy <= 0:
                    continue
                narrow = abs(y) > abs(x)
                if pair[1] in "fb" and narrow:
                    chosen.add((x, y))
                elif pair[1] == "s" and not narrow:
                    chosen.add((x, y))
                elif pair[1] == "r" and x > 0 and not narrow:
                    chosen.add((x, y))
                elif pair[1] == "l" and x < 0 and not narrow:
                    chosen.add((x, y))
            i += 2
            continue
        if diag and len(pair) == 2 and pair[0] in "fb" and pair[1] in "rl":
            fy = 1 if pair[0] == "f" else -1
            fx = 1 if pair[1] == "r" else -1
            chosen |= {(x, y) for x, y in vecs if y * fy > 0 and x * fx > 0}
            i += 2
            continue
        if diag and len(pair) == 2 and pair[0] in "rl" and pair[1] in "fb":
            fx = 1 if pair[0] == "r" else -1
            fy = 1 if pair[1] == "f" else -1
            chosen |= {(x, y) for x, y in vecs if y * fy > 0 and x * fx > 0}
            i += 2
            continue
        c = mods[i]
        if oblique and c in "vs":
            # single v / s on an oblique leaper: narrow (vertical) / wide (sideways) moves
            chosen |= {(x, y) for x, y in vecs if (abs(y) > abs(x)) == (c == "v")}
            i += 1
            continue
        test = {"f": lambda x, y: y > 0, "b": lambda x, y: y < 0, "l": lambda x, y: x < 0,
                "r": lambda x, y: x > 0, "s": lambda x, y: x != 0, "v": lambda x, y: y != 0}[c]
        chosen |= {(x, y) for x, y in vecs if test(x, y)}
        i += 1
    return sorted(chosen)


def unit(v):
    x, y = v
    g = max(abs(x), abs(y))
    return (x // g, y // g)


TOKEN = re.compile(r"([fbvslr]*)(\(\d+,\d+\)|[WFDAHGNCZKQRB])(\2?)(\d*)")


def parse_simple(s, mode="mc"):
    """parse a run of plain Betza tokens -> rules"""
    rules = []
    pos = 0
    while pos < len(s):
        m = TOKEN.match(s, pos)
        if not m:
            raise ValueError(f"cannot parse at {s[pos:]!r} in {s!r}")
        mods, atom, dbl, num = m.groups()
        pos = m.end()
        rules += atom_rules(mods, atom, bool(dbl), int(num) if num else None, mode)
    return rules


def atom_rules(mods, atom, doubled, num, mode):
    if atom in ("K", "Q", "R", "B"):
        rider = atom in ("Q", "R", "B") or doubled
        base = {"K": ["W", "F"], "Q": ["W", "F"], "R": ["W"], "B": ["F"]}[atom]
        vecs = []
        for b in base:
            vecs += vectors(*ATOMS[b])
        vecs = select(sorted(set(vecs)), mods)
        mx = num if num else (None if rider else 1)
        return [{"t": "slide", "d": list(v), "max": mx, "mode": mode} for v in vecs]
    if atom.startswith("("):
        a, b = map(int, atom[1:-1].split(","))
    else:
        a, b = ATOMS[atom]
    vecs = select(vectors(a, b), mods)
    if atom in ("W", "F") and (doubled or num):
        mx = None if doubled and not num else num
        return [{"t": "slide", "d": list(v), "max": mx, "mode": mode} for v in vecs]
    if atom in ("W", "F"):
        return [{"t": "slide", "d": list(v), "max": 1, "mode": mode} for v in vecs]
    if doubled or num:
        raise ValueError(f"leaper rider not supported: {atom}")
    return [{"t": "leap", "d": list(v), "mode": mode} for v in vecs]


def parse_special(g):
    """parenthesised extensions used on the Wikipedia page"""
    g = g.strip()
    if g == "cK-bK":
        return [{"t": "lion"}]
    m = re.fullmatch(r"\(c([RBQ])cd\1\)-\1", g)
    if m:
        vecs = {"R": ORTH, "B": DIAG, "Q": ORTH + DIAG}[m.group(1)]
        return [{"t": "rangecap", "d": list(v)} for v in vecs]
    m = re.fullmatch(r"([fbvslr]*)([BR])-s\2", g)  # hook mover
    if m:
        mods, a = m.groups()
        vecs = select(vectors(*ATOMS["F" if a == "B" else "W"]), mods)
        out = []
        for v in vecs:
            turn = [(-v[1], v[0]), (v[1], -v[0])]
            out.append({"t": "hook", "d": list(v), "turn": [list(t) for t in turn]})
        return out
    # limited-range jump then range:  f(mpB)3-B, b(mpB)3-B, v(mppR3)-R, f(mpFF)3-FF
    m = re.fullmatch(r"([fbvslr]*)\(mp+(B|R|FF|WW)(\d*)\)(\d*)-(B|R|FF|WW)", g)
    if m:
        mods, a, n1, n2, _ = m.groups()
        n = int(n1 or n2)
        fam = "F" if a in ("B", "FF") else "W"
        vecs = select(vectors(*ATOMS[fam]), mods)
        # pieces in the first n squares do not block; it may stop on (or capture at) any square
        return [{"t": "jumpslide", "d": list(v), "jump": k, "max": None, "jmode": "mc"}
                for v in vecs for k in range(1, n + 1)]
    # jump to a leaper square then continue as a rider: D-R, fA-B, G-B2, (4,0)-R, mAmG-B, mvDmvH-R
    m = re.fullmatch(r"((?:m?[fbvslr]*(?:\(\d+,\d+\)|[DAHG]))+)-(B|R)(\d*)", g)
    if m:
        legs, _, n = m.groups()
        out = []
        for lm in re.finditer(r"(m?)([fbvslr]*)(\(\d+,\d+\)|[DAHG])", legs):
            mm, mods, atom = lm.groups()
            a, b = map(int, atom[1:-1].split(",")) if atom.startswith("(") else ATOMS[atom]
            for v in select(vectors(a, b), mods):
                out.append({"t": "jumpslide", "d": list(unit(v)), "jump": max(abs(v[0]), abs(v[1])),
                            "max": int(n) if n else None, "jmode": "m" if mm else "mc"})
        return out
    if g == "pR-R":  # may pass over one piece along an orthogonal line
        return [{"t": "slide", "d": list(v), "max": None, "mode": "mc", "hops": 1} for v in ORTH]
    if g == "fmB-B":  # forward diagonal ranging (move part only differs on the move leg)
        return [{"t": "slide", "d": list(v), "max": None, "mode": "mc"} for v in select(DIAG, "f")]
    if g == "fB-sB":
        return parse_special("fB-sB".replace("fB-sB", "fB-sB"))  # unreachable guard
    raise ValueError(f"unknown special {g!r}")


def split_top(s):
    """split notation into plain text and top-level parenthesised groups"""
    parts, depth, buf = [], 0, ""
    for ch in s:
        if ch == "(":
            if depth == 0 and buf:
                parts.append(("plain", buf)); buf = ""
            depth += 1
            if depth == 1:
                continue
        if ch == ")":
            depth -= 1
            if depth == 0:
                parts.append(("group", buf)); buf = ""; continue
        buf += ch
    if buf:
        parts.append(("plain", buf))
    return parts


def compile_notation(n):
    n = n.split(".")[0].split(",  ")[0]
    n = n.replace(", ignoring capturing restrictions", "").strip()
    rules = []
    parts = split_top(n)
    k = 0
    while k < len(parts):
        kind, txt = parts[k]
        if kind == "plain":
            # a trailing modifier-only plain chunk applies to the following group, e.g. "f(4,4)"
            m = re.fullmatch(r"(.*?)([fbvslr]*)$", txt)
            head, tailmods = m.groups()
            if head:
                rules += parse_simple(head)
            if tailmods:
                if k + 1 < len(parts) and parts[k + 1][0] == "group":
                    nxt = parts[k + 1][1]
                    if re.fullmatch(r"\d+,\d+", nxt):  # modifier on a (x,y) leaper
                        rules += parse_simple(f"{tailmods}({nxt})")
                    else:
                        rules += parse_special(tailmods + nxt) if not nxt.startswith("(") or "-" in nxt else []
                    k += 2
                    continue
                raise ValueError(f"dangling modifiers in {n!r}")
        else:
            if re.fullmatch(r"\d+,\d+", txt):
                rules += parse_simple(f"({txt})")
            else:
                rules += parse_special(txt)
        k += 1
    return rules


# ---------------- empty-board reach (for diagram cross-check) ----------------
def reach(rules, R):
    sq = set()
    inb = lambda x, y: abs(x) <= R and abs(y) <= R
    for r in rules:
        t = r["t"]
        if t == "slide":
            dx, dy = r["d"]; mx = r["max"] or 99
            for k in range(1, mx + 1):
                if not inb(dx * k, dy * k): break
                sq.add((dx * k, dy * k))
        elif t == "leap":
            if inb(*r["d"]): sq.add(tuple(r["d"]))
        elif t == "jumpslide":
            dx, dy = r["d"]; k0 = r["jump"]; mx = r["max"] if r["max"] is not None else 99
            for k in range(k0, k0 + mx + 1):
                if not inb(dx * k, dy * k): break
                sq.add((dx * k, dy * k))
        elif t == "hook":
            dx, dy = r["d"]
            for k in range(1, 99):
                p = (dx * k, dy * k)
                if not inb(*p): break
                sq.add(p)
                for tx, ty in r["turn"]:
                    for j in range(1, 99):
                        q = (p[0] + tx * j, p[1] + ty * j)
                        if not inb(*q): break
                        sq.add(q)
        elif t == "lion":
            for x in range(-2, 3):
                for y in range(-2, 3):
                    if (x, y) != (0, 0) and inb(x, y): sq.add((x, y))
        elif t == "igui":
            pass
        elif t == "rangecap":
            dx, dy = r["d"]
            for k in range(1, 99):
                if not inb(dx * k, dy * k): break
                sq.add((dx * k, dy * k))
    return sq


def diagram_marks(L, line):
    j = line
    while not L[j].startswith("{| border"):
        j += 1
    rows, cur, k = [], [], j + 1
    while not L[k].startswith("|}"):
        ln = L[k]
        if ln.startswith("|-"):
            if cur: rows.append(cur)
            cur = []
        else:
            for c in ln.lstrip("|").split("||"):
                c = c.strip()
                if not c: continue
                col = c.split("background:")[1][:7] if "background:" in c else ""
                sym = c.split("|")[-1].strip()
                cur.append((sym, col))
        k += 1
    if cur: rows.append(cur)
    oy = ox = None
    for y, r in enumerate(rows):
        for x, (s, c) in enumerate(r):
            if "☖" in s: oy, ox = y, x
    marks = set()
    for y, r in enumerate(rows):
        for x, (s, c) in enumerate(r):
            if (y, x) == (oy, ox): continue
            if c and c.lower() not in ("#e0e0e0", "#ffffff"):
                marks.add((x - ox, oy - y))
    R = min(ox, len(rows[0]) - 1 - ox, oy, len(rows) - 1 - oy)
    return marks, R, rows


# Notation corrections, justified by the prose on the same Wikipedia entry
NOTATION_FIX = {
    # prose: "any number of free squares orthogonally forward or backward" -> vR, not vF
    "金翅": "bF3sW3vR(f(mpFF)3-FF)",
    # prose: "jump up to three pieces along a straight line in any direction, then continue"
    "教王": "(v(mppR3)-R)(s(mppR3)-R)(f(mpB)3-B)(b(mpB)3-B)",
}
# Pieces whose prose describes moves beyond plain notation; rules built by hand
def free_eagle_rules():
    # Q; jump up to 3 (forward diagonals up to 4) then range; igui/jitto on adjacent squares.
    # (Its multi-capture-along-the-line option is not modelled.)
    r = parse_simple("Q")
    for v in ORTH + DIAG:
        n = 4 if (v[1] == 1 and v[0] != 0) else 3
        r += [{"t": "jumpslide", "d": list(v), "jump": k, "max": None, "jmode": "mc"} for k in range(1, n + 1)]
    r.append({"t": "igui"})
    return r
RULE_OVERRIDE = {"奔鷲": free_eagle_rules}
# Diagram on Wikipedia is visibly truncated relative to its own prose (checked by hand)
DIAGRAM_INCOMPLETE = {
    "奮迅": "prose: 'can move three squares in any direction' (Q3) but diagram shows radius 2 only",
    "獅鷹": "prose: 'can move as a lion or as a bishop' but diagram omits bishop lines",
    "法性": "prose: 'can move as a lion, or as a queen' but diagram shows radius 3 only",
}

if __name__ == "__main__":
    E = json.load(open("entries.json", encoding="utf-8"))
    L = open("taikyoku_en.wiki", encoding="utf-8").read().split("\n")
    out, bad = [], 0
    for e in E:
        kj = e["names"][0]["kanji"]
        try:
            if kj in RULE_OVERRIDE:
                rules = RULE_OVERRIDE[kj]()
            else:
                rules = compile_notation(NOTATION_FIX.get(kj, e["notation"]))
        except Exception as ex:
            print("PARSE FAIL", e["header"], e["notation"], ex); bad += 1; continue
        marks, R, _ = diagram_marks(L, e["line"])
        mine = reach(rules, R)
        marks_in = {m for m in marks if abs(m[0]) <= R and abs(m[1]) <= R}
        ok = mine == marks_in or kj in DIAGRAM_INCOMPLETE
        e2 = dict(e); e2["rules"] = rules; e2["fix"] = NOTATION_FIX.get(kj) or (kj in RULE_OVERRIDE and "override") or DIAGRAM_INCOMPLETE.get(kj); e2["diagramR"] = R; e2["diagramOK"] = ok
        e2["missing"] = sorted(marks_in - mine); e2["extra"] = sorted(mine - marks_in)
        out.append(e2)
        if not ok:
            bad += 1
            print(f"MISMATCH {e['header'][:60]:60s} {e['notation']:40s} R={R} missing={sorted(marks_in-mine)[:6]} extra={sorted(mine-marks_in)[:6]}")
    json.dump(out, open("compiled.json", "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("entries:", len(E), "compiled:", len(out), "problems:", bad)
