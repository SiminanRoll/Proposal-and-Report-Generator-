import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

let typescriptPromise;
let technicalTruthUrlPromise;

async function loadTypeScript() {
  if (!typescriptPromise) typescriptPromise = import("typescript");
  return typescriptPromise;
}

async function compileTechnicalTruth() {
  if (!technicalTruthUrlPromise) {
    technicalTruthUrlPromise = (async () => {
      const ts = await loadTypeScript();
      const source = fs.readFileSync(new URL("../src/lib/technical-truth/index.ts", import.meta.url), "utf8");
      const output = ts.default.transpileModule(source, {
        compilerOptions: {
          target: ts.default.ScriptTarget.ES2022,
          module: ts.default.ModuleKind.ESNext,
          verbatimModuleSyntax: true,
        },
      }).outputText;
      const file = path.join(os.tmpdir(), `client-compass-technical-truth-${process.pid}.mjs`);
      fs.writeFileSync(file, output);
      return pathToFileURL(file).href;
    })();
  }
  return technicalTruthUrlPromise;
}

export async function transpileTestModule(relativePath, baseUrl, options = {}) {
  const ts = await loadTypeScript();
  const source = fs.readFileSync(new URL(relativePath, baseUrl), "utf8");
  let output = ts.default.transpileModule(source, {
    compilerOptions: {
      target: ts.default.ScriptTarget.ES2022,
      module: ts.default.ModuleKind.ESNext,
      verbatimModuleSyntax: true,
      jsx: ts.default.JsxEmit.Preserve,
    },
  }).outputText;

  const technicalTruthUrl = await compileTechnicalTruth();
  output = output.replace(
    /from\s+["'](?:@\/lib\/technical-truth|\.\.\/technical-truth|\.\.\/technical-truth\/index)["']/g,
    `from ${JSON.stringify(technicalTruthUrl)}`,
  );

  const mapLensStubUrl = `data:text/javascript,${encodeURIComponent("export function filterCompassDatasetForMapLens(dataset) { return dataset; }")}`;
  output = output.replace(
    /from\s+["']@\/lib\/segments\/map-lens["']/g,
    `from ${JSON.stringify(mapLensStubUrl)}`,
  );

  for (const [from, to] of Object.entries(options.replacements ?? {})) {
    output = output.replaceAll(from, to);
  }

  const file = path.join(os.tmpdir(), `${options.prefix || "client-compass-test"}-${Date.now()}-${Math.random().toString(16).slice(2)}.mjs`);
  fs.writeFileSync(file, output);
  const module = await import(`${pathToFileURL(file).href}?v=${Date.now()}`);
  return options.returnFile ? { file, module } : module;
}
