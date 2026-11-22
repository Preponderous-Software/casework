// The home page: cases with best scores, the drill, the player's skills, and progress export.
import { MAX_SCORE } from "../../casework/case/play.ts";
import { exportProfile, importProfile, ProfileError, type Profile } from "../../kernel/profile.ts";
import { dueCards } from "../../kernel/review.ts";
import type { Pack } from "./content.ts";
import { el, masteryLabel, scoreRing } from "./dom.ts";
import { ICONS } from "./icons.ts";

export interface HomePorts {
  pack: Pack;
  profile: Profile;
  save(p: Profile): void;
  today(): number;
}

export function startHome(root: HTMLElement, ports: HomePorts, notice?: string): void {
  let profile = ports.profile;

  function render() {
    root.innerHTML = "";
    const hero = el("header", { class: "hero" });
    hero.append(el("h1", {}, "Casework"), el("p", {}, "You're the medical examiner. Examine the body, learn what each finding means as you need it, and sign the death certificate."), el("p", { class: "fine" }, "Content note: these cases describe deaths, including a violent one, in clinical words. There are no graphic images."));
    root.append(hero);
    if (notice) root.append(el("p", { class: "notice", role: "status" }, notice));

    // Cases
    const cs = el("section", { class: "card" });
    cs.append(el("p", { class: "eyebrow" }, "Cases"));
    const list = el("div", { class: "cases" });
    ports.pack.cases.forEach((c, i) => {
      const rec = profile.records[`case:${c.id}`];
      const a = el("a", { class: "case-card", href: `case.html?case=${encodeURIComponent(c.id)}`, id: `case-${c.id}` });
      const num = el("span", { class: "num" }, String(i + 1));
      const txt = el("span", {});
      txt.append(el("span", { class: "t" }, c.title), el("br"), el("span", { class: "i" }, c.intake));
      const right = el("span", {});
      if (rec) right.innerHTML = scoreRing(rec.best, MAX_SCORE);
      else right.append(el("span", { class: "pill" }, "New"));
      a.append(num, txt, right);
      list.append(a);
    });
    cs.append(list);
    const grid = el("div", { class: "home-grid" });
    const left = el("div", { class: "col" });
    const rightCol = el("div", { class: "col" });
    left.append(cs);
    grid.append(left, rightCol);
    root.append(grid);

    // Drill
    const due = dueCards(profile.cards, ports.today()).length;
    const dr = el("section", { class: "card" });
    dr.append(el("p", { class: "eyebrow" }, "Practice"));
    const da = el("a", { class: "case-card", href: "drill.html", id: "drill-link" });
    const ic = el("span", { class: "num" });
    ic.innerHTML = ICONS.clock ?? "";
    const dt = el("span", {});
    dt.append(el("span", { class: "t" }, "Time-of-death drill"), el("br"), el("span", { class: "i" }, `Endless generated bodies. ${profile.stats.drills} played, ${profile.stats.drillsHit} right.`));
    const dp = el("span", {});
    dp.append(el("span", { class: due ? "pill mark" : "pill" }, due ? `${due} to review` : "Play"));
    da.append(ic, dt, dp);
    dr.append(da);
    rightCol.append(dr);

    // Skills
    const sk = el("section", { class: "card" });
    sk.append(el("p", { class: "eyebrow" }, "Your skills"));
    const skillGrid = el("div", { class: "skillgrid" });
    for (const s of ports.pack.skills) {
      const m = profile.skills[s.id] ?? "unknown";
      const cell = el("div", { class: "skill", title: `${s.name}: ${masteryLabel(m)}` });
      const b = el("span", { class: `badge m-${m}` });
      b.innerHTML = ICONS[s.icon] ?? "";
      cell.append(b, el("span", {}, s.name));
      skillGrid.append(cell);
    }
    sk.append(skillGrid, el("p", { class: "fine" }, "Grey: not learned yet · amber: novice · teal: practiced · green: mastered. You learn skills inside cases and the drill, when a finding needs them."));
    rightCol.append(sk);

    // Progress
    const pr = el("section", { class: "card" });
    pr.append(el("p", { class: "eyebrow" }, "Your progress"), el("p", { class: "fine" }, "Progress is saved in this browser. Save a copy to keep it safe or move it to another device."));
    const row = el("div", { class: "row" });
    const exp = el("button", { type: "button", class: "btn ghost", id: "export" }, "Save a copy");
    exp.addEventListener("click", () => {
      const blob = new Blob([exportProfile(profile)], { type: "application/json" });
      const a = el("a", { href: URL.createObjectURL(blob), download: "casework-progress.json" }) as HTMLAnchorElement;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    const imp = el("label", { class: "btn ghost", for: "import" }, "Load a copy");
    const file = el("input", { type: "file", id: "import", accept: "application/json,.json", hidden: "" }) as HTMLInputElement;
    file.addEventListener("change", async () => {
      const f = file.files?.[0];
      if (!f) return;
      try {
        profile = importProfile(await f.text());
        ports.save(profile);
        notice = "Progress loaded.";
      } catch (e) {
        notice = `That file couldn't be loaded: ${e instanceof ProfileError ? e.message : "it isn't a Casework progress file"}. Your current progress is unchanged.`;
      }
      render();
    });
    row.append(exp, imp, file);
    pr.append(row);
    rightCol.append(pr);

    root.append(el("p", { class: "fine" }, `Content pack ${ports.pack.id} ${ports.pack.version}. Lessons cite their sources; time ranges are teaching approximations, not a reference for real casework. Code MIT, content CC BY-SA 4.0.`));
  }

  render();
}
