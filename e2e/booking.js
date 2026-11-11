// E2E: a parent signs in, picks two theater seats, reserves (pay at venue), sees QR tickets.
// Then a second parent can't take the same seats. Run against a dev server with demo data.
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3000";
const assert = (c, m) => { if (!c) { throw new Error("ASSERT: " + m); } };

async function login(page, email) {
  await page.goto(`${BASE}/login`);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "demo12345");
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login")), page.click('button[type="submit"]')]);
}

(async () => {
  const browser = await chromium.launch();
  const a = await (await browser.newContext({ viewport: { width: 1300, height: 900 } })).newPage();
  await login(a, "parent@demo.evnt.local");
  await a.goto(`${BASE}/events/the-lantern-fox-family-musical`);
  await a.waitForSelector('svg[role="group"] g[role="button"]');
  const free = a.locator('svg[role="group"] g[role="button"][aria-disabled="false"]');
  const labels = [await free.nth(0).getAttribute("aria-label"), await free.nth(1).getAttribute("aria-label")];
  await free.nth(0).click();
  await free.nth(1).click();
  await a.click('aside button:has-text("Book now")');
  await a.waitForURL(/\/checkout\//);
  console.log("held seats", labels, "→", a.url());
  await a.click('button:has-text("Pay at the venue")');
  await a.check('input[name="policy"]');
  await Promise.all([a.waitForURL(/\/account\/bookings\//), a.click('button[type="submit"]:has-text("Reserve")')]);
  const qr = await a.locator('img[alt="Ticket QR code"]').count();
  assert(qr === 2, "two QR tickets, got " + qr);
  console.log("confirmed with", qr, "QR tickets:", a.url());

  // Second parent: those seats must show as unavailable.
  const ctx2 = await browser.newContext();
  const b = await ctx2.newPage();
  await b.goto(`${BASE}/register`);
  const email = `p${Date.now()}@test.local`;
  await b.fill('input[name="name"]', "Second Parent");
  await b.fill('input[name="email"]', email);
  await b.fill('input[name="phone"]', "70123456");
  await b.fill('input[name="password"]', "demo12345");
  await b.check('input[name="terms"]');
  await Promise.all([b.waitForURL(/\/account/), b.click('button[type="submit"]')]);
  await b.goto(`${BASE}/events/the-lantern-fox-family-musical`);
  await b.waitForSelector('svg[role="group"] g[role="button"]');
  for (const l of labels) {
    const dis = await b.locator(`svg[role="group"] g[role="button"][aria-label^="${l}"]`).first().getAttribute("aria-disabled");
    assert(dis === "true", `seat ${l} should be unavailable to the second parent`);
  }
  console.log("second parent sees seats as unavailable ✓");
  await browser.close();
  console.log("E2E booking: PASS");
})().catch((e) => { console.error(e); process.exit(1); });
