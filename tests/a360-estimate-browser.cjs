/* Synthetic, isolated browser acceptance for the A360 estimate presentation.
 * Run after `npm run build`, with Playwright and Chromium installed.
 * --baseline captures the previous layout without asserting the new icons/copy.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const baseline = process.argv.includes("--baseline");
const screenshotDirectory = path.resolve(process.env.OUT_DIR || path.join(root, "artifacts/a360-estimate"));
const staticDirectory = path.join(root, "out");
const projectKey = "advantage.proposal-report-generator.projects.v2";
const cache = new Map();

function load(relative) {
  let file = path.isAbsolute(relative) ? relative : path.join(root, relative);
  if (!path.extname(file)) file = [file + ".ts", file + ".tsx", path.join(file, "index.ts")].find(fs.existsSync);
  if (!file) throw new Error(`Missing fixture module: ${relative}`);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const localRequire = (specifier) => specifier.startsWith("@/")
    ? load(path.join(root, "src", specifier.slice(2)))
    : specifier.startsWith(".") ? load(path.resolve(path.dirname(file), specifier)) : require(specifier);
  new Function("module", "exports", "require", js)(module, module.exports, localRequire);
  return module.exports;
}

function fixture(changes = {}) {
  const { emptyA360Prospect } = load("src/lib/prospects/a360.ts");
  const { buildA360ConversationRecord, createA360ConversationProject } = load("src/lib/prospects/a360-conversation.ts");
  const discovery = {
    ...emptyA360Prospect(), contactName: "Example Contact", organizationName: "Example Practice",
    organizationLanguage: "practice", industry: "Dental", priorities: ["Better support", "Cybersecurity"],
    workstations: 14, locations: 1, server: "yes", managementSoftware: "Example Management",
    imagingSoftware: "Example Imaging", imagingEnvironment: "2D + 3D", otherSoftware: "Example Accounting", ...changes,
  };
  const project = createA360ConversationProject(buildA360ConversationRecord({
    handoffId: "a360-visual-acceptance", discovery,
    estimate: { low: 1350, high: 1530, assumptions: ["Synthetic example for visual acceptance."] },
    appointment: null, contactEmail: "", contactPhone: "",
  }));
  project.a360Conversation.presentationIndex = 6;
  return project;
}

function staticServer() {
  const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".woff2": "font/woff2" };
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(staticDirectory, "." + pathname);
    if (!file.startsWith(staticDirectory + path.sep) && file !== staticDirectory) {
      response.writeHead(403).end();
      return;
    }
    const candidate = [file, path.join(file, "index.html"), file + ".html"].find((entry) => fs.existsSync(entry) && fs.statSync(entry).isFile());
    if (!candidate) { response.writeHead(404).end(); return; }
    response.writeHead(200, { "Content-Type": mime[path.extname(candidate)] || "application/octet-stream" });
    fs.createReadStream(candidate).pipe(response);
  });
}

async function openPresentation(browser, origin, item) {
  const project = fixture(item.changes);
  const context = await browser.newContext({ viewport: item.viewport, reducedMotion: item.motion || "no-preference" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, value), { key: projectKey, value: JSON.stringify([project]) });
  await page.goto(origin, { waitUntil: "domcontentloaded" });
  await page.locator(".prospect-a360-button").first().click();
  await page.locator(".prospect-launcher").getByRole("button", { name: /^Example Practice · Draft/ }).click();
  await page.locator(".prospect-estimate-slide").waitFor({ state: "visible" });
  return { page, context, project, errors };
}

async function cardMotion(page) {
  return page.evaluate(() => [...document.querySelectorAll(".prospect-estimate-service-grid li")].flatMap((card) => card.getAnimations({ subtree: true }).map((animation) => ({
    name: animation.animationName, state: animation.playState,
    iterations: animation.effect.getTiming().iterations, duration: animation.effect.getTiming().duration,
    delay: animation.effect.getTiming().delay, tag: animation.effect.target.tagName,
  }))));
}

async function inspect(page) {
  return page.evaluate((key) => {
    const stage = document.querySelector(".prospect-presentation .presentation-stage");
    const section = document.querySelector(".prospect-estimate-slide");
    const cards = [...section.querySelectorAll(".prospect-estimate-service-grid li")];
    const stageBounds = stage.getBoundingClientRect();
    const ancestors = [];
    for (let element = section; element && element !== stage; element = element.parentElement) {
      ancestors.push({ className: element.className, overflowY: getComputedStyle(element).overflowY, clientHeight: element.clientHeight, scrollHeight: element.scrollHeight });
    }
    return {
      stage: { width: stage.clientWidth, height: stage.clientHeight, scrollWidth: stage.scrollWidth, scrollHeight: stage.scrollHeight, top: stageBounds.top },
      price: section.querySelector("h2").innerText,
      scope: section.querySelector(".prospect-estimate-scope-note").innerText,
      software: section.querySelector(".prospect-estimate-software").innerText,
      cards: cards.map((card) => ({
        text: card.innerText, top: card.getBoundingClientRect().top,
        icons: [...card.querySelectorAll("svg")].map((svg) => ({
          hidden: svg.getAttribute("aria-hidden"), focusable: svg.getAttribute("focusable"),
          width: svg.getBoundingClientRect().width, height: svg.getBoundingClientRect().height,
        })),
      })),
      ancestors,
      saved: JSON.parse(localStorage.getItem(key))[0].a360Conversation,
    };
  }, projectKey);
}

async function capture(page, name) {
  await page.screenshot({ path: path.join(screenshotDirectory, `${baseline ? "before" : "after"}-${name}.png`) });
  const needsScroll = await page.locator(".prospect-presentation .presentation-stage").evaluate((stage) => stage.scrollHeight > stage.clientHeight + 1);
  if (needsScroll) {
    await page.locator(".prospect-presentation .presentation-stage").evaluate((stage) => { stage.scrollTop = stage.scrollHeight; });
    await page.screenshot({ path: path.join(screenshotDirectory, `${baseline ? "before" : "after"}-${name}-bottom.png`) });
  }
}

(async () => {
  assert.ok(fs.existsSync(path.join(staticDirectory, "index.html")), "Build the static application before browser acceptance");
  fs.mkdirSync(screenshotDirectory, { recursive: true });
  const server = staticServer();
  await new Promise((resolve, reject) => { server.once("error", reject); server.listen(4173, "127.0.0.1", resolve); });
  let browser;
  const report = [];
  try {
    browser = await chromium.launch({ headless: true });
    const cases = [
      { name: "desktop-1440", viewport: { width: 1440, height: 900 } },
      { name: "laptop-1366", viewport: { width: 1366, height: 768 } },
      { name: "tablet-1024", viewport: { width: 1024, height: 768 } },
      { name: "mobile-390", viewport: { width: 390, height: 844 } },
      { name: "no-server", viewport: { width: 1366, height: 768 }, changes: { server: "no" } },
      { name: "unknown-server", viewport: { width: 1366, height: 768 }, changes: { server: "not-sure", workstations: 0, managementSoftware: "", imagingSoftware: "", imagingEnvironment: "", otherSoftware: "" } },
      { name: "reduced-motion", viewport: { width: 1366, height: 768 }, motion: "reduce" },
      { name: "long-software", viewport: { width: 1024, height: 768 }, changes: { managementSoftware: "Example Management Platform With Multiple Department Workflows and Location Tools", imagingSoftware: "Example Imaging Application with Advanced Three Dimensional Workflows", otherSoftware: "Example Accounting, Phone Systems, Payments, Collaboration and Specialty Applications" } },
    ];
    for (const item of cases) {
      const { page, context, project, errors } = await openPresentation(browser, "http://127.0.0.1:4173/", item);
      try {
        const entrance = await cardMotion(page);
        await page.waitForTimeout(1800);
        const settled = await cardMotion(page);
        const result = await inspect(page);
        await capture(page, item.name);
        const entry = { name: item.name, ...result, entrance, settled, errors };
        delete entry.saved;
        report.push(entry);
        assert.equal(errors.length, 0, `${item.name}: no browser errors`);
        assert.deepEqual(result.saved.estimate, project.a360Conversation.estimate, `${item.name}: preserve the saved estimate`);
        assert.deepEqual(result.saved.discovery, project.a360Conversation.discovery, `${item.name}: preserve discovery details`);
        assert.equal(result.cards.length, item.changes?.server && item.changes.server !== "yes" ? 5 : 6, `${item.name}: conditional server coverage`);
        assert.match(result.price, /1,350.*1,530/s, `${item.name}: show the saved estimate`);
        if (!baseline) {
          assert.ok(result.stage.scrollWidth <= result.stage.width + 1, `${item.name}: no horizontal stage overflow`);
          assert.ok(result.cards[0].top >= result.stage.top - 1, `${item.name}: content starts within the scrollable stage`);
          assert.ok(result.ancestors.every((element) => element.scrollHeight <= element.clientHeight + 1 || !["auto", "scroll", "hidden", "clip"].includes(element.overflowY)), `${item.name}: the stage owns vertical scrolling`);
          assert.ok(result.cards.every((card) => card.icons.length === 1), `${item.name}: one icon per service`);
          assert.ok(result.cards.flatMap((card) => card.icons).every((icon) => icon.hidden === "true" && icon.focusable === "false" && icon.width > 0 && icon.height > 0), `${item.name}: decorative icons remain visible and non-focusable`);
          assert.ok(result.cards.reduce((count, card) => count + card.text.trim().split(/\s+/).length, 0) <= 85, `${item.name}: concise service cards`);
          assert.ok(entrance.every((animation) => animation.iterations === 1), `${item.name}: no repeating icon motion`);
          assert.ok(settled.every((animation) => animation.state !== "running"), `${item.name}: icon motion settles`);
          if (item.motion === "reduce") assert.equal(entrance.length, 0, "Reduced motion suppresses icon animations");
          else assert.ok(entrance.length > 0, `${item.name}: one-shot icon motion is present`);
          if (item.changes?.server === "not-sure") assert.match(result.scope, /server.*confirm/i, "Unknown server scope remains explicit");
        }
        if (baseline && item.name === "desktop-1440") {
          for (const [name, label] of [["welcome-reference", "Welcome"], ["your-a360-reference", "Your A360"]]) {
            await page.locator(".presentation-progress-nav").getByRole("button", { name: label, exact: true }).click();
            await page.waitForTimeout(1200);
            await page.screenshot({ path: path.join(screenshotDirectory, `${name}.png`) });
          }
        }
        console.log(`PASS ${item.name}: ${result.cards.length} services, ${result.stage.scrollWidth}/${result.stage.width}px stage width, saved estimate preserved`);
      } catch (error) {
        await page.screenshot({ path: path.join(screenshotDirectory, `failure-${item.name}.png`) });
        throw error;
      } finally { await context.close(); }
    }
  } finally {
    fs.writeFileSync(path.join(screenshotDirectory, `${baseline ? "before" : "after"}-metrics.json`), JSON.stringify(report, null, 2));
    if (browser) await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
