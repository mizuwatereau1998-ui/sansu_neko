const { chromium } = require("playwright");
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
    args: ["--no-sandbox"],
  });
  const page = await browser.newPage({
    viewport: { width: 820, height: 1000 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("http://127.0.0.1:8000");
  await page.waitForTimeout(800);
  // Rigid rotation keeps the same cat-to-cat distances, including rapid direction changes.
  await page.locator("#handle").focus();
  await page.keyboard.press("ArrowRight");
  for (let n = 0; n < 6; n++) {
    const min = await page.locator("#cats").evaluate((el) => {
      const pts = [...el.children].map((c) => {
        const m = c.transform.baseVal.consolidate().matrix;
        return { x: m.e + 24 * m.a, y: m.f + 24 * m.d };
      });
      let min = Infinity;
      pts.forEach((p, i) =>
        pts
          .slice(i + 1)
          .forEach(
            (q) => (min = Math.min(min, Math.hypot(p.x - q.x, p.y - q.y))),
          ),
      );
      return min;
    });
    assert.ok(min > 47.9, `cat distance ${min}`);
    await page.waitForTimeout(30);
  }
  // Reset before the clear delay cancels the pending clear screen.
  await page.locator("#reset").click();
  await page.waitForTimeout(1000);
  assert.equal(await page.locator("#clear-dialog").isVisible(), false);
  assert.equal(
    await page.locator("#handle").getAttribute("aria-valuenow"),
    "0",
  );
  // Pointer cancellation restores the pre-drag layout without marking it complete.
  const h = await page.locator("#handle").boundingBox();
  await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
  await page.mouse.down();
  await page.mouse.move(h.x + h.width / 2 + 70, h.y + h.height / 2);
  await page
    .locator("#handle")
    .dispatchEvent("pointercancel", { pointerId: 1 });
  await page.mouse.up();
  assert.equal(
    await page.locator("#handle").getAttribute("aria-valuenow"),
    "0",
  );
  // Review and reopen a successful stage, then continue.
  await page.locator("#handle").focus();
  await page.keyboard.press("ArrowRight");
  await page.locator("#clear-dialog").waitFor({ state: "visible" });
  await page.locator("#look").click();
  await page.locator("#continue").click();
  assert.equal(await page.locator("#clear-dialog").isVisible(), true);
  await page.locator("#next").click();
  // The line itself can be dragged, not only the separate handle.
  const point = async (x, y) =>
    page.locator("#board").evaluate(
      (n, p) => {
        const q = new DOMPoint(p.x, p.y).matrixTransform(n.getScreenCTM());
        return { x: q.x, y: q.y };
      },
      { x, y },
    );
  const start = await point(380, 127),
    end = await point(380, 175);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, { steps: 8 });
  await page.mouse.up();
  assert.equal(await page.locator("#board").getAttribute("data-split"), "2");
  await page.locator('[data-stage="2"]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "/tmp/neko-stage3.png", fullPage: true });
  assert.deepEqual(errors, []);
  console.log(
    "Rigid spacing, canceled drag, canceled delayed clear, reopen, divider hit area all passed",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
