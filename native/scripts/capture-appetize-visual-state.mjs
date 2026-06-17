import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { PNG } from "pngjs";

const defaultScreens = [
  "talk-active",
  "talk-idle",
  "talk-type",
  "matches",
  "match-detail",
  "profile",
  "verification",
  "chat",
  "wali",
  "settings",
].join(",");
const screens = (process.env.VISUAL_SCREENS || defaultScreens)
  .split(",")
  .map((screen) => screen.trim())
  .filter(Boolean);
const outDir = process.env.VISUAL_CAPTURE_DIR || "native/build/visual-captures";
const androidUrl = normalizeAppetizeUrl(
  process.env.APPETIZE_ANDROID_URL || "",
  process.env.APPETIZE_ANDROID_PUBLIC_KEY || "",
);
const iosUrl = normalizeAppetizeUrl(
  process.env.APPETIZE_IOS_URL || "",
  process.env.APPETIZE_IOS_PUBLIC_KEY || "",
);
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
    const readiness = await waitForReadyFrame(page, target, platform.key, screen);
    const box = await target.boundingBox();
    await target.screenshot({ path: screenPath });
    await page.screenshot({ path: pagePath, fullPage: true });
    console.log(`[ok] ${platform.key} ${screen} ${screenPath} ${formatStats(readiness)}`);
    return {
      ok: true,
      platform: platform.key,
      screen,
      url,
      screenPath,
      pagePath,
      box,
      readiness,
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

async function waitForReadyFrame(page, target, platform, screen) {
  const started = Date.now();
  let lastStats = null;

  while (Date.now() - started < 120_000) {
    const buffer = await target.screenshot();
    lastStats = readFrameStats(buffer);
    if (frameLooksReady(platform, screen, lastStats)) return lastStats;
    await page.waitForTimeout(5_000);
  }

  throw new Error(
    `Appetize frame never reached the expected app state for ${platform} ${screen}; last ${formatStats(lastStats)}`,
  );
}

function readFrameStats(buffer) {
  const png = PNG.sync.read(buffer);
  const step = Math.max(1, Math.floor(Math.min(png.width, png.height) / 120));
  let samples = 0;
  let luminanceTotal = 0;
  let dark = 0;
  let light = 0;
  let saturated = 0;

  for (let y = 0; y < png.height; y += step) {
    for (let x = 0; x < png.width; x += step) {
      const offset = (png.width * y + x) << 2;
      const r = png.data[offset];
      const g = png.data[offset + 1];
      const b = png.data[offset + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      samples += 1;
      luminanceTotal += luminance;
      if (luminance < 45) dark += 1;
      if (luminance > 215) light += 1;
      if (max - min > 55 && max > 120) saturated += 1;
    }
  }

  return {
    meanLuminance: round(luminanceTotal / samples),
    darkRatio: round(dark / samples),
    lightRatio: round(light / samples),
    saturatedRatio: round(saturated / samples),
  };
}

function frameLooksReady(platform, screen, stats) {
  if (!stats) return false;
  if (screen.startsWith("talk-")) {
    return stats.darkRatio > 0.45 && stats.saturatedRatio > 0.008;
  }

  return stats.meanLuminance > 110 && stats.lightRatio > 0.2 && stats.saturatedRatio > 0.005;
}

function formatStats(stats) {
  if (!stats) return "stats=unavailable";
  return `stats=mean:${stats.meanLuminance},dark:${stats.darkRatio},light:${stats.lightRatio},sat:${stats.saturatedRatio}`;
}

function round(value) {
  return Math.round(value * 1_000) / 1_000;
}

function waitMs(platform, screen) {
  if (platform === "ios" && screen === "talk-idle") return 45_000;
  return 30_000;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function normalizeAppetizeUrl(rawUrl, publicKey) {
  const url = trimTrailingSlash(rawUrl.trim());
  if (url) return url;

  const key = publicKey.trim();
  return key ? `https://appetize.io/app/${key}` : "";
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
