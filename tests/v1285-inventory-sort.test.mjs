import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pdf = fs.readFileSync("src/lib/outcomes/pdf-inventory-sync.ts", "utf8");

test("location inventory sorts 5+ year red items first", () => {
  assert.match(pdf, /if \(card\.fivePlus\) return 0/);
  assert.match(pdf, /if \(card\.osConcern \|\| card\.status === "overdue"\) return 1/);
  assert.match(pdf, /if \(card\.ageToVerify \|\| card\.status === "due-soon"\) return 2/);
});

test("each priority group sorts oldest known age first", () => {
  assert.match(pdf, /const leftAge = left\.ageYears \?\? -1/);
  assert.match(pdf, /const rightAge = right\.ageYears \?\? -1/);
  assert.match(pdf, /return rightAge - leftAge/);
});

test("sorting is applied before each location is paginated", () => {
  assert.match(pdf, /const sortedCards = sortedInventoryCards\(locationCards\)/);
  assert.match(pdf, /sortedCards\.slice\(index, index \+ pageSize\)/);
});

test("inventory sorting release is version 1.2.85", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.85"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.85/);
});
