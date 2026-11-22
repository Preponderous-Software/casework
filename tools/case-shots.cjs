// Plays a whole case in the browser and screenshots it: home, procedures, the 3D exam room,
// findings, the certificate and the debrief. Fails on console errors or horizontal overflow.
//
//   npm run build && python3 -m http.server 8770 &
//   node tools/case-shots.cjs http://127.0.0.1:8770 docs/media [case-id] [--list] [--desktop] [--light]
//
// --list uses the exam room's list fallback (no WebGL), which is much faster on software GL.
const { chromium } = require("playwright");

const base = process.argv[2] ?? "http://127.0.0.1:8770";
const out = process.argv[3] ?? "shots";
const caseId = process.argv[4] && !process.argv[4].startsWith("--") ? process.argv[4] : "night-shift";
const listMode = process.argv.includes("--list");
const desktop = process.argv.includes("--desktop");
const light = process.argv.includes("--light");
const tag = desktop ? "desktop-" : "";

(async () => {
  const browser = await chromium.launch({ timeout: 600000, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const ctx = await browser.newContext({ viewport: desktop ? { width: 1440, height: 900 } : { width: 400, height: 860 }, deviceScaleFactor: desktop ? 1 : 2, colorScheme: light ? "light" : "dark" });
  if (light) await ctx.addInitScript(() => { try { localStorage.setItem("casework.theme", "light"); } catch {} });
  const page = await ctx.newPage();
  page.setDefaultTimeout(240000);
  const problems = [];
  page.on("pageerror", (e) => problems.push(e.message));
  page.on("console", (m) => m.type() === "error" && problems.push(m.text()));
  const shot = (name, opts = {}) => page.screenshot({ path: `${out}/${tag}case-${name}.png`, ...opts });

  const manifest = await (await fetch(`${base}/packs/forensics-core/manifest.json`)).json();
  const lessons = await (await fetch(`${base}/packs/forensics-core/lessons.json`)).json();
  const def = await (await fetch(`${base}/packs/forensics-core/cases/${caseId}.json`)).json();

  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForSelector(".case-card");
  await shot("0-home");

  await page.goto(`${base}/case.html?case=${caseId}${listMode ? "&fallback=1" : ""}`, { waitUntil: "commit" });
  await page.waitForSelector(".procs");
  await shot("1-intake");

  const order = [];
  const add = (id) => {
    if (order.includes(id)) return;
    for (const r of def.procedures.find((p) => p.id === id).requires ?? []) add(r);
    order.push(id);
  };
  def.truth.par.forEach(add);

  const answer = async () => {
    const sheet = await page.$(".sheet");
    if (!sheet) return;
    const first = await page.$eval(".sheet .opt", (b) => b.id);
    const lid = first.replace(/^opt-/, "").replace(/-\d+$/, "");
    const l = lessons.find((x) => x.id === lid);
    await page.click(`#opt-${lid}-${l.answer}`);
    await page.click("#lesson-done");
  };

  let pose = "supine";
  let backShot = false;
  for (const pid of order) {
    await page.click(`#proc-${pid}`);
    const proc = def.procedures.find((p) => p.id === pid);
    if (proc.exam) {
      await page.waitForFunction(() => window.__exam && window.__exam.mode !== "loading");
      const mode = await page.evaluate(() => window.__exam.mode);
      if (mode === "3d") await page.waitForTimeout(1500);
      await page.$eval("#examPanel", (e) => e.scrollIntoView({ block: "start" }));
      await shot("2-exam-room");
      for (const f of def.findings.filter((x) => x.procedure === pid && x.region)) {
        const want = f.pose ?? "supine";
        if (want !== pose) {
          await page.click("#turn");
          pose = want;
          if (mode === "3d") await page.waitForFunction(() => !window.__exam.turning);
        }
        await page.click(`#regions button[data-region="${f.region}"]`);
        await page.waitForSelector(`#finding-${f.id}`);
        if (mode === "3d" && pose === "prone" && !backShot) {
          await page.$eval("#examPanel", (e) => e.scrollIntoView({ block: "start" }));
          await shot("3-exam-back");
          backShot = true;
        }
      }
    }
  }

  // Interpret everything, learning skills as they come up.
  for (;;) {
    const btn = await page.$("button[id^='interpret-']");
    if (!btn) break;
    await btn.click();
    await answer();
  }
  await page.$eval("#findings", (e) => e.scrollIntoView({ block: "start" }));
  await shot("4-findings");

  // Link evidence the way an expert would.
  for (const f of def.findings) {
    if (!(await page.$(`#link-${f.id}-time`))) continue;
    if (f.interp.kind !== "claim") await page.click(`#link-${f.id}-time`);
    if ((f.supports ?? []).some((s) => s.line === "cause" && s.value === def.truth.cause)) await page.click(`#link-${f.id}-cause`);
    if ((f.supports ?? []).some((s) => s.line === "manner" && s.value === def.truth.manner)) await page.click(`#link-${f.id}-manner`);
  }

  // Window: slider value = 16 − hours before found; aim for the truth ± 1.25 h.
  const t = def.truth.hoursDead;
  const setSlider = async (id, hours) => {
    await page.$eval(`#${id}`, (el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }, Math.round((16 - hours) * 4) / 4);
  };
  await setSlider("win-early", t + 1.25);
  await setSlider("win-late", t - 1.25);
  await page.click(`#cause-${def.truth.cause}`);
  await page.click(`#manner-${def.truth.manner}`);
  await page.$eval("#certificate", (e) => e.scrollIntoView({ block: "start" }));
  await shot("5-certificate");
  await page.click("#sign");
  await page.waitForSelector("#debrief");
  await page.waitForTimeout(600);
  await page.$eval("#debrief", (e) => e.scrollIntoView({ block: "start" }));
  await shot("6-debrief");
  const total = await page.textContent("#debrief .total");
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push("horizontal overflow");

  await page.goto(`${base}/`, { waitUntil: "load" });
  await page.waitForSelector(".case-card");
  const ring = await page.$eval(`#case-${caseId}`, (a) => a.textContent);
  await browser.close();
  console.log(JSON.stringify({ case: caseId, total, homeShows: ring.trim(), problems }));
  if (problems.length) process.exit(1);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
