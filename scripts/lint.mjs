import fs from "node:fs";
import path from "node:path";
let ts;
try {
  ts = (await import("typescript")).default;
} catch {
  ts = (await import("/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript/lib/typescript.js")).default;
}

const roots = ["src", "tests", "scripts"];
const files = [];
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  const walk = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
    }
  };
  walk(root);
}
for (const file of ["next.config.ts"]) if (fs.existsSync(file)) files.push(file);

const failures = [];
for (const file of files.sort()) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes("\t")) failures.push(`${file}: contains tab indentation`);
  if (/\s+$/.test(source.split("\n").find((line) => /\s+$/.test(line)) ?? "")) failures.push(`${file}: contains trailing whitespace`);
  if (/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(source) && file.startsWith("src/")) {
    const isCaptainsLogIntegration = (file.endsWith("src/lib/compass/captains-log-bridge.ts") || file.endsWith("src/lib/compass/captains-log-cloud.ts"))
      && !/\b(?:XMLHttpRequest|WebSocket)\s*\(/.test(source);
    if (!isCaptainsLogIntegration) failures.push(`${file}: outbound request primitive is not allowed in browser-local Client Compass`);
  }
  if (/\.(?:ts|tsx)$/.test(file)) {
    const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const parsed = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind);
    for (const diagnostic of parsed.parseDiagnostics) {
      const position = diagnostic.start == null ? "" : `:${parsed.getLineAndCharacterOfPosition(diagnostic.start).line + 1}`;
      failures.push(`${file}${position}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`);
    }
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Linted ${files.length} source and validation files.`);
