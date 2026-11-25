// Plays the first-person week end to end in the browser and screenshots it: title, lobby, intake
// board, garage and van, each scene with its witness talking, the exam table with a region picked,
// the lab, the certificate and the debrief. Follows the story (Monday orientation, then one case a
// day), walks a little for real with the keyboard, and fails on console errors, horizontal overflow
// or any step that doesn't land.
//
//   npm run build && python3 -m http.server 8770 --bind 127.0.0.1 &
//   node tools/fp-shots.cjs http://127.0.0.1:8770 docs/media            # phone, 390 x 844
//   node tools/fp-shots.cjs http://127.0.0.1:8770 docs/media --desktop  # desktop, 1440 x 900
//   ... [--cases=night-shift,kitchen-floor] to stop after those cases
//
// Shots are named fp-<n>-<what>.png (phone) and desktop-fp-<n>-<what>.png (desktop).
const { chromium } = require("playwright");

const args = process.argv.slice(2);
const base = args[0] && !args[0].startsWith("--") ? args[0] : "http://127.0.0.1:8770";
const out = args[1] && !args[1].startsWith("--") ? args[1] : "shots";
const desktop = args.includes("--desktop");
const only = (args.find((a) => a.startsWith("--cases=")) ?? "").slice(8).split(",").filter(Boolean);
const tag = desktop ? "desktop-fp" : "fp";
const WEEK = ["night-shift", "kitchen-floor", "basement-stairs"];

