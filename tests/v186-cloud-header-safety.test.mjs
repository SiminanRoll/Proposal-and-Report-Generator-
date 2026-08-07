import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const cloudSource = fs.readFileSync(new URL("../src/lib/compass/captains-log-cloud.ts", import.meta.url), "utf8");
const settingsSource = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");

test("v1.8.8 sanitizes pasted Supabase connection values before they become HTTP headers", async () => {
  const cloud = await transpileTestModule("../src/lib/compass/captains-log-cloud.ts", import.meta.url, { prefix: "v186-cloud-safety" });
  const normalized = cloud.normalizeCaptainsLogCloudConfig({
    url: "  \u200Bhttps://example.supabase.co/\u00A0 ",
    anonKey: "“ sb_publishable_test.key-value \u200B”",
    email: "  'patric@example.com'  ",
  });
  assert.equal(normalized.url, "https://example.supabase.co");
  assert.equal(normalized.anonKey, "sb_publishable_test.key-value");
  assert.equal(normalized.email, "patric@example.com");
  assert.match(cloudSource, /\^\[\\x21-\\x7E\]\+\$/);
  assert.match(cloudSource, /contains unsupported pasted characters/);
});

test("v1.8.8 normalizes the visible settings fields before attempting Supabase sign-in", () => {
  assert.match(settingsSource, /const normalized = saveCaptainsLogCloudConfig\(config\)/);
  assert.match(settingsSource, /setConfig\(normalized\)/);
  assert.match(settingsSource, /signInCaptainsLogCloud\(normalized, password\)/);
});
