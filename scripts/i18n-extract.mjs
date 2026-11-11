// Extracts every interface text from the source (t("…") calls, error messages, labels, notification texts)
// into src/i18n/keys.json. Used by the admin Localization page and by the translation-coverage test.
// Run: node scripts/i18n-extract.mjs
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const files = [];
(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name);
    if (f.isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(f.name) && !p.includes(`${path.sep}i18n${path.sep}`)) files.push(p);
  }
})(path.join(root, "src"));

const keys = new Set();
const unescape = (s) => s.replace(/\\"/g, '"').replace(/\\n/g, "\n").replace(/\\\\/g, "\\");
const patterns = [
  /\bt\(\s*"((?:[^"\\]|\\.)+)"/g, // t("…")
  /\bt\(\s*[^,()]+\?\s*"((?:[^"\\]|\\.)+)"\s*:\s*"((?:[^"\\]|\\.)+)"/g, // t(cond ? "a" : "b")
  /\bplural\(\s*[^,]+,\s*"((?:[^"\\]|\\.)+)",\s*"((?:[^"\\]|\\.)+)"/g,
  /new UserError\(\s*"((?:[^"\\]|\\.)+)"/g,
  /\b(?:title|body|label|error|en)\s*:\s*"((?:[^"\\]|\\.)+)"/g,
  /\b(?:title|body)\s*:\s*[^,"?]+\?\s*"((?:[^"\\]|\\.)+)"\s*:\s*"((?:[^"\\]|\\.)+)"/g, // title: cond ? "a" : "b"
  /\[\s*"((?:[^"\\]|\\.)+)",\s*"((?:[^"\\]|\\.)+)"\s*\]/g, // ["Title", "Body"] message pairs
];
// Files whose object values are interface labels (status maps, facility/service labels…)
const labelFiles = ["lib/status.ts", "lib/birthday.ts", "components/cards.tsx", "lib/phone.ts", "server/passwords.ts", "server/farah.ts", "app/admin/settings/page.tsx", "app/merchant/billing/page.tsx", "app/merchant/ads/page.tsx"];

for (const f of files) {
  const src = fs.readFileSync(f, "utf8");
  for (const re of patterns) for (const m of src.matchAll(re)) for (const g of m.slice(1)) if (g && /[A-Za-z]/.test(g)) keys.add(unescape(g));
  const rel = path.relative(path.join(root, "src"), f).split(path.sep).join("/");
  if (labelFiles.includes(rel)) {
    for (const m of src.matchAll(/:\s*"((?:[^"\\]|\\.)+)"/g)) if (/[a-z].*[a-z]/i.test(m[1]) && !/^[A-Z_]+$/.test(m[1]) && !m[1].startsWith("/") && !m[1].startsWith("#")) keys.add(unescape(m[1]));
    for (const m of src.matchAll(/return "((?:[^"\\]|\\.)+)"/g)) keys.add(unescape(m[1]));
  }
}
// Drop things that are clearly not prose
const out = [...keys].filter((k) => k.length < 600 && !/^(bg-|text-|h-|w-|https?:|[a-z]+\.[a-z]+$)/.test(k)).sort();
fs.writeFileSync(path.join(root, "src/i18n/keys.json"), JSON.stringify(out, null, 0));
console.log(`${out.length} keys`);
