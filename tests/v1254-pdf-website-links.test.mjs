import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registry = readFileSync("src/lib/advantage-website-links.ts", "utf8");
const decorator = readFileSync("src/lib/outcomes/pdf-website-links.ts", "utf8");
const wrapper = readFileSync("src/lib/outcomes/fillable-pdf.ts", "utf8");
const core = readFileSync("src/lib/outcomes/fillable-pdf-core.ts", "utf8");
const a360 = readFileSync("src/lib/prospects/a360-report-export.ts", "utf8");

test("Advantage website destinations are centralized and approved", () => {
  for (const path of [
    "https://www.adv-tech.com/",
    "https://www.adv-tech.com/a360/",
    "https://www.adv-tech.com/what-is-hassle-free-it/secure/",
    "https://www.adv-tech.com/what-is-hassle-free-it/stable/",
    "https://www.adv-tech.com/what-is-hassle-free-it/supported/",
    "https://www.adv-tech.com/what-is-hassle-free-it/simple/",
    "https://www.adv-tech.com/projects-upgrades-and-technology-refreshes/",
    "https://www.adv-tech.com/tech-education/",
    "https://www.adv-tech.com/success-stories/",
    "https://www.adv-tech.com/contact-us/",
  ]) assert.ok(registry.includes(path), `missing website destination ${path}`);
  assert.match(registry, /hostname === "adv-tech\.com" \|\| url\.hostname === "www\.adv-tech\.com"/);
});

test("A360 PDFs link the brand, Advantage 360, relevant priorities, and contact page", () => {
  assert.match(a360, /ADVANTAGE_WEBSITE_LINKS\.home/);
  assert.match(a360, /Learn more about Advantage 360/);
  assert.match(a360, /a360PriorityWebsiteLinkKeys\(priorities, 2\)/);
  assert.match(a360, /Meet your local Advantage team/);
});

test("client-report PDFs receive contextual website links without touching inventory cards", () => {
  assert.match(wrapper, /preparePdfWebsiteLinks\(sanitizedHtml, documentTitle\)/);
  assert.match(decorator, /pdf-overview-page[\s\S]*Learn about Advantage security/);
  assert.match(decorator, /pdf-action-page[\s\S]*(Explore technology refresh planning|keeps technology stable)/);
  assert.match(decorator, /pdf-client-success-page[\s\S]*Tech Education[\s\S]*Contact Advantage/);
  assert.doesNotMatch(decorator, /pdf-inventory-page/);
});

test("raster PDF core restores designated website areas as native URI link annotations", () => {
  assert.match(core, /export interface PdfLinkDefinition/);
  assert.match(core, /querySelectorAll<HTMLElement>\("\[data-pdf-link\]"\)/);
  assert.match(core, /links = captureLinks\(clone, layout\)/);
  assert.match(core, /for \(const link of input\.links \?\? \[\]\)/);
  assert.match(core, /\/Subtype \/Link/);
  assert.match(core, /\/A << \/S \/URI \/URI \$\{pdfString\(url\)\} >>/);
  assert.match(core, /\/Border \[0 0 0\]/);
});
