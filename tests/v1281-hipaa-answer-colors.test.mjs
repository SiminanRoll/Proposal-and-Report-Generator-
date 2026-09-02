import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const pdf = fs.readFileSync("src/lib/outcomes/export-html.ts", "utf8");

test("HIPAA reviewed-answer PDF makes No red", () => {
  assert.match(pdf, /response === "no" \? "border:1px solid #e99b8b;background:#fff2ef"/);
  assert.match(pdf, /response === "no" \? "background:#ffdcd4;color:#a83e29;border:1px solid #efab9c"/);
  assert.match(pdf, /data-hipaa-response=/);
});

test("HIPAA reviewed-answer PDF makes Somewhat yellow", () => {
  assert.match(pdf, /response === "partially" \? "border:1px solid #e4c675;background:#fff8e2"/);
  assert.match(pdf, /response === "partially" \? "background:#ffedbd;color:#805807;border:1px solid #e5c36f"/);
});

test("generic reviewed-answer cards use matching red and yellow treatment", () => {
  assert.match(pdf, /\.hipaa-gap\.no\{border-left-color:var\(--red\);background:#fff4f1\}/);
  assert.match(pdf, /\.hipaa-gap\.partially\{border-left-color:var\(--yellow\);background:#fff9e8\}/);
  assert.match(pdf, /\.hipaa-gap\.no span\{background:#ffdcd4;color:#a83e29\}/);
  assert.match(pdf, /\.hipaa-gap\.partially span\{background:#ffedbd;color:#805807\}/);
});

test("HIPAA answer color release is version 1.2.81", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.81"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.81/);
});
