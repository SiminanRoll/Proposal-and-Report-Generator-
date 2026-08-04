import { rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = process.cwd();
const targets = [".next", "out", "coverage", "tsconfig.tsbuildinfo", "public/pdf.worker.min.mjs"];

await Promise.all(targets.map((target) => rm(resolve(root, target), { recursive: true, force: true })));
console.log("Removed generated build artifacts.");
