import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const language = fs.readFileSync(new URL("../src/lib/projects/client-language.ts", import.meta.url), "utf8");
const types = fs.readFileSync(new URL("../src/lib/projects/types.ts", import.meta.url), "utf8");
const factory = fs.readFileSync(new URL("../src/lib/projects/factory.ts", import.meta.url), "utf8");
const store = fs.readFileSync(new URL("../src/lib/projects/store.ts", import.meta.url), "utf8");
const create = fs.readFileSync(new URL("../src/components/create-project-screen.tsx", import.meta.url), "utf8");
const workspace = fs.readFileSync(new URL("../src/components/project-workspace.tsx", import.meta.url), "utf8");
const proposal = fs.readFileSync(new URL("../src/components/proposal-experience.tsx", import.meta.url), "utf8");
const exportHtml = fs.readFileSync(new URL("../src/lib/outcomes/export-html.ts", import.meta.url), "utf8");
const builder = fs.readFileSync(new URL("../src/lib/outcomes/builder.ts", import.meta.url), "utf8");
const hipaaPresentation = fs.readFileSync(new URL("../src/components/hipaa-presentation.tsx", import.meta.url), "utf8");
const hipaaWorkspace = fs.readFileSync(new URL("../src/components/hipaa-readiness.tsx", import.meta.url), "utf8");
const schema = fs.readFileSync(new URL("../schemas/project.schema.json", import.meta.url), "utf8");

test("organization wording defaults to practice and supports the requested client terms", () => {
  assert.match(language, /DEFAULT_ORGANIZATION_TERM = "practice"/);
  for (const term of ["practice", "firm", "hospital", "business", "organization"]) {
    assert.match(language, new RegExp(`"${term}"`));
  }
  assert.match(language, /normalizeOrganizationTerm/);
  assert.match(types, /organizationTerm: string/);
  assert.match(schema, /"organizationTerm"/);
});

test("new and existing workspaces expose editable client wording", () => {
  assert.match(create, /Refer to this organization as/);
  assert.match(create, /<select/);
  assert.match(create, /Custom term/);
  assert.match(create, /Defaults to practice for dental clients/);
  assert.match(create, /createProject\(\{ type: projectType, clientName, organizationTerm/);
  assert.match(factory, /organizationTerm: normalizeOrganizationTerm\(input\.organizationTerm\)/);
  assert.match(workspace, /Client wording/);
  assert.match(workspace, /<select/);
  assert.match(workspace, /Custom term/);
  assert.match(workspace, /updateOrganizationTerm/);
  assert.match(workspace, /projectWithBuiltOutcome/);
});

test("saved and imported workspaces receive the default wording when the field is missing", () => {
  assert.match(store, /normalizeOrganizationTerm\(legacyClient\.organizationTerm\)/);
  assert.match(store, /normalizeOrganizationTerm\(project\.client\?\.organizationTerm\)/);
});

test("presentation, planning, HIPAA, pricing, and PDF copy use adaptive organization language", () => {
  assert.match(proposal, /supportHeading\(project\)/);
  assert.match(proposal, /applicationSupportCopy\(project\)/);
  assert.match(proposal, /organizationReference\(project\)/);
  assert.match(exportHtml, /organizationTerm\(project\)/);
  assert.match(exportHtml, /adaptOrganizationLanguage/);
  assert.match(builder, /adaptOrganizationLanguage\(candidate\.clientSummary, project\)/);
  assert.match(builder, /systems \$\{organizationReference\(project\)\} depends on most/);
  assert.match(hipaaPresentation, /adaptOrganizationLanguage\(item, project\)/);
  assert.match(hipaaWorkspace, /adaptOrganizationLanguage\(prompt, project\)/);
});
