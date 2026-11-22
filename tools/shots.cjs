// Screenshots for the README and PRs: plays one drill with a fixed seed at phone and desktop sizes
// and fails on any console error or horizontal overflow.
//
//   npm run build && python3 -m http.server 8770 &   # serve the repo root
//   npm run shots -- http://127.0.0.1:8770 docs/media
const { chromium } = require("playwright");

const base = process.argv[2] ?? "http://127.0.0.1:8770";
const out = process.argv[3] ?? "shots";
const SEED = 99;

(async () => {
  const browser = await chromium.launch({ timeout: 600000 });
  const problems = [];
  for (const [name, viewport, scheme, dpr] of [
    ["phone", { width: 400, height: 860 }, "dark", 2],
    ["desktop", { width: 1100, height: 900 }, "light", 1],
  ]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: dpr, colorScheme: scheme });
    const page = await ctx.newPage();
    page.setDefaultTimeout(180000);
    page.on("pageerror", (e) => problems.push(`${name}: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && problems.push(`${name}: ${m.text()}`));
    await page.goto(`${base}/?seed=${SEED}`, { waitUntil: "load" });
    await page.waitForSelector(".tiles");
    const shot = (file, opts = {}) => page.screenshot({ path: `${out}/${name}-${file}.png`, ...opts });

    await shot("1-findings");
    await page.click("#tile-algor-mortis");
    await page.click("#opt-algor-1-1");
    await shot("2-lesson");
    await page.click("#lesson-done");
    for (const [tile, wrong] of [["rigor-mortis", "rigor-1-2"], ["livor-mortis", null], ["gastric-contents", null], ["scene-conditions", null]]) {
      await page.click(`#tile-${tile}`);
      const id = await page.$eval(".sheet .opt", (b) => b.id);
      const lessonId = id.replace(/^opt-/, "").replace(/-\d+$/, "");
      const answer = await page.evaluate(async (lid) => {
        const r = await fetch("packs/forensics-core/lessons.json");
        return (await r.json()).find((l) => l.id === lid).answer;
      }, lessonId);
      await page.click(wrong ? `#opt-${wrong}` : `#opt-${lessonId}-${answer}`);
      await page.click("#lesson-done");
    }
    await page.$eval(".chart", (el) => el.scrollIntoView({ block: "center" }));
    await shot("3-evidence");
    await page.fill("#win-from", "10");
    await page.dispatchEvent("#win-from", "input");
    await page.fill("#win-to", "12.25");
    await page.dispatchEvent("#win-to", "input");
    await page.click("#sign");
    await page.waitForSelector("#debrief");
    await page.$eval("#debrief", (el) => el.scrollIntoView({ block: "end" }));
    await shot("4-debrief");
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) problems.push(`${name}: horizontal overflow`);
    await ctx.close();
  }
  await browser.close();
  if (problems.length) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  console.log(`shots written to ${out}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
