import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

let typescriptPromise;
let technicalTruthUrlPromise;

async function loadTypeScript() {
  if (!typescriptPromise) {
    typescriptPromise = import("typescript").catch(() => import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js"));
  }
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
      const file = path.join(os.tmpdir(), `client-compass-technical-truth-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`);
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

  for (const [from, to] of Object.entries(options.replacements ?? {})) {
    output = output.replaceAll(from, to);
  }

  const file = path.join(
    os.tmpdir(),
    `${options.prefix ?? "client-compass-test"}-${path.basename(relativePath).replace(/\W/g, "-")}-${Date.now()}-${Math.random().toString(36).slice(2)}.mjs`,
  );
  fs.writeFileSync(file, output);
  const module = await import(`${pathToFileURL(file).href}?v=${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return options.returnFile ? { file, module } : module;
}

export async function loadTechnicalTruthForTest() {
  return import(`${await compileTechnicalTruth()}?v=${Date.now()}-${Math.random().toString(36).slice(2)}`);
}
