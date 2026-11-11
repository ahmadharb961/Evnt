// Visits every page for a role and fails on HTTP errors or Next.js error overlays.
const { chromium } = require("playwright");
const BASE = process.env.BASE || "http://localhost:3000";
const [,, email, ...paths] = process.argv;
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  if (email && email !== "-") {
    await p.goto(`${BASE}/login`);
    await p.fill('input[name="email"]', email);
    await p.fill('input[name="password"]', email.includes("admin") ? "admin12345" : "demo12345");
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith("/login")), p.click('button[type="submit"]')]);
  }
  let bad = 0;
  for (const path of paths) {
    const r = await p.goto(BASE + path, { waitUntil: "domcontentloaded" });
    const body = await p.innerText("body").catch(() => "");
    const broken = r.status() >= 400 || /Unhandled Runtime Error|Application error|This page could not be found/.test(body);
    if (broken) bad++;
    console.log(`${broken ? "✗" : "✓"} ${r.status()} ${path}`);
  }
  if (errors.length) console.log("page errors:", errors.slice(0, 5));
  await b.close();
  process.exit(bad ? 1 : 0);
})();
