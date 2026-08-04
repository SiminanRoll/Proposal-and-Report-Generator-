import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const legacyPaths = [
  "src/app/api/shares",
  "src/app/share",
  "src/components/share-management.tsx",
  "src/components/shared-client-view.tsx",
  "src/lib/hipaa/handoff.ts",
  "src/lib/sharing",
  "tests/secure-sharing.test.mjs",
  "docs/SECURE_CLIENT_SHARING.md",
  "docs/proposal_client_shares.sql",
  ".env.example"
];

let removed = 0;
for (const relativePath of legacyPaths) {
  const target = resolve(process.cwd(), relativePath);
  if (!existsSync(target)) continue;
  rmSync(target, { recursive: true, force: true });
  removed += 1;
  console.log(`Removed obsolete hosted-sharing path: ${relativePath}`);
}

console.log(
  removed
    ? `Legacy hosted-sharing cleanup complete (${removed} path${removed === 1 ? "" : "s"} removed).`
    : "Legacy hosted-sharing cleanup complete (nothing to remove).",
);
