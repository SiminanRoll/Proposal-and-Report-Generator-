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
  { id:"social", title:"Advantage Social Engagement", branch:"Advantage Technologies", category:"Marketing", stage:"Established", summary:"Source-driven engagement", context_items:["Social"], next_step:"Validate", evidence:"Registered source", skill_path:"skills/advantage-social-engagement/SKILL.md",
    knowledge_profile:{label:"Social Engagement",capabilities:["Technical response review","Qualified opportunities"],operations:["Inspect the actual post","Draft a factual helpful reply"],inputs:["Real public post","Verified actor"],outputs:["Qualification decision","Reply draft"],touches:["Facebook","Reddit"],boundaries:["No invented lead contact","No unapproved publishing"],related:[],source_path:"skills/advantage-social-engagement/SKILL.md",source_commit:"fixture"} },
  { id:"dev", title:"CLV System Modernization", branch:"Application Development", category:"Engineering", stage:"Established", summary:"Safe architecture", context_items:["GitHub"], next_step:"Test", evidence:"Registered source", skill_path:"skills/clv-system-modernization/SKILL.md" },
  { id:"bubblegum", title:"BubbleGum Server Engineering", branch:"Personal & Family", category:"Game development", stage:"Established", summary:"Paper server", context_items:["Paper"], next_step:"Playtest", evidence:"Registered source", skill_path:"skills/bubblegum-server-engineering/SKILL.md" },
  { id:"hammy", title:"Hammy Book Publishing", branch:"Hammy & The Strawberry", category:"Publishing", stage:"Starter", summary:"KDP publishing guidance", context_items:[], next_step:"Proof", evidence:"Registered source", skill_path:"skills/hammy-book-publishing/SKILL.md" }
];
// Full-size 31-skill fixture exercises the densest 12-capability branch without using owner data.
const stamp = "2026-11-21T23:28:44Z";
const addSkill = (id, title, branch) => ({
  id,title,branch,category:"Test fixture",stage:"Starter",
  summary:"Registered test skill",context_items:["Verified source"],
  next_step:"Validate",evidence:"Source-only fixture",skill_path:"skills/"+id+"/SKILL.md",updated_at:stamp
});
const allEntries = [
  ...entries.map(item=>({...item,updated_at:stamp})),
  ...Array.from({length:11},(_,i)=>addSkill("adv-test-"+i,"Advantage Capability "+(i+1),"Advantage Technologies")),
  ...Array.from({length:4},(_,i)=>addSkill("app-test-"+i,"Application Capability "+(i+1),"Application Development")),
  ...Array.from({length:2},(_,i)=>addSkill("core-test-"+i,"EVO Capability "+(i+1),"EVO Core")),
  addSkill("personal-test","Personal Skill 2","Personal & Family"),
  addSkill("hammy-living-world","Hammy Living World Engineering","Hammy & The Strawberry"),
  addSkill("hammy-social-automation","Hammy Social Automation & Continuity","Hammy & The Strawberry"),
  addSkill("hammy-reviewer-email-outreach","Hammy Reviewer Email Outreach","Hammy & The Strawberry"),
  addSkill("hammy-creative-studio","Hammy Creative Studio","Hammy & The Strawberry"),
  addSkill("brittany-business-brain","Brittany Business Brain","Brittany Myra"),
  addSkill("brittany-jewelry-storytelling","Brittany Jewelry Storytelling","Brittany Myra"),
  addSkill("brittany-makes-it-course","Brittany Makes It Course","Brittany Myra"),
  addSkill("brittany-business-operations","Brittany Business Operations","Brittany Myra"),
];
assert.equal(allEntries.length,31,"fixture must represent all registered EVO sources");

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
      value = allEntries;
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
    await page.getByLabel("Password").fill("browser-test-only");
    await page.getByRole("button", { name:"Sign in", exact:true }).click();
    await page.locator(".evo-neural-svg").waitFor();
    assert.equal(await page.locator(".evo-neural-clickable").count(),37,"six domains plus 31 skills");
    const points=await page.locator('g.evo-neural-clickable[aria-label^="Inspect "] circle:first-child').evaluateAll(circles=>
      circles.map(c=>({x:Number(c.getAttribute("cx")),y:Number(c.getAttribute("cy"))})));
    for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++)
      assert(Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y)>24,"31 nodes must not overlap");

    assert.equal(await page.locator(".evo-stats strong").first().innerText(),"31","31 mapped capabilities");
    assert.equal(await page.locator(".evo-stats strong").nth(1).innerText(),"31","31 registered source files");
    assert.equal(await page.locator('a.evo-back[href="/"]').count(),0,"no Client Compass navigation inside EVO");
    await page.getByRole("textbox",{name:"Search skills"}).fill("Technical response review");
    assert.equal(await page.locator(".evo-skill-list button").count(),1,"search covers structured capabilities");
    await page.locator(".evo-skill-list button").first().click();
    const inspector=await page.locator("#evo-skill-inspector").innerText();
    assert.match(inspector,/Social Engagement/,"short display label is used");
    assert.match(inspector,/what it covers/i);
    assert.match(inspector,/how it operates/i);
    assert.match(inspector,/operating boundaries/i);
    await page.getByRole("textbox",{name:"Search skills"}).fill("");
    await page.locator('g[aria-label="Inspect EVO Learn"]').click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Approval-gated skill teaching/);
    await page.locator(".evo-neural-legend").getByRole("button", {name:"Hammy & The Strawberry"}).click();
    assert.equal(await page.locator(".evo-skill-list button").count(),5,"five Hammy skills in branch");
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Hammy Book Publishing/,"inspector follows selected branch");
    assert.match(await page.locator(".evo-catalog-meta").innerText(),/Nov 21, 2026/,"real catalog freshness exposed");
    await page.getByRole("textbox", {name:"Search skills"}).fill("Hammy Living World");
    assert.equal(await page.locator(".evo-skill-list button").count(),1,"new specialist is searchable");
    await page.locator(".evo-skill-list button").first().click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Hammy Living World Engineering/);
    await page.locator(".evo-reload").click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Hammy Living World Engineering/,"reload preserves inspected skill");
    await page.getByRole("textbox",{name:"Search skills"}).fill("");
    await page.locator(".evo-neural-legend").getByRole("button",{name:"Brittany Myra"}).click();
    assert.equal(await page.locator(".evo-skill-list button").count(),4,"four Brittany skills remain independently filtered");
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Brittany Business Brain|Brittany Jewelry Storytelling|Brittany Makes It Course|Brittany Business Operations/);
    assert.match(await page.locator(".evo-footer").innerText(),/private business with its own source and permissions/);
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
    await mobile.getByLabel("Password").fill("browser-test-only");
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
