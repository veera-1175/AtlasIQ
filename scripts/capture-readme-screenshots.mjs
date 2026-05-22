import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "docs", "screenshots");
const baseUrl = process.env.ATLASIQ_URL || "https://atlasiq-sunc.onrender.com";

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), fullPage: false });
  console.log("saved", name);
}

async function login(page, email, password) {
  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForTimeout(3000);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(1500);
  await shot(page, "01-login.png");

  await login(page, "admin@demo.acme.com", "Demo@2026");
  await shot(page, "02-company-admin-overview.png");

  const queryNav = page.getByText("Query Studio", { exact: true });
  if (await queryNav.count()) {
    await queryNav.first().click();
    await page.waitForTimeout(2000);
    await shot(page, "03-query-studio.png");

    const textarea = page.locator("textarea").first();
    if (await textarea.count()) {
      await textarea.fill("Which region had the highest revenue in Q1?");
      const runBtn = page.getByRole("button", { name: "Execute Query" });
      if (await runBtn.count()) {
        await runBtn.first().click();
        await page.waitForTimeout(15000);
        await shot(page, "04-query-results.png");
      }
    }
  }

  const teamNav = page.getByText("Team & Access", { exact: true });
  if (await teamNav.count()) {
    await teamNav.first().click();
    await page.waitForTimeout(1500);
    await shot(page, "05-team-admin.png");
  }

  await page.goto(`${baseUrl}/`, { waitUntil: "networkidle", timeout: 120000 });
  await page.evaluate(() => localStorage.clear());
  await login(page, "admin@atlasiq.io", "AtlasIQ@2026");
  await page.waitForTimeout(2000);
  await shot(page, "06-platform-admin.png");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
