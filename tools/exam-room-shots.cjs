// Screenshots and a tap check for the exam room spike (spike/exam-room.html), headless only.
//
//   npm run build && python3 -m http.server 8847   (any static server that sends .wasm as application/wasm)
//   npm i --no-save playwright@1.61.1 && node tools/exam-room-shots.cjs http://127.0.0.1:8847/ docs/spike
//
// For each viewport (desktop 1280x800 at DPR 1, phone 400x860 at DPR 3 with touch) it shoots the
// room face up, taps the jaw and the near (right) arm with real pointer input (mouse click or touchscreen tap) at the
// on-screen position of each region's anchor and checks the event that fired, turns the body,
// taps the back, and shoots face down. Exit code 1 if any tap fired the wrong event.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const base = process.argv[2] || "http://127.0.0.1:8847/";
const out = process.argv[3] || path.join(__dirname, "..", "docs", "spike");
fs.mkdirSync(out, { recursive: true });

const VIEWS = [
  { name: "desktop", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: false, isMobile: false },
  { name: "phone", viewport: { width: 400, height: 860 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
];

async function waitFrames(page, n) {
  await page.evaluate((k) => new Promise((res) => { let i = 0; const f = () => (++i >= k ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
}

async function tap(page, view, region) {
  const at = await page.evaluate((r) => window.__exam.anchorClient(r), region);
  if (!at) return { region, fired: null, ok: false, why: "off screen" };
  const before = await page.evaluate(() => window.__exam.log.length);
  if (view.hasTouch) await page.touchscreen.tap(at.x, at.y);
  else await page.mouse.click(at.x, at.y);
  await waitFrames(page, 2);
  const ev = await page.evaluate((n) => window.__exam.log[n] || null, before);
  return { region, at, fired: ev, ok: !!ev && ev.region === region && ev.via === "tap" };
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  const results = [];
  try {
    for (const view of VIEWS) {
      const ctx = await browser.newContext({ viewport: view.viewport, deviceScaleFactor: view.deviceScaleFactor, hasTouch: view.hasTouch, isMobile: view.isMobile });
      const page = await ctx.newPage();
      page.setDefaultTimeout(240000); // software rendering on a busy machine is slow
      const logs = [];
      page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(`${m.type()}: ${m.text()}`); });
      page.on("pageerror", (e) => logs.push(`pageerror: ${e.message}`));
      // the engine's main loop keeps "load" from firing: wait for the page's own readiness instead
      await page.goto(base + "spike/exam-room.html?quality=0&flashms=8000", { waitUntil: "commit" });
      await page.waitForFunction(() => window.__exam && window.__exam.mode !== "loading", null, { timeout: 180000 });
      const mode = await page.evaluate(() => window.__exam.mode);
      await waitFrames(page, 20);
      const shot = (n) => page.screenshot({ path: path.join(out, `${view.name}-${n}.jpg`), type: "jpeg", quality: 78, scale: "css" });
      await shot("face-up");
      const taps = [];
      taps.push(await tap(page, view, "jaw"));
      taps.push(await tap(page, view, "right-arm")); // the near arm: the far one hides behind the torso on desktop
      await shot("tap-right-arm");
      await page.click("#turn");
      await page.waitForFunction(() => !window.__exam.turning, null, { timeout: 60000 });
      await page.waitForFunction(() => !window.__exam.flashing); // let the tap flash fade
      await waitFrames(page, 3);
      await shot("face-down");
      taps.push(await tap(page, view, "back"));
      await shot("tap-back");
      const stats = await page.evaluate(() => ({ stats: window.__exam.stats, fps: window.__exam.fps, dpr: devicePixelRatio,
        canvas: (() => { const c = document.getElementById("view"); return { css: [c.clientWidth, c.clientHeight], drawable: [c.width, c.height] }; })() }));
      results.push({ view: view.name, mode, taps, stats, logs });
      console.error(JSON.stringify(results.at(-1)));
      await ctx.close();
    }
    // the fallback: no 3D, the list still drives the same events
    const ctx = await browser.newContext({ viewport: { width: 400, height: 860 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    page.setDefaultTimeout(240000);
    await page.goto(base + "spike/exam-room.html?fallback=1", { waitUntil: "commit" });
    await page.waitForFunction(() => window.__exam && window.__exam.mode === "list", null, { timeout: 60000 });
    await page.click('#regions button[data-region="back"]');
    const ev = await page.evaluate(() => window.__exam.log.at(-1));
    await page.screenshot({ path: path.join(out, "phone-fallback.jpg"), type: "jpeg", quality: 78, scale: "css" });
    results.push({ view: "fallback", mode: "list", taps: [{ region: "back", fired: ev, ok: ev && ev.region === "back" && ev.via === "list" }] });
    await ctx.close();
  } finally {
    await browser.close();
  }
  console.log(JSON.stringify(results, null, 2));
  const bad = results.flatMap((r) => r.taps.filter((t) => !t.ok));
  process.exit(bad.length ? 1 : 0);
})();
