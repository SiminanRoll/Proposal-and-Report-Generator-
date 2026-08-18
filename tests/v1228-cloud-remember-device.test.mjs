import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const settings = fs.readFileSync(new URL("../src/components/captains-log-cloud-settings.tsx", import.meta.url), "utf8");
const runtime = fs.readFileSync(new URL("../src/components/captains-log-cloud-session-runtime.tsx", import.meta.url), "utf8");
const credential = fs.readFileSync(new URL("../src/lib/compass/captains-log-device-signin.ts", import.meta.url), "utf8");

test("cloud settings expose an explicit remember-device auto-connect option", () => {
  assert.match(settings, /Remember this device/);
  assert.match(settings, /saveCaptainsLogRememberedPassword/);
  assert.match(settings, /Save device sign-in/);
  assert.match(settings, /setCaptainsLogRememberDevice/);
});

test("saved cloud password is encrypted with a non-exportable browser key", () => {
  assert.match(credential, /generateKey\(\{ name: "AES-GCM", length: 256 \}, false, \["encrypt", "decrypt"\]\)/);
  assert.match(credential, /crypto\.subtle\.encrypt/);
  assert.match(credential, /crypto\.subtle\.decrypt/);
  assert.doesNotMatch(credential, /localStorage\.setItem\([^\n]*password/i);
});

test("session runtime can re-authenticate automatically when a remembered session is missing or invalid", () => {
  assert.match(runtime, /autoSignInRememberedDevice/);
  assert.match(runtime, /loadCaptainsLogRememberedPassword/);
  assert.match(runtime, /signInCaptainsLogCloud/);
  assert.match(runtime, /looksLikeAuthFailure/);
  assert.match(runtime, /window\.addEventListener\("focus", wakeAndRetry\)/);
});
