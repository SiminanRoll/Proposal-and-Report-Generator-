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
    knowledge_profile:{label:"Social Engagement",capabilities:["Technical response review","Qualified opportunities"],operations:["Inspect the actual post","Draft a factual helpful reply"],inputs:["Real public post","Verified actor"],outputs:["Qualification decision","Reply draft"],touches:["Facebook","Reddit"],boundaries:["No invented lead contact","No unapproved publishing"],related:["clv-system-modernization"],assets:[
      {id:"adv-ghl",label:"Advantage GHL",type:"service",status:"documented",summary:"CRM and contact workflows",evidence:"skills/advantage-social-engagement/SKILL.md",relationship:"references"},
      {id:"evo-repo",label:"EVO source",type:"repository",status:"verified",summary:"Catalog source",evidence:"docs/ai/PROJECT_EVO.md",relationship:"references",url:"https://github.com/SiminanRoll/captains_log"}
    ],source_path:"skills/advantage-social-engagement/SKILL.md",source_commit:"fixture"} },
  { id:"dev", title:"CLV System Modernization", branch:"Application Development", category:"Engineering", stage:"Established", summary:"Safe architecture", context_items:["GitHub"], next_step:"Test", evidence:"Registered source", skill_path:"skills/clv-system-modernization/SKILL.md",
    knowledge_profile:{label:"CLV System Modernization",capabilities:["Technical architecture"],operations:["Trace source"],inputs:["Repo"],outputs:["Plan"],touches:["GitHub"],boundaries:["Preserve ownership"],related:[],
      assets:[{id:"evo-repo",label:"EVO source",type:"repository",status:"verified",summary:"Catalog source",evidence:"docs/ai/PROJECT_EVO.md",relationship:"references",url:"https://github.com/SiminanRoll/captains_log"}]} },
  { id:"bubblegum", title:"BubbleGum Server Engineering", branch:"Personal & Family", category:"Game development", stage:"Established", summary:"Paper server", context_items:["Paper"], next_step:"Playtest", evidence:"Registered source", skill_path:"skills/bubblegum-server-engineering/SKILL.md" },
  { id:"hammy", title:"Hammy Book Publishing", branch:"Hammy & The Strawberry", category:"Publishing", stage:"Starter", summary:"KDP publishing guidance", context_items:[], next_step:"Proof", evidence:"Registered source", skill_path:"skills/hammy-book-publishing/SKILL.md",
    knowledge_profile:{label:"Book Publishing",capabilities:["Book layout"],operations:["Prepare KDP"],inputs:["Artwork"],outputs:["Interior"],touches:["KDP"],boundaries:["Owner only"],related:[],
      assets:[{id:"hammy-book",label:"Hammy KDP book",type:"storage",status:"documented",summary:"Book production assets",evidence:"skills/hammy-book-publishing/SKILL.md",relationship:"operates"}]} }
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
  {...addSkill("brittany-business-brain","Brittany Business Brain","Brittany Myra"),
    knowledge_profile:{label:"Brittany Business Brain",capabilities:["Planning"],operations:["Reference context"],inputs:["Private materials"],outputs:["Plan"],touches:["Private source"],boundaries:["Independent owner"],related:[],
    assets:[{id:"brittany-brain",label:"Brittany business brain source",type:"repository",status:"reference_only",summary:"Separate owner",evidence:"skills/brittany-business-brain/SKILL.md",relationship:"references"}]}},
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
    await page.getByRole("button", { name:"Enter EVO Brain", exact:true }).click();
    await page.locator(".evo-neural-svg").waitFor();
    assert.equal(await page.locator("main.evo-root").getAttribute("data-evo-release"),"EVO-028","the private EVO entrypoint displays a testable release marker");
    assert.equal(await page.locator('a[href="/"]').count(),0,"EVO must not navigate back to Client Compass");
    assert.match((await page.locator(".evo-context-strip").innerText()).replace(/\s+/g," "),/31 skills.*6 domains/,"compact status shows 31 skills and six domains");
    assert.equal(await page.locator(".evo-page-heading").count(),0,"redundant Knowledge Connected heading removed");
    assert.equal(await page.getByText("Knowledge, connected.").count(),0,"wasteful hero wording removed");
    const mapTop = await page.locator(".evo-atlas-workspace").boundingBox();
    assert(mapTop && mapTop.y<240,"explorer begins close to page header, not below a large hero");
    const mapPane=page.locator(".evo-neural-scroll");
    const svg=page.locator(".evo-neural-svg");
    const paneWidth=await mapPane.evaluate(element=>element.clientWidth);
    const fitWidth=await svg.evaluate(element=>element.getBoundingClientRect().width);
    assert(fitWidth<=paneWidth+2,"desktop map fits viewport by default without forced min-width");
    assert.equal((await page.locator(".evo-zoom-controls output").innerText()).trim(),"100%","default zoom is Fit");
    await page.getByRole("button",{name:"Zoom out"}).click();
    const smaller=await svg.evaluate(element=>element.getBoundingClientRect().width);
    assert(smaller<fitWidth*.9,"zoom-out actually reduces the map width");
    await page.getByRole("button",{name:"Zoom in"}).click();
    await page.getByRole("button",{name:"Zoom in"}).click();
    assert((await svg.evaluate(el=>el.getBoundingClientRect().width))>paneWidth,"zoom-in enlarges map for pan/reading");
    await page.getByRole("button",{name:"Fit map"}).click();
    assert.equal((await page.locator(".evo-zoom-controls output").innerText()).trim(),"100%","Fit returns to full-width view");
    assert.equal(await page.locator(".evo-domain-card").count(),6,"six dedicated domain cards, not duplicate skill rows");
    assert.equal(await page.locator(".evo-domain-node").count(),6,"atlas opens at six readable domains");
    assert.equal(await page.locator(".evo-skill-node").count(),0,"all 31 labels are not crowded into overview");
    assert.equal(await page.locator(".evo-hero").count(),0,"no giant introductory hero");
    // Systems inventory is owner-only; default skills view remains uncluttered.
    assert.equal(await page.locator(".evo-system-svg").count(),0,"systems graph is a separate deliberate view");
    await page.getByRole("button",{name:/Systems map/}).click();
    await page.locator(".evo-system-svg").waitFor();
    assert.equal(await page.locator(".evo-system-domain-node").count(),6,"network overview has six real domain nodes");
    assert.equal(await page.locator(".evo-system-kind-node").count(),7,"seven typed categories, not scattered names");
    assert(await page.locator(".evo-asset-card").count()>=4,"source-linked assets appear only after owner sign-in");
    const systemPane=await page.locator(".evo-systems-scroll").evaluate(el=>el.clientWidth);
    assert((await page.locator(".evo-system-svg").evaluate(el=>el.getBoundingClientRect().width))<=systemPane+2,"systems map fits available space");
    await page.getByRole("button",{name:"Zoom systems map in"}).click();
    assert((await page.locator(".evo-system-svg").evaluate(el=>el.getBoundingClientRect().width))>systemPane,"systems map zoom enlarges within scrolling area");
    await page.getByRole("button",{name:"Fit systems map"}).click();
    assert.match(await page.locator(".evo-zoom-controls output").first().innerText(),/100%/);
    await page.getByRole("button",{name:"Open systems for Advantage Technologies"}).click();
    assert.equal(await page.locator(".evo-system-asset-node").count(),2,"domain graph shows only two source-linked assets");
    await page.getByRole("button",{name:"Inspect asset Advantage GHL"}).click();
    assert.match(await page.locator("#evo-asset-inspector").innerText(),/Documented.*live state not checked/s);
    assert.match(await page.locator("#evo-asset-inspector").innerText(),/Social Engagement/,"asset reveals linked skills");
    await page.locator("#evo-asset-inspector").getByRole("button",{name:/Social Engagement/}).click();
    assert.match(await page.locator(".evo-system-hub").getAttribute("aria-label"),/Social Engagement/,"linked skill narrows network");
    await page.locator(".evo-explorer-tabs").getByRole("button",{name:/Skills/}).click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/Assets & systems/i);
    await page.locator("#evo-skill-inspector").getByRole("button",{name:"Inspect asset EVO source"}).click();
    assert.match(await page.locator("#evo-asset-inspector").innerText(),/EVO source/,"skill badge returns to systems explorer");
    await page.locator(".evo-explorer-tabs").getByRole("button",{name:/Skills/}).click();
    await page.locator(".evo-neural-legend").getByRole("button",{name:/All domains/}).click();
    assert.match(await page.locator(".evo-catalog-meta").innerText(),/Nov 21, 2026/,"catalog timestamp labeled as metadata update");

    // Zoom into a dense domain, then inspect an actual capability within the same viewport.
    await page.locator('g[aria-label="Advantage Technologies, 12 capabilities"]').click();
    assert.equal(await page.locator(".evo-skill-node").count(),12,"all 12 Advantage skills are visible in focused map");
    assert.equal(await page.locator(".evo-skill-card").count(),12,"library reflects focused domain");
    const rects = await page.locator('.evo-skill-node rect[rx="15"]').evaluateAll(elements =>
      elements.map(el => ({ x: Number(el.getAttribute("x")), y: Number(el.getAttribute("y")),
        w: Number(el.getAttribute("width")), h: Number(el.getAttribute("height")) })));
    assert.equal(rects.length,12,"all 12 primary skill cards are measured; selected glow is excluded");
    for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
      const A=rects[i],B=rects[j];
      assert(A.x+A.w+6 <= B.x || B.x+B.w+6 <= A.x || A.y+A.h+6 <= B.y || B.y+B.h+6 <= A.y,
        "focused skill cards must not overlap: "+JSON.stringify({i,j,A,B}));
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
    await page.getByRole("button",{name:"Connections",exact:true}).click();
    assert.equal(await page.locator(".evo-relation-node").count(),1,"relations come only from curated IDs");
    assert.match(await page.locator(".evo-relation-node").first().getAttribute("aria-label"),/CLV System Modernization/,"related skill from another domain is visible");
    assert.match(await page.locator(".evo-map-caption").innerText(),/not live integrations/,"connection line does not claim operational integration");
    await page.locator(".evo-relation-node").first().click();
    assert.match(await page.locator("#evo-skill-inspector").innerText(),/CLV System Modernization/,"cross-domain related node opens its inspector");
    assert.match(await page.locator(".evo-neural-heading h2").innerText(),/Application Development/);
    await page.getByRole("button",{name:"Skills",exact:true}).click();
    await page.locator(".evo-neural-legend").getByRole("button",{name:/Advantage/}).click();

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
    assert.equal(await page.locator(".evo-asset-card").count(),0,"sign out clears private asset references");

    const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
    mobile.on("pageerror",e=>errors.push(String(e)));
    await mockSupabase(mobile);
    await mobile.goto(base);
    await mobile.getByLabel("Password").fill("browser-test-only");
    await mobile.getByRole("button",{name:"Enter EVO Brain"}).click();
    await mobile.locator(".evo-neural-svg").waitFor();
    await mobile.waitForFunction(()=>document.querySelector(".evo-zoom-controls output")?.textContent?.includes("200%"));
    assert.equal((await mobile.locator(".evo-zoom-controls output").innerText()).trim(),"200%","mobile starts at readable magnification");
    const scroll=await mobile.locator(".evo-neural-scroll").boundingBox();
    assert(scroll && scroll.width<=390,"mobile map scrolls internally, not outside the viewport");
    const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert(overflow<=2,"mobile page must not horizontally overflow (was "+overflow+"px)");
    await mobile.getByRole("button",{name:"Fit map"}).click();
    assert.equal((await mobile.locator(".evo-zoom-controls output").innerText()).trim(),"100%","mobile Fit shows entire map");
    const mobileFit=await mobile.locator(".evo-neural-svg").evaluate(el=>el.getBoundingClientRect().width);
    const mobilePane=await mobile.locator(".evo-neural-scroll").evaluate(el=>el.clientWidth);
    assert(mobileFit<=mobilePane+2,"fit view must not require horizontal scrolling");
    await mobile.getByRole("button",{name:"Zoom in"}).click();
    assert((await mobile.locator(".evo-neural-svg").evaluate(el=>el.getBoundingClientRect().width))>mobileFit,"mobile zoom in works");
    await mobile.locator(".evo-neural-legend").getByRole("button",{name:/Advantage/}).click();
    assert.equal(await mobile.locator(".evo-skill-node").count(),12);
    await mobile.locator(".evo-skill-card").filter({hasText:"Social Engagement"}).first().click();
    assert.match(await mobile.locator("#evo-skill-inspector").innerText(),/Technical response review/);
    await mobile.getByRole("button",{name:/Systems map/}).click();
    await mobile.locator(".evo-system-svg").waitFor();
    await mobile.getByRole("button",{name:"Fit systems map"}).click();
    assert.equal((await mobile.locator(".evo-zoom-controls output").innerText()).trim(),"100%","mobile system overview can fit");
    const systemsOverflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert(systemsOverflow<=2,"mobile systems view must not overflow page width");
    await mobile.screenshot({path:path.resolve(__dirname,"../artifacts/evo-brain/mobile.png"),fullPage:true});
    assert.deepEqual(errors,[],"no browser JS exceptions");
    console.log("PASS: owner-only asset registry, seven typed systems, interactive cross-skill network, fit/zoom, 31 skills, inspector, search and mobile privacy");
  } finally {
    if(browser) await browser.close();
    server.close();
  }
})().catch(err=>{console.error(err);server.close();process.exitCode=1;});
