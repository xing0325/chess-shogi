// Differential fixtures for the draft state machine (scalashogi TaikyokuDraftTest):
// random drafts played with autoAction, every action and, before each placement,
// the allowed squares of every piece of the roster.
// Run: npx tsx tools/taikyoku/gen_draft_fixtures.ts <out.txt> [drafts]
import { writeFileSync } from "node:fs";
import { actor, applyDraft, autoAction, mulberry32, newDraft, placeSquares, type DraftAction } from "../../shared/src/taikyoku/draft";
import type { Sq } from "../../shared/src/taikyoku/types";

const key = (s: Sq) => `${5 - s.x}${String.fromCharCode(97 + 4 - s.y)}`;
const write = (a: DraftAction): string =>
  a.type === "ban" ? (a.kind ? `ban ${a.kind}` : "ban") : a.type === "pick" ? `pick ${a.kind}` : a.type === "place" ? `place ${a.kind} ${key(a.at)}` : "";

const out: string[] = [];
const n = Number(process.argv[3] ?? 300);
let nChecks = 0;
for (let seed = 1; seed <= n; seed++) {
  const rng = mulberry32(seed);
  let d = newDraft(rng);
  const actions: { c: string; a: string }[] = [];
  const checks: { at: number; c: string; kind: string; squares: string[] }[] = [];
  while (d.phase !== "play") {
    const side = actor(d)!;
    if (d.phase === "place")
      for (const kind of [...new Set(d.toPlace[side])])
        checks.push({ at: actions.length, c: side === "sente" ? "b" : "w", kind, squares: placeSquares(d, side, kind).map(key).sort() });
    // bans: sometimes a real ban instead of the time out pass
    let a = autoAction(d, rng)!;
    if (a.type === "ban" && rng() < 0.7) {
      const used = new Set([...d.bans.blue, ...d.bans.red, ...d.picks.blue, ...d.picks.red]);
      const av = d.pool.filter((k) => !used.has(k));
      a = { type: "ban", kind: av[Math.floor(rng() * av.length)] };
    }
    actions.push({ c: side === "sente" ? "b" : "w", a: write(a) });
    d = applyDraft(d, side, a);
  }
  // D <seed> <first color> <pool>, then A <color> <action> and C <action index> <color> <kind> <squares>
  out.push(`D ${seed} ${d.game.turn === "sente" ? "b" : "w"} ${d.pool.join(",")}`);
  let ci = 0;
  actions.forEach((a, i) => {
    for (; ci < checks.length && checks[ci].at === i; ci++) {
      const c = checks[ci];
      out.push(`C ${c.c} ${c.kind} ${c.squares.join(",") || "-"}`);
    }
    out.push(`A ${a.c} ${a.a}`);
  });
  nChecks += checks.length;
}
writeFileSync(process.argv[2], out.join("\n") + "\n");
console.log(`${n} drafts, ${nChecks} placement checks`);
