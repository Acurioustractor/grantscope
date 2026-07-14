import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const base = path.dirname(new URL(import.meta.url).pathname);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(base, "concepts.html")).href);

for (const id of ["focus-desk", "field-map", "relationship-studio"]) {
  await page.locator(`#${id}`).screenshot({ path: path.join(base, `${id}.png`) });
}

await browser.close();
