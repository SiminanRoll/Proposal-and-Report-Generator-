import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

async function loadLogic() {
  const xlsxStub = `data:text/javascript,${encodeURIComponent("export const CFB = {};\n")}`;
  return transpileTestModule("../src/app/ota-tracker/logic.ts", import.meta.url, {
    prefix: "ota-tracker-logic",
    replacements: { 'from "xlsx"': `from ${JSON.stringify(xlsxStub)}` },
  });
}

test("OTA quote aging pauses on weekends and advances on Chicago business dates", async () => {
  const { classifyOtaHealth } = await loadLogic();
  const monday = "2026-08-24";

  assert.deepEqual(classifyOtaHealth("2026-08-21", false, "", monday), { key: "grace", label: "Grace window", daysPast: 1, rank: 5 });
  assert.deepEqual(classifyOtaHealth("2026-08-20", false, "", monday), { key: "due", label: "Quote due", daysPast: 2, rank: 6 });
  assert.deepEqual(classifyOtaHealth("2026-08-19", false, "", monday), { key: "overdue", label: "Overdue", daysPast: 3, rank: 7 });

  assert.equal(classifyOtaHealth("2026-08-21", false, "", "2026-08-22").daysPast, 0);
  assert.equal(classifyOtaHealth("2026-08-21", false, "", "2026-08-23").daysPast, 0);
  assert.equal(classifyOtaHealth("2026-08-22", false, "", monday).daysPast, 1);
  assert.equal(classifyOtaHealth("2026-08-23", false, "", monday).daysPast, 1);
});

test("OTA health thresholds remain green through business day 1, yellow on 2, and red on 3+", async () => {
  const { classifyOtaHealth } = await loadLogic();
  const today = "2026-08-26";

  assert.equal(classifyOtaHealth("2026-08-25", false, "", today).key, "grace");
  assert.equal(classifyOtaHealth("2026-08-24", false, "", today).key, "due");
  assert.equal(classifyOtaHealth("2026-08-21", false, "", today).key, "overdue");
  assert.equal(classifyOtaHealth("2026-08-21", true, "", today).key, "quoted");
});

test("Latest OTAs includes all future dates and the previous 60 calendar days", async () => {
  const { compareLatestOtaDates, isOtaInLatestWindow } = await loadLogic();
  const today = "2026-08-24";

  assert.equal(isOtaInLatestWindow("2027-01-15", today), true);
  assert.equal(isOtaInLatestWindow("2026-06-25", today), true);
  assert.equal(isOtaInLatestWindow("2026-06-24", today), false);
  assert.equal(isOtaInLatestWindow(null, today), false);

  const dates = ["2026-08-01", "2026-09-01", "2026-08-24", "2026-08-23", "2026-08-25"];
  assert.deepEqual(dates.toSorted((left, right) => compareLatestOtaDates(left, right, today)), [
    "2026-08-25",
    "2026-09-01",
    "2026-08-24",
    "2026-08-23",
    "2026-08-01",
  ]);
});

test("Sales Assist Providence OTA infers new office, purchasing contact, schedule, and consultant signature", async () => {
  const { parseOtaEmailBatch, companyKey } = await loadLogic();
  const [ota] = parseOtaEmailBatch(`Subject: OTA Opportunity #17775 Providence East\nFrom: Chris Beadle <chris.beadle@adv-tech.com>\n\nOTA at Dr. Troy Long office for purchasing office Dr. Josh Gunnells of Providence Dental. New office will be Providence east.\n8/11/2026 2:30 pm\nShould be simple Eaglesoft office with Carestream imaging.\nChris Beadle | Senior Technology Consultant\nAdvantage Technologies`);

  assert.equal(companyKey(ota.company), "providence east");
  assert.equal(ota.appointmentDate, "2026-08-11");
  assert.equal(ota.appointmentTime, "14:30:00");
  assert.equal(ota.contactName, "Dr. Josh Gunnells");
  assert.equal(ota.tcName, "Chris Beadle");
});

test("Sales Assist shorthand line supports company/contact prefix and noon", async () => {
  const { parseOtaEmailBatch } = await loadLogic();
  const [ota] = parseOtaEmailBatch(`Subject: OTA # 17755\nFrom: Shawn Lamb <shawn.lamb@adv-tech.com>\n\nJD Corey 8/26/26 at noon.\nAbout darn time!\nShawn Lamb | Technology Consultant\nAdvantage Technologies`);

  assert.equal(ota.company, "JD Corey");
  assert.equal(ota.appointmentDate, "2026-08-26");
  assert.equal(ota.appointmentTime, "12:00:00");
  assert.equal(ota.contactName, "JD Corey");
  assert.equal(ota.tcName, "Shawn Lamb");
});

test("Sales Assist new-client subject and conversational set sentence parse dotted PM time", async () => {
  const { parseOtaEmailBatch, companyKey } = await loadLogic();
  const [ota] = parseOtaEmailBatch(`Subject: RE: Opportunity 17797 - Project with A360 | New Client Medure DEntal\nFrom: Marty Goldmintz <marty.goldmintz@adv-tech.com>\n\nPlease send .rtf for Opportunity 17797 - Project with A360 New Client. Eaglesoft, server with 10 workstations. OTA set for Tuesday August 18th at 1:00 P.M.\nMarty Goldmintz | Technology Consultant\nAdvantage Technologies`);

  assert.equal(companyKey(ota.company), "medure dental");
  assert.equal(ota.appointmentDate, "2026-08-18");
  assert.equal(ota.appointmentTime, "13:00:00");
  assert.equal(ota.tcName, "Marty Goldmintz");
});

test("confirmed schedule beats a tentative time change", async () => {
  const { parseOtaEmailBatch } = await loadLogic();
  const [ota] = parseOtaEmailBatch(`Subject: OTA - Example Dental\n\nOTA booked for 8/26/26 at noon.\nHe may move it to 1:00 and will call me if so.`);
  assert.equal(ota.appointmentDate, "2026-08-26");
  assert.equal(ota.appointmentTime, "12:00:00");
});

test("OTA dashboard uses Latest OTAs as the primary view", () => {
  const dashboard = fs.readFileSync(new URL("../src/app/ota-tracker/ota-tracker-dashboard.tsx", import.meta.url), "utf8");
  assert.match(dashboard, /useState<FilterKey>\("latest"\)/);
  assert.match(dashboard, /isOtaInLatestWindow\(row\.appointment_date, today\)/);
  assert.match(dashboard, /compareLatestOtaDates\(left\.appointment_date, right\.appointment_date, today\)/);
});
