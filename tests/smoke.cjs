// Run: node tests/smoke.cjs (requires Playwright; server on port 8000).
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const path = require("node:path"),
  os = require("node:os"),
  fs = require("node:fs");
(async () => {
  const browser = await chromium.launch({
    executablePath:
      process.env.CHROMIUM_PATH ||
      (fs.existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
    headless: true,
    args: ["--no-sandbox"],
  });
  for (const mobile of [false, true]) {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 1100 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:8000");
    await page.waitForTimeout(500);
    const point = async (x, y) =>
      page.locator("#board").evaluate(
        (n, p) => {
          const m = n.getScreenCTM();
          const v = new DOMPoint(p.x, p.y).matrixTransform(m);
          return { x: v.x, y: v.y };
        },
        { x, y },
      );
    const drag = async (x, y) => {
      await page.locator("#handle").scrollIntoViewIfNeeded();
      const h = await page.locator("#handle").boundingBox();
      const dest = await point(x, y);
      const start = { x: h.x + h.width / 2, y: h.y + h.height / 2 };
      if (mobile) {
        const cdp = await context.newCDPSession(page);
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [start],
        });
        for (let n = 1; n <= 12; n++)
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [
              {
                x: start.x + ((dest.x - start.x) * n) / 12,
                y: start.y + ((dest.y - start.y) * n) / 12,
              },
            ],
          });
        await cdp.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await cdp.detach();
      } else {
        await page.mouse.move(start.x, start.y);
        await page.mouse.down();
        await page.mouse.move(dest.x, dest.y, { steps: 15 });
        await page.mouse.up();
      }
    };
    assert.equal(await page.locator("[data-cat]").count(), 28);
    await page.screenshot({
      path: path.join(
        process.env.ARTIFACT_DIR || os.tmpdir(),
        `neko-${mobile ? "mobile" : "desktop"}.png`,
      ),
      fullPage: true,
    });
    // Partial turn and cancel must not count as a clear; every cat remains.
    await drag(490, 470);
    assert.equal(await page.locator("#board").getAttribute("data-cols"), "4");
    assert.equal(await page.locator("[data-cat]").count(), 28);
    await drag(600, 470);
    await page.locator("#clear-dialog").waitFor({ state: "visible" });
    assert.equal(await page.locator("#board").getAttribute("data-cols"), "7");
    assert.equal(await page.locator("#board").getAttribute("data-rows"), "4");
    assert.match(await page.locator("#proof").innerText(), /4 × 7 ＝ 28/);
    await page.locator("#next").click();
    assert.equal(await page.locator("[data-cat]").count(), 28);
    await drag(541, 62 + 2 * 48 + 17);
    assert.equal(await page.locator("#board").getAttribute("data-split"), "2");
    assert.match(await page.locator("#formula").innerText(), /2 × 4/);
    assert.equal(await page.locator("#clear-dialog").isVisible(), false);
    await drag(541, 62 + 3 * 48 + 17);
    await page.locator("#clear-dialog").waitFor({ state: "visible" });
    assert.match(await page.locator("#group-counts").innerText(), /12ひき/);
    await page.locator("#next").click();
    assert.equal(await page.locator("[data-cat]").count(), 48);
    await drag(511, 32 + 10 * 33 + 17);
    await page.locator("#clear-dialog").waitFor({ state: "visible" });
    assert.match(await page.locator("#group-counts").innerText(), /40ひき/);
    assert.match(await page.locator("#group-counts").innerText(), /8ひき/);
    assert.match(await page.locator("#proof").innerText(), /40.*8/s);
    await page.locator("#next").click();
    assert.match(await page.locator("#clear-title").innerText(), /名人/);
    await page.locator("#next").click();
    assert.equal(await page.locator("#board").getAttribute("data-cols"), "4");
    await page.locator('[data-stage="1"]').click();
    await page.locator("#handle").focus();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#board").getAttribute("data-split"), "2");
    await page.locator("#reset").click();
    assert.equal(await page.locator("#board").getAttribute("data-split"), "1");
    await page.locator("#hint").click();
    assert.equal(await page.locator("#hint-text").isVisible(), true);
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
    );
    assert.deepEqual(errors, []);
    console.log(
      `${mobile ? "Touch / 390px" : "Mouse / 1280px"}: all 3 stages, counts, formulas, reset, hint, keyboard, results passed`,
    );
    await context.close();
  }
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
