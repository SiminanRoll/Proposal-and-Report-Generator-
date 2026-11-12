import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "src");
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".mts"];
const PROHIBITED = [
  /src\/lib\/compass\/captains-log-cloud(?:-local-cache)?\.(?:tsx?|mjs)$/,
  /src\/lib\/compass\/captains-log-device-signin\.(?:tsx?|mjs)$/,
  /src\/lib\/compass\/captains-log-(?:bridge|current-state|task-write|company-history|account-review-sync|ota-handoff)\.(?:tsx?|mjs)$/,
  /src\/lib\/compass\/(?:review-state-cloud|workbench-cloud|company-geography-sync|company-identity-bulk)\.(?:tsx?|mjs)$/,
  /src\/components\/(?:captains-log-cloud-settings|captains-log-cloud-session-runtime|compass-sync-runtime|compass-sync-runtime-v1139|company-geography-sync-runtime|company-technology-summary-runtime|client-activity-runtime)\.(?:tsx?|mjs)$/,
];
function walk(dir) {
  let output = [];
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) output.push(...walk(full));
    else if (item.isFile() && /page\.tsx$/.test(item.name)) output.push(full);
  }
  return output;
}
const entrypoints = [
  path.join(SRC, "app/layout.tsx"),
  ...walk(path.join(SRC, "app")),
];
function resolveImport(importer, specifier) {
  const parent = specifier.startsWith("@/") ? path.join(SRC, specifier.slice(2)) :
    specifier.startsWith(".") ? path.resolve(path.dirname(importer), specifier) : null;
  if (!parent || !parent.startsWith(SRC + path.sep)) return null;
  const candidates = [parent, ...EXTENSIONS.map((ext) => parent + ext),
    ...EXTENSIONS.map((ext) => path.join(parent, "index" + ext))];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}
function runtimeImports(file) {
  const source = fs.readFileSync(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const specs = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly &&
        ts.isStringLiteral(node.moduleSpecifier)) specs.push(node.moduleSpecifier.text);
    if (ts.isExportDeclaration(node) && !node.isTypeOnly &&
        node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      // Reexports of only type declarations are removed by the compiler.
      if (!node.exportClause || !ts.isNamedExports(node.exportClause) ||
          node.exportClause.elements.some((element) => !element.isTypeOnly)) {
        specs.push(node.moduleSpecifier.text);
      }
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
         (ts.isIdentifier(node.expression) && node.expression.text === "require"))) {
      specs.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return specs;
}
function graph() {
  const visited = new Set();
  const queue = entrypoints.map((file) => ({ file, chain: [path.relative(ROOT, file)] }));
  const leaks = [];
  while (queue.length) {
    const { file, chain } = queue.shift();
    if (visited.has(file)) continue;
    visited.add(file);
    const relative = path.relative(ROOT, file).replaceAll(path.sep, "/");
    if (PROHIBITED.some((pattern) => pattern.test(relative))) {
      leaks.push(chain.map((name) => name.replaceAll(path.sep, "/")).join(" → "));
      continue;
    }
    for (const spec of runtimeImports(file)) {
      const target = resolveImport(file, spec);
      if (target && !visited.has(target)) queue.push({
        file: target,
        chain: [...chain, path.relative(ROOT, target)],
      });
    }
  }
  return { visited, leaks };
}

test("Active Client Compass routes must not import Supabase or Captain's Log cloud runtime", () => {
  const result = graph();
  assert.ok(result.visited.size > 30, "Import walk must cover all active Compass routes");
  assert.deepEqual(result.leaks, [], [
    "Cloud integrations are not part of the GHL-only Client Compass cutover.",
    "This checks *reachable runtime imports* instead of deleting unrelated OTA/Signal source files.",
    ...result.leaks,
  ].join("\n"));
});