(async () => {
  const browser = await chromium.launch({ timeout: 600000, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext(
    desktop
      ? { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, colorScheme: "dark" }
      : { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, colorScheme: "dark" },
  );
  const page = await ctx.newPage();
  page.setDefaultTimeout(120000);
  const problems = [];
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text()}`));
  const t0 = Date.now();
  const log = (...a) => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
  const fail = (why) => {
    throw new Error(why);
  };
  const shot = async (n, what) => {
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${tag}-${n}-${what}.png` });
    log("shot", `${tag}-${n}-${what}`);
  };
  const state = () => page.evaluate(() => window.__fp.state);
  const waitMode = (mode, loc) =>
    page.waitForFunction(([m, l]) => window.__fp && window.__fp.state.mode === m && (!l || window.__fp.state.location === l), [mode, loc]);
  const json = async (p) => (await fetch(`${base}/${p}`)).json();
  const lessons = await json("packs/forensics-core/lessons.json");

  /** Advance any open dialogue until it closes. */
  const dismiss = async () => {
    for (let i = 0; i < 80; i++) {
      const open = await page.evaluate(() => { const b = document.querySelector(".fp-say"); return !!b && !b.hidden; });
      if (!open) return;
      await page.keyboard.press("e");
      await page.waitForTimeout(120);
    }
    fail("dialogue never closed");
  };
  /** Wait for a dialogue line to finish typing (for a screenshot). */
  const settleSay = async () => {
    await page.waitForSelector(".fp-say:not([hidden])");
    await page.waitForFunction(() => !document.querySelector(".fp-say")?.classList.contains("typing"), null, { timeout: 15000 }).catch(() => {});
  };
  /** Walk up to an interactable, check the crosshair is on it, and use it. */
  const use = async (id, { keepSay = false } = {}) => {
    await dismiss();
    const ok = await page.evaluate((i) => window.__fp.approach(i), id);
    if (!ok) fail(`can't reach ${id}`);
    await page.waitForTimeout(250);
    const s = await state();
    if (s.aim !== id) fail(`aiming at ${s.aim}, wanted ${id} (at ${s.location} ${s.x.toFixed(2)},${s.z.toFixed(2)})`);
    await page.evaluate(() => window.__fp.interact());
    await page.waitForTimeout(300);
    if (!keepSay) await dismiss();
  };
  const travelled = async (loc) => {
    await page.waitForFunction((l) => window.__fp.state.location === l && window.__fp.state.mode !== "fade", loc);
    await page.waitForTimeout(500);
  };
  const answerLesson = async () => {
    const sheet = await page.$(".sheet");
    if (!sheet) return false;
    const first = await page.$eval(".sheet .opt", (b) => b.id);
    const lid = first.replace(/^opt-/, "").replace(/-\d+$/, "");
    const l = lessons.find((x) => x.id === lid);
    await page.click(`#opt-${lid}-${l.answer}`);
    await page.click("#lesson-done");
    return true;
  };
  const closePanel = async () => {
    await page.click("#fp-close");
    await page.waitForFunction(() => !document.querySelector(".fp-panel"));
  };

  // ------------------------------------------------------------------ title and Monday
  await page.goto(`${base}/play.html`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__fp && document.querySelector(".fp-menu-back:not([hidden])"));
  await page.waitForTimeout(1200);
  await shot(1, "title");
  await page.click(".fp-tile.go");
  await page.waitForTimeout(600);
  await dismiss();
  await waitMode("walk");
  // walk forward for real: hold W (or nudge with the touch stick's keyboard twin) and check we moved
  const before = await state();
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  await page.keyboard.up("w");
  await page.waitForTimeout(400);
  const after = await state();
  if (!(after.z < before.z - 0.3)) fail(`walking forward didn't move (${before.z} → ${after.z})`);
  await page.evaluate(() => window.__fp.teleport(1.5, 8.6, 0.25, 0.02));
  await page.waitForTimeout(300);
  await shot(2, "lobby");

  await use("welcome-letter");
  await use("mentor");
  await use("investigator");
  await use("tech");
  await use("desk-note");
  let s = await state();
  log("objective after Monday:", s.objective);

  // ------------------------------------------------------------------ the week's cases
  let n = 3;
  let first = true;
  for (const caseId of WEEK) {
    if (only.length && !only.includes(caseId)) break;
    const def = await json(`packs/forensics-core/cases/${caseId}.json`);
    const scene = await json(`packs/forensics-core/world/scenes/scene-${caseId}.json`);
    await use("voicemail");
    await use("intake-board");
    await page.waitForSelector(`#take-${caseId}`);
    if (first) await shot(n++, "intake-board");
    await page.click(`#take-${caseId}`);
    await page.waitForFunction(() => !document.querySelector(".fp-panel"));
    await dismiss();
    s = await state();
    if (s.active !== caseId) fail(`took ${caseId} but active is ${s.active}`);
    log("case", caseId, "·", s.objective);
    await use("case-folder");

    // the garage and the van
    await page.evaluate(() => window.__fp.teleport(-10.8, 3.2, -2.37, -0.1));
    await page.waitForTimeout(300);
    if (first) await shot(n++, "garage-van");
    await use("van");
    await travelled(`scene-${caseId}`);
    await dismiss();

    // the scene: talk to the witness (screenshot mid-conversation), then note each finding
    const talkIt = scene.interactables.find((i) => i.action.kind === "talk");
    if (talkIt) {
      await use(talkIt.id, { keepSay: true });
      await settleSay();
      await shot(n++, `scene-${caseId}`);
      await dismiss();
    } else await shot(n++, `scene-${caseId}`);
    for (const f of def.findings.filter((x) => x.procedure === "scene")) {
      const it = scene.interactables.find((i) => i.action.kind === "finding" && i.action.finding === f.id);
      await use(it.id);
    }
    s = await state();
    if (s.looked.length !== def.findings.filter((x) => x.procedure === "scene").length) fail(`noted ${s.looked} at the scene`);
    const door = scene.interactables.find((i) => i.action.kind === "door");
    await use(door.id);
    await travelled("office");
    await dismiss();

    // the exam table: look at each region and examine it, turning the body for the back
    await use("exam-table");
    await waitMode("exam");
    await page.waitForTimeout(400);
    let pose = "supine";
    let pickShot = false;
    const regionFindings = def.findings.filter((x) => x.region);
    for (const f of regionFindings) {
      await dismiss(); // a finding can make the mentor speak (the basement-stairs timeline flag)
      const want = f.pose ?? "supine";
      if (want !== pose) {
        await page.keyboard.press("t");
        pose = want;
        await page.waitForFunction((p) => window.__fp.state.pose === p, pose);
        await page.waitForTimeout(1300);
      }
      await page.evaluate((r) => window.__fp.lookAtRegion(r), f.region);
      await page.waitForTimeout(250);
      s = await state();
      if (s.examAim !== f.region) fail(`looking at ${f.region} but the crosshair picks ${s.examAim}`);
      if (first && !pickShot) {
        await shot(n++, "exam-region");
        pickShot = true;
      }
      if (f === regionFindings[0] && !desktop) {
        // phones: tap the region on screen instead of the crosshair
        const p = await page.evaluate((r) => window.__fp.regionClient(r), f.region);
        await page.touchscreen.tap(p.x, p.y);
      } else {
        await page.evaluate(() => window.__fp.interact());
      }
      await page.waitForFunction((fid) => window.__fp.state.case.revealed.includes(fid), f.id);
    }
    await page.keyboard.press("q");
    await waitMode("walk");
    await use("autopsy-station");
    await use("tox-analyzer");
    if (first) {
      await page.evaluate(() => window.__fp.teleport(6.4, -1.6, -0.6, -0.08));
      await page.waitForTimeout(300);
      await shot(n++, "lab");
    }
    s = await state();
    for (const p of def.truth.par) if (!s.case.done.includes(p)) fail(`${p} not done (${s.case.done})`);

    // the desk terminal: interpret, link, window, cause, manner, sign
    await use("desk-terminal");
    await page.waitForSelector("#fp-desk");
    for (let guard = 0; guard < 40; guard++) {
      const btn = await page.$("#fp-desk button[id^='interpret-']");
      if (!btn) break;
      await btn.click();
      await page.waitForTimeout(150);
      await answerLesson();
      await page.waitForTimeout(150);
    }
    for (const f of def.findings) {
      if (!(await page.$(`#link-${f.id}-time`))) continue;
      if (f.interp.kind !== "claim") await page.click(`#link-${f.id}-time`);
      if ((f.supports ?? []).some((x) => x.line === "cause" && x.value === def.truth.cause)) await page.click(`#link-${f.id}-cause`);
      if ((f.supports ?? []).some((x) => x.line === "manner" && x.value === def.truth.manner)) await page.click(`#link-${f.id}-manner`);
    }
    const t = def.truth.hoursDead;
    const setSlider = (id, hours) =>
      page.$eval(`#${id}`, (el, v) => {
        el.value = String(v);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      }, Math.round((16 - hours) * 4) / 4);
    await setSlider("win-early", t + 1.25);
    await setSlider("win-late", t - 1.25);
    await page.click(`#cause-${def.truth.cause}`);
    await page.click(`#manner-${def.truth.manner}`);
    if (first) {
      await page.$eval("#certificate", (e) => e.scrollIntoView({ block: "start" }));
      await shot(n++, "certificate");
    }
    await page.click("#sign");
    await page.waitForSelector("#debrief");
    const total = await page.textContent("#debrief .total");
    log(caseId, "signed:", total);
    if (first) await shot(n++, "debrief");
    await page.click("#fp-debrief-done");
    await page.waitForFunction(() => !document.querySelector(".fp-panel"));
    await dismiss();
    const prof = await page.evaluate(() => JSON.parse(localStorage.getItem("casework.profile") || "{}"));
    if (!prof.records?.[`case:${caseId}`]) fail(`no best score recorded for ${caseId}`);

    // the evening: talk to the mentor, read the note, and the next day starts
    await use("mentor");
    await use("desk-note");
    first = false;
  }

  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push("horizontal overflow");
  const save = await page.evaluate(() => JSON.parse(localStorage.getItem("casework.fp.save") || "null"));
  log("final objective:", (await state()).objective, "· save version", save?.version);
  await browser.close();
  const real = problems.filter((p) => !/strata info/.test(p));
  console.log(JSON.stringify({ shots: n - 1, problems: real }));
  if (real.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
