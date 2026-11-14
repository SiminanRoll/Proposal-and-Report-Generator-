/* EVO Brain static-export browser acceptance. No real user credentials are used. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { chromium } = require("playwright");

const exportRoot = path.resolve(__dirname, "../out");
assert(fs.existsSync(path.join(exportRoot, "evo-brain", "index.html")), "EVO Brain must be exported as HTML");
const types = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "application/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2" };

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  const requested = pathname.endsWith("/") ? pathname + "index.html" : (path.extname(pathname) ? pathname : pathname + "/index.html");
  const filePath = path.resolve(exportRoot, "." + requested);
  if (!filePath.startsWith(exportRoot + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404); res.end("Not found"); return;
  }
  res.writeHead(200, { "content-type": types[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
});

const entries = [
  { id:"evo-learn", title:"EVO Learn", branch:"EVO Core", category:"Knowledge operations", stage:"Established", summary:"Approval-gated skill teaching", context_items:["Catalog"], next_step:"Review source", evidence:"Registered source", skill_path:"skills/evo-learn/SKILL.md" },
  { id:"social", title:"Advantage Social Engagement", branch:"Advantage Technologies", category:"Marketing", stage:"Established", summary:"Source-driven engagement", context_items:["Social"], next_step:"Validate", evidence:"Registered source", skill_path:"skills/advantage-social-engagement/SKILL.md" },
  { id:"dev", title:"CLV System Modernization", branch:"Application Development", category:"Engineering", stage:"Established", summary:"Safe architecture", context_items:["GitHub"], next_step:"Test", evidence:"Registered source", skill_path:"skills/clv-system-modernization/SKILL.md" },
  { id:"bubblegum", title:"BubbleGum Server Engineering", branch:"Personal & Family", category:"Game development", stage:"Established", summary:"Paper server", context_items:["Paper"], next_step:"Playtest", evidence:"Registered source", skill_path:"skills/bubblegum-server-engineering/SKILL.md" },
  { id:"hammy", title:"Hammy Publishing", branch:"Hammy & The Strawberry", category:"Publishing", stage:"Proposed", summary:"Candidate publishing skills", context_items:[], next_step:"Approve", evidence:"Not registered", skill_path:null }
];
async function mockSupabase(page) {
  await page.route("https://cqhqbucjzgijhskupnlw.supabase.co/**", async (route) => {
    const request = route.request();
    const pathname = new URL(request.url()).pathname;
    const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization, apikey, content-type", "access-control-allow-methods": "GET, POST, OPTIONS" };
    if (request.method() === "OPTIONS") { await route.fulfill({ status:204, headers:cors }); return; }
    let value, status = 200;
    if (pathname === "/auth/v1/token") {
      value = { access_token:"fixture-access", refresh_token:"fixture-refresh", expires_in:3600 };
    } else if (pathname === "/auth/v1/user") {
      value = { id:"fixture-user", email:"Patricb@live.com" };
    } else if (pathname === "/rest/v1/evo_brain_entries") {
      value = entries;
    } else if (pathname === "/auth/v1/logout") {
      value = {};
    } else {
      value = { error:"Unmocked Supabase path" }; status = 404;
    }
    await route.fulfill({ status, contentType:"application/json", headers:cors, body:JSON.stringify(value) });
  });
}

(async () => {
  await new Promise((resolve) => server.listen(0,"127.0.0.1",resolve));
  let browser;
  try {
    browser = await chromium.launch({ headless:true, args:["--no-sandbox"] });
    const errors = [];
    const base = "http://127.0.0.1:" + server.address().port + "/evo-brain/";
    const page = await browser.newPage({ viewport:{width:1440,height:920},deviceScaleFactor:1 });
    page.on("pageerror", (e) => errors.push(String(e)));
    await mockSupabase(page);
    await page.goto(base);
    await page.getByRole("textbox", { name:"Email" }).waitFor();
    assert.equal(await page.getByRole("textbox", { name:"Email" }).inputValue(), "Patricb@live.com");
    await page.getByRole("textbox", { name:"Password" }).fill("browser-test-only");
    await page.getByRole("button", { name:"Sign in", exact:true }).click();
    await page.locator(".evo-neural-svg").waitFor();
    assert.equal(await page.locator(".evo-neural-clickable").count(),10,"five domains plus five skills");
    assert.match(await page.locator(".evo-stats").innerText(),/5[\s\S]*5/);
    await page.locator('g[aria-label="Inspect EVO Learn"]').click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Approval-gated skill teaching/);
    await page.locator(".evo-neural-legend").getByRole("button", {name:"Hammy & The Strawberry"}).click();
    assert.equal(await page.locator(".evo-skill-list button").count(),1,"branch filter applied");
    await page.getByRole("textbox", {name:"Search skills"}).fill("nonexistent");
    assert.equal(await page.locator(".evo-skill-list button").count(),0,"search filter applied");
    await page.getByRole("textbox", {name:"Search skills"}).fill("");
    await page.screenshot({path:path.resolve(__dirname,"../artifacts/evo-brain/desktop.png"),fullPage:true});
    await page.getByRole("button", {name:"Sign out"}).click();
    await page.getByRole("button", {name:"Sign in", exact:true}).waitFor();
    fs.mkdirSync(path.resolve(__dirname,"../artifacts/evo-brain"),{recursive:true});
    const mobile=await browser.newPage({ viewport:{width:390,height:844},deviceScaleFactor:1 });
    mobile.on("pageerror",e=>errors.push(String(e)));
    await mockSupabase(mobile);
    await mobile.goto(base);
    await mobile.getByRole("textbox", {name:"Password"}).fill("browser-test-only");
    await mobile.getByRole("button", {name:"Sign in",exact:true}).click();
    await mobile.locator(".evo-neural-svg").waitFor();
    const scroll=await mobile.locator(".evo-neural-scroll").boundingBox();
    assert(scroll && scroll.width <= 390,"mobile SVG must scroll inside screen width");
    await mobile.locator('g[aria-label="Inspect EVO Learn"]').click({force:true});
    assert.match(await mobile.locator("#evo-skill-inspector").innerText(),/Approval-gated/);
    await mobile.screenshot({path:path.resolve(__dirname,"../artifacts/evo-brain/mobile.png"),fullPage:true});
    assert.deepEqual(errors,[],"no browser script exceptions");
    console.log("PASS: compiled route, Supabase mock login, neural graph, inspector, domain filter, search, sign-out and mobile viewport");
  } finally {
    if(browser) await browser.close();
    server.close();
  }
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
