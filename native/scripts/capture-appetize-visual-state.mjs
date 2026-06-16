import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";

const screens = (process.env.VISUAL_SCREENS || "match-detail")
  .split(",")
  .map((screen) => screen.trim())
  .filter(Boolean);
const outDir = process.env.VISUAL_CAPTURE_DIR || "native/build/visual-captures";
const androidUrl = trimTrailingSlash(process.env.APPETIZE_ANDROID_URL || "");
const iosUrl = trimTrailingSlash(process.env.APPETIZE_IOS_URL || "");
const executablePath = process.env.CHROMIUM_EXECUTABLE || undefined;

if (!androidUrl && !iosUrl) {
  throw new Error("Set APPETIZE_ANDROID_URL or APPETIZE_IOS_URL before capturing.");
}
if (screens.length === 0) {
  throw new Error("VISUAL_SCREENS must include at least one screen key.");
}

fs.mkdirSync(outDir, { recursive: true });

const platforms = [
  androidUrl && {
    key: "android",
    viewport: { width: 520, height: 1080 },
    urlFor(screen) {
      const launchUrl = `justmarriage://visual?screen=${screen}`;
      return `${androidUrl}?autoplay=true&screenOnly=true&orientation=portrait&device=pixel4&launchUrl=${encodeURIComponent(launchUrl)}`;
    },
  },
  iosUrl && {
    key: "ios",
    viewport: { width: 560, height: 1120 },
    urlFor(screen) {
      const launchArgs = JSON.stringify(["-visual-screen", screen]);
      return `${iosUrl}?autoplay=true&screenOnly=true&orientation=portrait&device=iphone11pro&launchArgs=${encodeURIComponent(launchArgs)}`;
    },
  },
].filter(Boolean);

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ["--autoplay-policy=no-user-gesture-required"],
});

const results = [];
try {
  for (const platform of platforms) {
    for (const screen of screens) {
      results.push(await capture(platform, screen));
    }
  }
} finally {
  await browser.close();
}

const summaryPath = path.join(outDir, "capture-summary.json");
fs.writeFileSync(summaryPath, `${JSON.stringify(results, null, 2)}\n`);

const failures = results.filter((result) => !result.ok);
printSummary(results, summaryPath);
if (failures.length > 0) {
  process.exitCode = 1;
}

async function capture(platform, screen) {
  const page = await browser.newPage({
    viewport: platform.viewport,
    deviceScaleFactor: 2,
  });
  page.setDefaultTimeout(150_000);
  const url = platform.urlFor(screen);
  const prefix = `${platform.key}-${screen}`;
  const screenPath = path.join(outDir, `${prefix}-screen.png`);
  const pagePath = path.join(outDir, `${prefix}-page.png`);

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 150_000 });
    await page.waitForLoadState("networkidle", { timeout: 150_000 }).catch(() => {});
    const target = await findDeviceSurface(page);
    await page.waitForTimeout(waitMs(platform.key, screen));
    const box = await target.boundingBox();
    await target.screenshot({ path: screenPath });
    await page.screenshot({ path: pagePath, fullPage: true });
    console.log(`[ok] ${platform.key} ${screen} ${screenPath}`);
    return {
      ok: true,
      platform: platform.key,
      screen,
      url,
      screenPath,
      pagePath,
      box,
      capturedAt: new Date().toISOString(),
    };
  } catch (error) {
    await page.screenshot({ path: pagePath, fullPage: true }).catch(() => {});
    console.log(`[fail] ${platform.key} ${screen} ${String(error)}`);
    return {
      ok: false,
      platform: platform.key,
      screen,
      url,
      pagePath,
      error: String(error),
      capturedAt: new Date().toISOString(),
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function findDeviceSurface(page) {
  await page.waitForFunction(() => {
    function collect(root, acc = []) {
      if (!root.querySelectorAll) return acc;
      for (const node of root.querySelectorAll("video, canvas")) {
        acc.push(node);
      }
      for (const element of root.querySelectorAll("*")) {
        if (element.shadowRoot) collect(element.shadowRoot, acc);
      }
      return acc;
    }

    const candidates = collect(document)
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 100 && rect.height > 200 && rect.bottom > 0 && rect.right > 0);

    candidates.sort((a, b) => b.rect.width * b.rect.height - a.rect.width * a.rect.height);
    window.__captureTarget = candidates[0]?.element || null;
    return Boolean(window.__captureTarget);
  });

  const handle = await page.evaluateHandle(() => window.__captureTarget);
  const target = handle.asElement();
  if (!target) throw new Error("No Appetize device surface was found.");
  return target;
}

function waitMs(platform, screen) {
  if (platform === "ios" && screen === "talk-idle") return 45_000;
  return 30_000;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function printSummary(results, summaryPath) {
  const lines = [
    "### Native visual capture",
    "",
    `Summary: \`${summaryPath}\``,
    "",
    "| Platform | Screen | Result | Screenshot |",
    "| --- | --- | --- | --- |",
    ...results.map((result) => (
      `| ${result.platform} | ${result.screen} | ${result.ok ? "ok" : "failed"} | ${result.screenPath || result.pagePath || ""} |`
    )),
  ];

  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (summaryFile) {
    fs.appendFileSync(summaryFile, `${lines.join("\n")}\n`);
  }
  console.log(lines.join("\n"));
}
