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
    assert.equal(await page.locator('a[href="/"]').count(),0,"EVO must not navigate back to Client Compass");
    assert.equal(await page.locator(".evo-page-heading .evo-head-metrics strong").nth(1).innerText(),"31","31 canonical skills");
    assert.equal(await page.locator(".evo-domain-card").count(),6,"six dedicated domain cards, not duplicate skill rows");
    assert.equal(await page.locator(".evo-domain-node").count(),6,"atlas opens at six readable domains");
    assert.equal(await page.locator(".evo-skill-node").count(),0,"all 31 labels are not crowded into overview");
    assert.equal(await page.locator(".evo-hero").count(),0,"no giant introductory hero");
    assert.match(await page.locator(".evo-catalog-meta").innerText(),/Nov 21, 2026/,"catalog timestamp labeled as metadata update");

    // Zoom into a dense domain, then inspect an actual capability within the same viewport.
    await page.locator('g[aria-label="Advantage Technologies, 12 capabilities"]').click();
    assert.equal(await page.locator(".evo-skill-node").count(),12,"all 12 Advantage skills are visible in focused map");
    assert.equal(await page.locator(".evo-skill-card").count(),12,"library reflects focused domain");
    const rects = await page.locator(".evo-skill-node rect").evaluateAll(elements =>
      elements.map(el => ({ x: Number(el.getAttribute("x")), y: Number(el.getAttribute("y")),
        w: Number(el.getAttribute("width")), h: Number(el.getAttribute("height")) })));
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      const A=rects[i],B=rects[j];
      assert(A.x+A.w+6 <= B.x || B.x+B.w+6 <= A.x || A.y+A.h+6 <= B.y || B.y+B.h+6 <= A.y,
        "focused skill cards must not overlap");
    }
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Advantage Technologies/,"domain details in adjacent inspector");
    await page.locator('g[aria-label="Inspect Social Engagement"]').click();
    const inspector = await page.locator("#evo-skill-inspector").innerText();
    assert.match(inspector,/Social Engagement/,"short display name used");
    assert.match(inspector,/CAPABILITIES/i);
    assert.match(inspector,/HOW IT OPERATES/i);
    assert.match(inspector,/OPERATING BOUNDARIES/i);
    assert.match(inspector,/No unapproved publishing/);
    await page.locator(".evo-knowledge-more summary").click();
    assert.match(await page.locator(".evo-knowledge-columns").innerText(),/Facebook|Reddit/,"inputs/outputs/systems can be inspected");

    // Search is global and matches structured knowledge, not just old display titles.
    await page.getByRole("searchbox",{name:"Search skills"}).fill("Technical response review");
    assert.equal(await page.locator(".evo-skill-card").count(),1,"global capability search narrows skill cards");
    assert.equal(await page.locator(".evo-domain-node").count(),6,"search returns to all-domain atlas");
    await page.locator(".evo-skill-card").first().click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Social Engagement/);
    await page.locator(".evo-neural-legend").getByRole("button",{name:/All domains/}).click();
    assert.equal(await page.locator(".evo-domain-card").count(),6,"all-domains reset restores overview");

    // Users can switch domains without losing privacy or cross-tenant boundaries.
    await page.locator(".evo-neural-legend").getByRole("button",{name:/Hammy/}).click();
    assert.equal(await page.locator(".evo-skill-node").count(),5);
    assert.equal(await page.locator(".evo-skill-card").count(),5);
    await page.locator('g[aria-label="Inspect Hammy Living World Engineering"]').click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Hammy Living World Engineering/);
    await page.getByRole("button",{name:"Reload skills"}).click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Hammy Living World Engineering/,"manual reload preserves selection");
    await page.locator(".evo-neural-legend").getByRole("button",{name:/Brittany/}).click();
    assert.equal(await page.locator(".evo-skill-node").count(),4);
    assert.equal(await page.locator(".evo-skill-card").count(),4);
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Brittany Myra/);
    assert.match(await page.locator(".evo-footer").innerText(),/private skill bodies or external account data/);

    await page.locator(".evo-neural-legend").getByRole("button",{name:/All domains/}).click();
    await page.getByRole("combobox",{name:"Maturity"}).selectOption("Established");
    assert.equal(await page.locator(".evo-skill-card").count(),4,"maturity filtering is separate from domain and review claims");
    await page.getByRole("combobox",{name:"Maturity"}).selectOption("All");
    await page.getByRole("searchbox",{name:"Search skills"}).fill("nonexistent");
    assert.match(await page.locator(".evo-empty").innerText(),/No matching capabilities/);
    await page.getByRole("button",{name:"Clear filters"}).click();
    assert.equal(await page.locator(".evo-domain-card").count(),6);

    fs.mkdirSync(path.resolve(__dirname,"../artifacts/evo-brain"),{recursive:true});
    await page.screenshot({path:path.resolve(__dirname,"../artifacts/evo-brain/desktop.png"),fullPage:true});
    await page.getByRole("button",{name:"Sign out"}).click();
    await page.getByRole("button",{name:"Enter EVO Brain"}).waitFor();
    assert.equal(await page.locator(".evo-domain-card").count(),0,"sign out clears private catalog");

    const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    mobile.on("pageerror",e=>errors.push(String(e)));
    await mockSupabase(mobile);
    await mobile.goto(base);
    await mobile.getByLabel("Password").fill("browser-test-only");
    await mobile.getByRole("button",{name:"Enter EVO Brain"}).click();
    await mobile.locator(".evo-neural-svg").waitFor();
    const scroll=await mobile.locator(".evo-neural-scroll").boundingBox();
    assert(scroll && scroll.width<=390,"mobile map scrolls internally, not outside the viewport");
    const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert(overflow<=2,"mobile page must not horizontally overflow (was "+overflow+"px)");
    await mobile.locator(".evo-neural-legend").getByRole("button",{name:/Advantage/}).click();
    assert.equal(await mobile.locator(".evo-skill-node").count(),12);
    await mobile.locator(".evo-skill-card").filter({hasText:"Social Engagement"}).first().click();
    assert.match(await mobile.locator("#evo-skill-inspector").innerText(),/Technical response review/);
    await mobile.screenshot({path:path.resolve(__dirname,"../artifacts/evo-brain/mobile.png"),fullPage:true});
    assert.deepEqual(errors,[],"no browser JS exceptions");
    console.log("PASS: private auth, six domains, dense skill map, contextual inspector, structured search, filters, reload, sign-out, mobile and no horizontal overflow");
  } finally {
    if(browser) await browser.close();
    server.close();
  }
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
