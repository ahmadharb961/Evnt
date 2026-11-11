// E2E: multi-merchant COD order is split per shop; merchant fulfils and records the cash collected.
const { chromium } = require("playwright");
const { execSync } = require("child_process");
const BASE = process.env.BASE || "http://localhost:3000";
const DB = process.env.DATABASE_URL || "postgresql://evnt:evnt@localhost:5432/evnt";
const sql = (q) => execSync(`psql "${DB}" -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const assert = (c, m) => { if (!c) throw new Error("ASSERT: " + m); };
async function login(p, email) {
  await p.goto(`${BASE}/login`);
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', "demo12345");
  await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.click('button[type="submit"]')]);
}
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  p.on("dialog", (d) => d.accept(d.type() === "prompt" ? "31" : undefined));
  await login(p, "parent@demo.evnt.local");
  for (const slug of ["wooden-rainbow-stacker", "muslin-swaddle-set"]) {
    await p.goto(`${BASE}/shop/p/${slug}`);
    await p.click('button:has-text("Add to cart")');
    await p.waitForSelector('button:has-text("Added to cart")');
  }
  await p.goto(`${BASE}/cart`);
  assert((await p.innerText("main")).includes("2 deliveries"), "cart split into 2 deliveries");
  await p.goto(`${BASE}/cart/checkout`);
  await p.selectOption('select[name="area"]', "achrafieh");
  await p.fill('input[name="address"]', "Sursock street");
  await p.fill('input[name="building"]', "Blue building");
  await Promise.all([p.waitForURL(/\/account\/orders\//), p.click('button[type="submit"]')]);
  const group = p.url().split("/account/orders/")[1].split("?")[0];
  const orders = sql(`select o.number from "Order" o join "OrderGroup" g on g.id=o."groupId" where g.number='${group}'`).split("\n");
  assert(orders.length === 2, "two merchant orders, got " + orders.length);
  console.log("group", group, "orders", orders);
  const toyOrder = sql(`select o.number from "Order" o join "OrderGroup" g on g.id=o."groupId" join "Merchant" m on m.id=o."merchantId" where g.number='${group}' and m.slug='toybox-beirut'`);
  // Revenue must not count an uncollected COD order
  assert(sql(`select count(*) from "Commission" c join "Order" o on o.id=c."sourceId" where o.number='${toyOrder}'`) === "0", "no commission before cash is collected");
  const m = await (await b.newContext()).newPage();
  m.on("dialog", (d) => d.accept(d.type() === "prompt" ? "31" : undefined));
  await login(m, "toybox-beirut@demo.evnt.local");
  for (const label of ["Confirm order", "Mark shipped", "Delivered & cash collected"]) {
    await m.goto(`${BASE}/merchant/orders/${toyOrder}`);
    await m.click(`button:has-text("${label}")`);
    await m.waitForTimeout(1200);
  }
  const status = sql(`select status||'|'||coalesce("codCollectedCents",0) from "Order" where number='${toyOrder}'`);
  assert(status === "DELIVERED|3100", "delivered with $31 collected, got " + status);
  const comm = sql(`select "amountCents"||'|'||"rateBps" from "Commission" c join "Order" o on o.id=c."sourceId" where o.number='${toyOrder}'`);
  console.log("commission (cents|bps):", comm);
  assert(comm === "280|1000", "Pro retail commission 10% of $28 = 280");
  await b.close();
  console.log("E2E shop: PASS");
})().catch((e) => { console.error(e); process.exit(1); });
