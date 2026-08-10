import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const cleanModeCss = fs.readFileSync(new URL("../src/app/presentation-clean-mode.css", import.meta.url), "utf8");
const layout = fs.readFileSync(new URL("../src/app/layout.tsx", import.meta.url), "utf8");

test("presentation mode keeps one working vertical scroll surface", () => {
  assert.match(cleanModeCss, /\.presentation-stage\s*\{[\s\S]*?min-height:\s*0\s*!important;/);
  assert.match(cleanModeCss, /\.presentation-stage\s*\{[\s\S]*?overflow-y:\s*auto\s*!important;/);
  assert.match(cleanModeCss, /\.presentation-overlay\s*\{[\s\S]*?overflow:\s*hidden\s*!important;/);
  assert.match(cleanModeCss, /\.presentation-shell\s*\{[\s\S]*?overflow:\s*hidden\s*!important;/);
});

test("presentation scrollbar stays thin and styled", () => {
  assert.match(cleanModeCss, /scrollbar-width:\s*thin/);
  assert.match(cleanModeCss, /scrollbar-color:/);
  assert.match(cleanModeCss, /\.presentation-stage::\-webkit-scrollbar\s*\{[\s\S]*?width:\s*7px/);
  assert.match(cleanModeCss, /\.presentation-stage::\-webkit-scrollbar-thumb/);
});

test("presentation clean-mode overrides load last", () => {
  const importPosition = layout.lastIndexOf('import "./presentation-clean-mode.css";');
  assert.ok(importPosition >= 0);
  assert.equal(layout.slice(importPosition).trim(), 'import "./presentation-clean-mode.css";\n\nexport const metadata: Metadata = {\n  title: "Client Compass",\n  description: "Advantage Technologies project opportunity and client planning workspace",\n  manifest: "/client-compass.webmanifest?v=110-max",\n  icons: {\n    icon: [{ url: "/client-compass-favicon.svg?v=110-max", type: "image/svg+xml", sizes: "any" }],\n    shortcut: "/client-compass-favicon.svg?v=110-max",\n    apple: "/client-compass-icon.png?v=10926",\n  },\n};\n\nexport default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {\n  return (\n    <html lang="en">\n      <body>{children}<ClientCompassRuntime /><AgeDisplayRuntime /></body>\n    </html>\n  );\n}');
});
