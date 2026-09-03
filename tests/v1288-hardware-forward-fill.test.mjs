import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

function loadForwardFill() {
  const source = fs.readFileSync("src/lib/compass/hardware-forward-fill.ts", "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("exports", "module", compiled)(module.exports, module);
  return module.exports;
}

test("older company correction fills missing processor from richer refreshed Ninja record", () => {
  const { forwardFillMissingHardware } = loadForwardFill();
  const saved = [{
    id: "client-1-device-abc",
    name: "TRAINER2",
    processor: "",
    videoCard: "Intel HD 620",
    sourceDeviceType: "",
    purchaseDate: "",
  }];
  const staleCurrent = [{ id: "client-1-device-abc", name: "TRAINER2", processor: "", videoCard: "Intel HD 620" }];
  const freshRecovery = [{
    id: "client-1-device-abc",
    name: "TRAINER2",
    processor: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
    videoCard: "Intel HD 620",
    sourceDeviceType: "Workstation",
    purchaseDate: "2018-01-15",
  }];

  const [result] = forwardFillMissingHardware(saved, [...staleCurrent, ...freshRecovery]);
  assert.equal(result.processor, "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz");
  assert.equal(result.videoCard, "Intel HD 620");
  assert.equal(result.sourceDeviceType, "Workstation");
  assert.equal(result.purchaseDate, "2018-01-15");
});

test("report manual inventory fills blank cpu from Compass processor without replacing manual values", () => {
  const { forwardFillMissingHardware } = loadForwardFill();
  const saved = [{
    id: "client-1-device-abc",
    name: "TRAINER2",
    cpu: "",
    graphics: "Manually confirmed GPU",
    purchased: "",
  }];
  const fresh = [{
    id: "client-1-device-abc",
    name: "TRAINER2",
    processor: "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz",
    videoCard: "Intel HD 620",
    purchaseDate: "2018-01-15",
  }];

  const [result] = forwardFillMissingHardware(saved, fresh);
  assert.equal(result.cpu, "Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz");
  assert.equal(result.graphics, "Manually confirmed GPU");
  assert.equal(result.purchased, "2018-01-15");
});

test("hardware recovery runtime repairs both durable correction and open report layers", () => {
  const runtime = fs.readFileSync("src/components/hardware-forward-fill-runtime.tsx", "utf8");
  const shell = fs.readFileSync("src/components/client-compass-runtime.tsx", "utf8");
  assert.match(runtime, /recovery-dataset/);
  assert.match(runtime, /upgradeStoredCorrections/);
  assert.match(runtime, /upgradeOpenProject/);
  assert.match(runtime, /withManualInventory\(project, devices\)/);
  assert.match(shell, /<HardwareForwardFillRuntime \/>/);
});

test("hardware refresh recovery release is v1.2.88", () => {
  assert.match(fs.readFileSync("package.json", "utf8"), /"version": "1\.2\.88"/);
  assert.match(fs.readFileSync("src/lib/app-version.ts", "utf8"), /1\.2\.88/);
});
