import fs from "node:fs";
import path from "node:path";

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function replaceOnce(file, before, after, label = before.slice(0, 80)) {
  const source = read(file);
  if (!source.includes(before)) throw new Error(`Could not find ${label} in ${file}`);
  write(file, source.replace(before, after));
}

function replaceRegex(file, pattern, after, label) {
  const source = read(file);
  if (!pattern.test(source)) throw new Error(`Could not find ${label} in ${file}`);
  write(file, source.replace(pattern, after));
}

const typesFile = "src/lib/segments/types.ts";
replaceOnce(
  typesFile,
  [
    '  | "physical-servers"',
    '  | "workstations"',
    '  | "server-os"',
    '  | "virtual-server-os"',
    '  | "workstation-os"',
  ].join("\n"),
  [
    '  | "physical-servers"',
    '  | "physical-server-age-years"',
    '  | "virtual-servers"',
    '  | "workstations"',
    '  | "workstation-age-years"',
    '  | "server-os"',
    '  | "virtual-server-os"',
    '  | "workstation-os"',
  ].join("\n"),
  "segment device fields",
);
replaceOnce(
  typesFile,
  [
    "  physicalServers: number;",
    "  virtualServers: number;",
    "  workstations: number;",
    "  physicalServerOs: string[];",
  ].join("\n"),
  [
    "  physicalServers: number;",
    "  physicalServerAgeYears: number | null;",
    "  virtualServers: number;",
    "  workstations: number;",
    "  workstationAgeYears: number | null;",
    "  physicalServerOs: string[];",
  ].join("\n"),
  "segment age metrics",
);

const engineFile = "src/lib/segments/engine.ts";
replaceOnce(
  engineFile,
  'import type { CompassConfig, CompassDataset } from "@/lib/compass/types";',
  'import type { CompassConfig, CompassDataset } from "@/lib/compass/types";\nimport { technicalAgeYears } from "@/lib/technical-truth";',
  "technical age import",
);
replaceOnce(
  engineFile,
  'export type SegmentRuleFieldKind = "number" | "text" | "boolean" | "os";\nexport interface SegmentOsOption { value: string; label: string; }',
  [
    'export type SegmentRuleFieldKind = "number" | "text" | "boolean" | "os";',
    'export type SegmentRuleFieldGroup = "Device age" | "Device counts" | "Operating system" | "Opportunity & priority" | "Workflow & activity" | "Client details";',
    'export interface SegmentOsOption { value: string; label: string; }',
    'export interface SegmentRuleFieldOption {',
    '  id: SegmentRuleField;',
    '  label: string;',
    '  kind: SegmentRuleFieldKind;',
    '  group: SegmentRuleFieldGroup;',
    '  unit?: string;',
    '  prefix?: string;',
    '  step?: number;',
    '  defaultValue?: string;',
    '}',
  ].join("\n"),
  "segment field metadata types",
);
replaceRegex(
  engineFile,
  /export const SEGMENT_RULE_FIELDS: Array<\{ id: SegmentRuleField; label: string; kind: SegmentRuleFieldKind \}> = \[[\s\S]*?\n\];\n\nexport const SEGMENT_STAT_OPTIONS/,
  [
    'export const SEGMENT_RULE_GROUPS: SegmentRuleFieldGroup[] = [',
    '  "Device age",',
    '  "Device counts",',
    '  "Operating system",',
    '  "Opportunity & priority",',
    '  "Workflow & activity",',
    '  "Client details",',
    '];',
    '',
    'export const SEGMENT_RULE_FIELDS: SegmentRuleFieldOption[] = [',
    '  { id: "physical-server-age-years", label: "Physical server age", kind: "number", group: "Device age", unit: "years", step: 1, defaultValue: "5" },',
    '  { id: "workstation-age-years", label: "Physical workstation age", kind: "number", group: "Device age", unit: "years", step: 1, defaultValue: "5" },',
    '  { id: "managed-assets", label: "Managed devices", kind: "number", group: "Device counts", unit: "devices", step: 1, defaultValue: "1" },',
    '  { id: "physical-servers", label: "Physical servers", kind: "number", group: "Device counts", unit: "servers", step: 1, defaultValue: "1" },',
    '  { id: "virtual-servers", label: "Virtual servers", kind: "number", group: "Device counts", unit: "servers", step: 1, defaultValue: "1" },',
    '  { id: "workstations", label: "Workstations", kind: "number", group: "Device counts", unit: "workstations", step: 1, defaultValue: "1" },',
    '  { id: "replace-now", label: "Replace Now workstations", kind: "number", group: "Device counts", unit: "workstations", step: 1, defaultValue: "1" },',
    '  { id: "plan-soon", label: "Plan Soon workstations", kind: "number", group: "Device counts", unit: "workstations", step: 1, defaultValue: "1" },',
    '  { id: "healthy", label: "Current workstations", kind: "number", group: "Device counts", unit: "workstations", step: 1, defaultValue: "1" },',
    '  { id: "server-os", label: "Physical server OS", kind: "os", group: "Operating system" },',
    '  { id: "virtual-server-os", label: "Virtual server OS", kind: "os", group: "Operating system" },',
    '  { id: "workstation-os", label: "Workstation OS", kind: "os", group: "Operating system" },',
    '  { id: "estimated-value", label: "Estimated project value", kind: "number", group: "Opportunity & priority", prefix: "$", step: 1000, defaultValue: "0" },',
    '  { id: "priority-score", label: "Priority score", kind: "number", group: "Opportunity & priority", unit: "points", step: 1, defaultValue: "0" },',
    '  { id: "account-review-age-days", label: "Time since account review", kind: "number", group: "Workflow & activity", unit: "days", step: 1, defaultValue: "0" },',
    '  { id: "quote-age-days", label: "Time since quote", kind: "number", group: "Workflow & activity", unit: "days", step: 1, defaultValue: "0" },',
    '  { id: "quoted", label: "Quote status", kind: "boolean", group: "Workflow & activity" },',
    '  { id: "activity-tracked", label: "Captain\'s Log activity", kind: "boolean", group: "Workflow & activity" },',
    '  { id: "assigned-owner", label: "Assigned owner", kind: "text", group: "Client details" },',
    '  { id: "city", label: "Client city", kind: "text", group: "Client details" },',
    '  { id: "state", label: "Client state", kind: "text", group: "Client details" },',
    '  { id: "market", label: "Territory / market", kind: "text", group: "Client details" },',
    '  { id: "industry", label: "Industry / vertical", kind: "text", group: "Client details" },',
    '  { id: "client-tags", label: "Client tags", kind: "text", group: "Client details" },',
    '  { id: "location-contains", label: "Hardware location", kind: "text", group: "Client details" },',
    '  { id: "client-name-contains", label: "Client name", kind: "text", group: "Client details" },',
    '];',
    '',
    'export const SEGMENT_STAT_OPTIONS',
  ].join("\n"),
  "segment rule field catalog",
);
replaceOnce(
  engineFile,
  [
    'export function segmentFieldKind(field: SegmentRuleField): SegmentRuleFieldKind {',
    '  return SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.kind ?? "number";',
    '}',
  ].join("\n"),
  [
    'export function segmentFieldKind(field: SegmentRuleField): SegmentRuleFieldKind {',
    '  return SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.kind ?? "number";',
    '}',
    '',
    'export function segmentFieldUnit(field: SegmentRuleField): string {',
    '  return SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.unit ?? "";',
    '}',
    '',
    'export function segmentFieldPrefix(field: SegmentRuleField): string {',
    '  return SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.prefix ?? "";',
    '}',
    '',
    'export function segmentFieldStep(field: SegmentRuleField): number {',
    '  return SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.step ?? 1;',
    '}',
    '',
    'export function segmentFieldDefaultValue(field: SegmentRuleField): string {',
    '  return SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.defaultValue ?? (segmentFieldKind(field) === "number" ? "0" : "");',
    '}',
  ].join("\n"),
  "segment field helpers",
);
replaceRegex(
  engineFile,
  /export function segmentOperatorLabel\(operator: SegmentRuleOperator\): string \{[\s\S]*?\n\}/,
  [
    'export function segmentOperatorLabel(operator: SegmentRuleOperator, field?: SegmentRuleField): string {',
    '  const group = field ? SEGMENT_RULE_FIELDS.find((item) => item.id === field)?.group : undefined;',
    '  if (operator === "gte") return "at least";',
    '  if (operator === "lte") return "at most";',
    '  if (operator === "gt") return group === "Device age" ? "older than" : group === "Device counts" ? "more than" : "greater than";',
    '  if (operator === "lt") return group === "Device age" ? "younger than" : group === "Device counts" ? "fewer than" : "less than";',
    '  if (operator === "contains") return "contains";',
    '  if (operator === "not-contains") return "does not contain";',
    '  if (operator === "is") return "is";',
    '  return group === "Device age" || group === "Device counts" ? "exactly" : "equals";',
    '}',
  ].join("\n"),
  "unit-aware operator labels",
);
replaceOnce(
  engineFile,
  [
    '  const devices = dataset.devices.filter((device) => device.clientId === clientId);',
    '  const summary = dataset.summaries.find((item) => item.clientId === clientId);',
    '  return {',
  ].join("\n"),
  [
    '  const devices = dataset.devices.filter((device) => device.clientId === clientId);',
    '  const summary = dataset.summaries.find((item) => item.clientId === clientId);',
    '  const physicalServers = devices.filter((device) => device.deviceType === "physical-server");',
    '  const virtualServers = devices.filter((device) => device.deviceType === "virtual-server");',
    '  const physicalWorkstations = devices.filter((device) => device.deviceType === "physical-workstation");',
    '  const workstations = devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation");',
    '  const oldestAgeYears = (items: typeof devices): number | null => {',
    '    const ages = items.map((device) => technicalAgeYears(device.warrantyStart, now)).filter((age): age is number => age !== null);',
    '    return ages.length ? Math.max(...ages) : null;',
    '  };',
    '  return {',
  ].join("\n"),
  "segment metric device buckets",
);
replaceOnce(
  engineFile,
  [
    '    replaceNow: devices.filter((device) => device.lifecycle === "replace-now").length,',
    '    planSoon: devices.filter((device) => device.lifecycle === "plan-soon").length,',
    '    healthy: devices.filter((device) => device.lifecycle === "current").length,',
    '    physicalServers: devices.filter((device) => device.deviceType === "physical-server").length,',
    '    virtualServers: devices.filter((device) => device.deviceType === "virtual-server").length,',
    '    workstations: devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").length,',
    '    physicalServerOs: uniqueTokens(devices.filter((device) => device.deviceType === "physical-server").flatMap((device) => serverOsTokens(device.osName))),',
    '    virtualServerOs: uniqueTokens(devices.filter((device) => device.deviceType === "virtual-server").flatMap((device) => serverOsTokens(device.osName))),',
    '    workstationOs: uniqueTokens(devices.filter((device) => device.deviceType === "physical-workstation" || device.deviceType === "virtual-workstation").flatMap((device) => workstationOsTokens(device.osName))),',
  ].join("\n"),
  [
    '    replaceNow: physicalWorkstations.filter((device) => device.lifecycle === "replace-now").length,',
    '    planSoon: physicalWorkstations.filter((device) => device.lifecycle === "plan-soon").length,',
    '    healthy: physicalWorkstations.filter((device) => device.lifecycle === "current").length,',
    '    physicalServers: physicalServers.length,',
    '    physicalServerAgeYears: oldestAgeYears(physicalServers),',
    '    virtualServers: virtualServers.length,',
    '    workstations: workstations.length,',
    '    workstationAgeYears: oldestAgeYears(physicalWorkstations),',
    '    physicalServerOs: uniqueTokens(physicalServers.flatMap((device) => serverOsTokens(device.osName))),',
    '    virtualServerOs: uniqueTokens(virtualServers.flatMap((device) => serverOsTokens(device.osName))),',
    '    workstationOs: uniqueTokens(workstations.flatMap((device) => workstationOsTokens(device.osName))),',
  ].join("\n"),
  "segment lifecycle and age metrics",
);
replaceOnce(
  engineFile,
  [
    '  if (field === "physical-servers") return metrics.physicalServers;',
    '  if (field === "workstations") return metrics.workstations;',
  ].join("\n"),
  [
    '  if (field === "physical-servers") return metrics.physicalServers;',
    '  if (field === "physical-server-age-years") return metrics.physicalServerAgeYears;',
    '  if (field === "virtual-servers") return metrics.virtualServers;',
    '  if (field === "workstations") return metrics.workstations;',
    '  if (field === "workstation-age-years") return metrics.workstationAgeYears;',
  ].join("\n"),
  "numeric age metrics",
);
replaceRegex(
  engineFile,
  /export function segmentRuleSummary\(rule: SegmentRule\): string \{[\s\S]*?\n\}\s*$/,
  [
    'function formatSegmentNumericRuleValue(field: SegmentRuleField, raw: string): string {',
    '  const numeric = Number(raw);',
    '  if (!Number.isFinite(numeric)) return raw;',
    '  const prefix = segmentFieldPrefix(field);',
    '  if (prefix === "$") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(numeric);',
    '  const value = Number.isInteger(numeric) ? numeric.toLocaleString() : numeric.toLocaleString(undefined, { maximumFractionDigits: 1 });',
    '  const unit = segmentFieldUnit(field);',
    '  return unit ? `${value} ${unit}` : value;',
    '}',
    '',
    'export function segmentRuleSummary(rule: SegmentRule): string {',
    '  const field = SEGMENT_RULE_FIELDS.find((item) => item.id === rule.field)?.label ?? rule.field;',
    '  const kind = segmentFieldKind(rule.field);',
    '  const value = kind === "boolean"',
    '    ? (["1", "true", "yes", "y"].includes(normalizedText(rule.value)) ? "Yes" : "No")',
    '    : kind === "os"',
    '      ? (segmentOsOptions(rule.field).find((option) => option.value === rule.value)?.label ?? rule.value)',
    '      : kind === "number"',
    '        ? formatSegmentNumericRuleValue(rule.field, rule.value)',
    '        : rule.value;',
    '  return `${field} ${segmentOperatorLabel(rule.operator, rule.field)} ${value}`;',
    '}',
    '',
  ].join("\n"),
  "unit-aware rule summary",
);

const editorFile = "src/components/segment-editor-dialog.tsx";
replaceOnce(
  editorFile,
  [
    '  SEGMENT_RULE_FIELDS,',
    '  SEGMENT_STAT_OPTIONS,',
    '  operatorsForSegmentField,',
    '  segmentFieldKind,',
    '  segmentOperatorLabel,',
    '  segmentOsOptions,',
  ].join("\n"),
  [
    '  SEGMENT_RULE_FIELDS,',
    '  SEGMENT_RULE_GROUPS,',
    '  SEGMENT_STAT_OPTIONS,',
    '  operatorsForSegmentField,',
    '  segmentFieldDefaultValue,',
    '  segmentFieldKind,',
    '  segmentFieldPrefix,',
    '  segmentFieldStep,',
    '  segmentFieldUnit,',
    '  segmentOperatorLabel,',
    '  segmentOsOptions,',
  ].join("\n"),
  "segment editor imports",
);
replaceOnce(
  editorFile,
  'Build by state/location, need, size, lifecycle, OS, owner, activity, or any combination.',
  'Build with device age, device counts, operating system, opportunity, workflow, or client details.',
  "segment rules description",
);
replaceOnce(
  editorFile,
  [
    '            const operators = operatorsForSegmentField(rule.field);',
    '            const kind = segmentFieldKind(rule.field);',
    '            return <div className="segment-rule-row" key={rule.id}>',
  ].join("\n"),
  [
    '            const operators = operatorsForSegmentField(rule.field);',
    '            const kind = segmentFieldKind(rule.field);',
    '            const unit = segmentFieldUnit(rule.field);',
    '            const prefix = segmentFieldPrefix(rule.field);',
    '            const step = segmentFieldStep(rule.field);',
    '            return <div className="segment-rule-row" key={rule.id}>',
  ].join("\n"),
  "segment rule unit metadata",
);
replaceOnce(
  editorFile,
  '                const value = nextKind === "boolean" ? "true" : nextKind === "os" ? (segmentOsOptions(field)[0]?.value ?? "") : "";',
  '                const value = nextKind === "boolean" ? "true" : nextKind === "os" ? (segmentOsOptions(field)[0]?.value ?? "") : nextKind === "number" ? segmentFieldDefaultValue(field) : "";',
  "segment field default values",
);
replaceOnce(
  editorFile,
  '              }}>{SEGMENT_RULE_FIELDS.map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</select>',
  '              }}>{SEGMENT_RULE_GROUPS.map((group) => <optgroup key={group} label={group}>{SEGMENT_RULE_FIELDS.filter((field) => field.group === group).map((field) => <option key={field.id} value={field.id}>{field.label}</option>)}</optgroup>)}</select>',
  "grouped segment field options",
);
replaceOnce(
  editorFile,
  '              <select value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as SegmentRuleOperator })}>{operators.map((operator) => <option key={operator} value={operator}>{segmentOperatorLabel(operator)}</option>)}</select>',
  '              <select value={rule.operator} onChange={(event) => updateRule(rule.id, { operator: event.target.value as SegmentRuleOperator })}>{operators.map((operator) => <option key={operator} value={operator}>{segmentOperatorLabel(operator, rule.field)}</option>)}</select>',
  "field-aware operator labels",
);
replaceOnce(
  editorFile,
  [
    '              {kind === "boolean" ? <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })}><option value="true">Yes</option><option value="false">No</option></select>',
    '                : kind === "os" ? <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })}>{segmentOsOptions(rule.field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>',
    '                  : <input type={kind === "number" ? "number" : "text"} value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder={kind === "number" ? "0" : "Value"} />}',
  ].join("\n"),
  [
    '              {kind === "boolean" ? <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })}><option value="true">Yes</option><option value="false">No</option></select>',
    '                : kind === "os" ? <select value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })}>{segmentOsOptions(rule.field).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>',
    '                  : kind === "number" ? <div className={`segment-rule-number${prefix ? " has-prefix" : ""}${unit ? " has-unit" : ""}`}>',
    '                    {prefix && <span className="segment-rule-number-prefix" aria-hidden="true">{prefix}</span>}',
    '                    <input type="number" min="0" step={step} value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="0" />',
    '                    {unit && <span className="segment-rule-number-unit" aria-hidden="true">{unit}</span>}',
    '                  </div>',
    '                    : <input type="text" value={rule.value} onChange={(event) => updateRule(rule.id, { value: event.target.value })} placeholder="Value" />}',
  ].join("\n"),
  "unit-aware segment value controls",
);

const mapFile = "src/components/territory-map-page.tsx";
replaceOnce(
  mapFile,
  'import { useEffect, useMemo, useState } from "react";',
  'import { useEffect, useMemo, useRef, useState } from "react";',
  "map useRef import",
);
replaceOnce(
  mapFile,
  'import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";',
  'import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";',
  "map pointer event import",
);
replaceOnce(
  mapFile,
  'type ListScope = { title: string; state: string; clientIds: string[] } | null;',
  [
    'type ListScope = { title: string; state: string; clientIds: string[] } | null;',
    'type MapPan = { x: number; y: number };',
    'type MapDragState = { pointerId: number; startClientX: number; startClientY: number; startPan: MapPan; moved: boolean };',
  ].join("\n"),
  "map pan types",
);
replaceRegex(
  mapFile,
  /function viewBoxForZoom\(zoom: number\): string \{[\s\S]*?\n\}/,
  [
    'function clampMapPan(pan: MapPan, zoom: number): MapPan {',
    '  if (zoom <= 1) return { x: 0, y: 0 };',
    '  const visibleWidth = BASE_VIEWBOX.width / zoom;',
    '  const visibleHeight = BASE_VIEWBOX.height / zoom;',
    '  const maxX = Math.max(0, (BASE_VIEWBOX.width - visibleWidth) / 2);',
    '  const maxY = Math.max(0, (BASE_VIEWBOX.height - visibleHeight) / 2);',
    '  return { x: Math.max(-maxX, Math.min(maxX, pan.x)), y: Math.max(-maxY, Math.min(maxY, pan.y)) };',
    '}',
    '',
    'function viewBoxForZoom(zoom: number, pan: MapPan): string {',
    '  const width = BASE_VIEWBOX.width / zoom;',
    '  const height = BASE_VIEWBOX.height / zoom;',
    '  const safePan = clampMapPan(pan, zoom);',
    '  const centerX = BASE_VIEWBOX.x + BASE_VIEWBOX.width / 2 + safePan.x;',
    '  const centerY = BASE_VIEWBOX.y + BASE_VIEWBOX.height / 2 + safePan.y;',
    '  return `${centerX - width / 2} ${centerY - height / 2} ${width} ${height}`;',
    '}',
  ].join("\n"),
  "map viewbox pan",
);
replaceOnce(
  mapFile,
  [
    '  const [settingsOpen, setSettingsOpen] = useState(false);',
    '  const [zoom, setZoom] = useState(1);',
    '  const [hoveredRegionId, setHoveredRegionId] = useState("");',
  ].join("\n"),
  [
    '  const [settingsOpen, setSettingsOpen] = useState(false);',
    '  const [zoom, setZoom] = useState(1);',
    '  const [pan, setPan] = useState<MapPan>({ x: 0, y: 0 });',
    '  const [dragging, setDragging] = useState(false);',
    '  const mapDragRef = useRef<MapDragState | null>(null);',
    '  const suppressMapClickRef = useRef(false);',
    '  const [hoveredRegionId, setHoveredRegionId] = useState("");',
  ].join("\n"),
  "map pan state",
);
replaceOnce(
  mapFile,
  [
    '  const openFocusedClients = () => {',
    '    if (focusRegion) {',
    '      setListScope({ title: `${focusRegion.name} clients`, state: focusRegion.state, clientIds: focusRegion.clientIds });',
    '      return;',
    '    }',
    '    if (focusState) setListScope({ title: `${focusState} clients`, state: focusState, clientIds: stateRegions.flatMap((region) => region.clientIds) });',
    '  };',
    '',
    '  return <div className="territory-map-page">',
  ].join("\n"),
  [
    '  const openFocusedClients = () => {',
    '    if (focusRegion) {',
    '      setListScope({ title: `${focusRegion.name} clients`, state: focusRegion.state, clientIds: focusRegion.clientIds });',
    '      return;',
    '    }',
    '    if (focusState) setListScope({ title: `${focusState} clients`, state: focusState, clientIds: stateRegions.flatMap((region) => region.clientIds) });',
    '  };',
    '',
    '  const changeZoom = (nextZoom: number) => {',
    '    const value = Math.max(1, Math.min(1.6, Number(nextZoom.toFixed(2))));',
    '    setZoom(value);',
    '    setPan((current) => clampMapPan(current, value));',
    '  };',
    '',
    '  const beginMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {',
    '    if (zoom <= 1 || event.button !== 0) return;',
    '    event.currentTarget.setPointerCapture(event.pointerId);',
    '    mapDragRef.current = { pointerId: event.pointerId, startClientX: event.clientX, startClientY: event.clientY, startPan: pan, moved: false };',
    '    setDragging(true);',
    '  };',
    '',
    '  const moveMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {',
    '    const drag = mapDragRef.current;',
    '    if (!drag || drag.pointerId !== event.pointerId) return;',
    '    const rect = event.currentTarget.getBoundingClientRect();',
    '    if (!rect.width || !rect.height) return;',
    '    const dx = event.clientX - drag.startClientX;',
    '    const dy = event.clientY - drag.startClientY;',
    '    if (!drag.moved && Math.hypot(dx, dy) >= 3) {',
    '      drag.moved = true;',
    '      suppressMapClickRef.current = true;',
    '      setHoveredRegionId("");',
    '    }',
    '    if (!drag.moved) return;',
    '    event.preventDefault();',
    '    const visibleWidth = BASE_VIEWBOX.width / zoom;',
    '    const visibleHeight = BASE_VIEWBOX.height / zoom;',
    '    setPan(clampMapPan({',
    '      x: drag.startPan.x - (dx * visibleWidth / rect.width),',
    '      y: drag.startPan.y - (dy * visibleHeight / rect.height),',
    '    }, zoom));',
    '  };',
    '',
    '  const endMapPan = (event: ReactPointerEvent<SVGSVGElement>) => {',
    '    const drag = mapDragRef.current;',
    '    if (!drag || drag.pointerId !== event.pointerId) return;',
    '    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);',
    '    mapDragRef.current = null;',
    '    setDragging(false);',
    '  };',
    '',
    '  return <div className="territory-map-page">',
  ].join("\n"),
  "map pan handlers",
);
replaceOnce(
  mapFile,
  '        <svg className={`territory-regional-map${focusState || focusRegion ? " has-active" : ""}`} viewBox={viewBoxForZoom(zoom)} role="img" aria-label="Advantage Technologies service-area territory map" onClick={(event) => { if (event.currentTarget === event.target) clearSelection(); }}>',
  '        <svg className={`territory-regional-map${focusState || focusRegion ? " has-active" : ""}${zoom > 1 ? " is-pannable" : ""}${dragging ? " is-dragging" : ""}`} viewBox={viewBoxForZoom(zoom, pan)} role="img" aria-label="Advantage Technologies service-area territory map" onPointerDown={beginMapPan} onPointerMove={moveMapPan} onPointerUp={endMapPan} onPointerCancel={endMapPan} onClickCapture={(event) => { if (suppressMapClickRef.current) { event.preventDefault(); event.stopPropagation(); suppressMapClickRef.current = false; } }} onClick={(event) => { if (event.currentTarget === event.target) clearSelection(); }}>',
  "pannable map svg",
);
replaceOnce(
  mapFile,
  '        <div className="territory-map-zoom" aria-label="Map zoom controls"><button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - .15).toFixed(2))))} disabled={zoom <= 1}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => setZoom((value) => Math.min(1.6, Number((value + .15).toFixed(2))))} disabled={zoom >= 1.6}>+</button></div>',
  '        <div className="territory-map-zoom" aria-label="Map zoom controls" title={zoom > 1 ? "Drag the map to pan" : "Zoom in, then drag to pan"}><button type="button" onClick={() => changeZoom(zoom - .15)} disabled={zoom <= 1}>−</button><span>{Math.round(zoom * 100)}%</span><button type="button" onClick={() => changeZoom(zoom + .15)} disabled={zoom >= 1.6}>+</button></div>',
  "map zoom controls",
);

replaceOnce(
  "src/app/layout.tsx",
  'import "./v10927-polish.css";',
  'import "./v10927-polish.css";\nimport "./v10928-polish.css";',
  "v10928 stylesheet import",
);
replaceOnce("src/lib/app-version.ts", 'export const APP_VERSION = "1.0.9.27";', 'export const APP_VERSION = "1.0.9.28";', "app version");
replaceOnce("package.json", '"version": "1.0.9.27"', '"version": "1.0.9.28"', "package version");

write("src/app/v10928-polish.css", `/* Client Compass v1.0.9.28 — segment criteria clarity and territory map panning */
.segment-rule-number{position:relative;min-width:0}.segment-rule-number input{width:100%;padding-right:11px}.segment-rule-number.has-prefix input{padding-left:27px}.segment-rule-number.has-unit input{padding-right:82px}.segment-rule-number-prefix,.segment-rule-number-unit{position:absolute;top:50%;z-index:2;transform:translateY(-50%);pointer-events:none;color:#70839a;font-size:9px;font-weight:850}.segment-rule-number-prefix{left:11px}.segment-rule-number-unit{right:11px;max-width:66px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}.segment-rule-row select optgroup{font-weight:850;color:#45637f}.segment-rule-row select option{font-weight:500;color:#183553}
.territory-regional-map.is-pannable{cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}.territory-regional-map.is-pannable .territory-map-region{cursor:grab}.territory-regional-map.is-dragging,.territory-regional-map.is-dragging .territory-map-region{cursor:grabbing}.territory-regional-map.is-dragging *{user-select:none;-webkit-user-select:none}
@media (max-width:760px){.segment-rule-number.has-unit input{padding-right:68px}.segment-rule-number-unit{max-width:54px;font-size:8px}}
`);

write("RELEASE_NOTES_v1.0.9.28.md", `# Client Compass v1.0.9.28

- Reorganizes managed-segment criteria into device age, device counts, operating system, opportunity/priority, workflow/activity, and client detail groups.
- Adds first-class Physical server age and Physical workstation age criteria using the same warranty-start age calculation as Client Compass technical reporting.
- Makes numeric rule inputs visibly unit-aware: years, devices, servers, workstations, dollars, points, and days.
- Clarifies ambiguous lifecycle labels so Replace Now, Plan Soon, and Current counts refer to physical workstations.
- Adds Virtual servers as an explicit count criterion.
- Renames Server OS to Physical server OS while retaining separate Virtual server OS and Workstation OS criteria.
- Adds click-and-drag / touch panning to the territory map when zoomed, with bounded pan limits and drag-click suppression.
`);

const testRoot = "tests";
for (const entry of fs.readdirSync(testRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".test.mjs")) continue;
  const file = path.join(testRoot, entry.name);
  const source = read(file);
  if (source.includes("1.0.9.27")) write(file, source.replaceAll("1.0.9.27", "1.0.9.28"));
}

write("tests/v10928-segment-units-map-pan.test.mjs", `import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { transpileTestModule } from "./test-transpile-helper.mjs";

const editor = fs.readFileSync(new URL("../src/components/segment-editor-dialog.tsx", import.meta.url), "utf8");
const mapPage = fs.readFileSync(new URL("../src/components/territory-map-page.tsx", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/app/v10928-polish.css", import.meta.url), "utf8");

async function runtime() {
  return transpileTestModule("../src/lib/segments/engine.ts", import.meta.url, { prefix: "v10928-segment-units" });
}

function device(clientId, id, deviceType, warrantyStart, lifecycle = "current") {
  return { id, clientId, deviceType, warrantyStart, lifecycle, osName: "", isVirtual: deviceType.startsWith("virtual") };
}

test("v1.0.9.28 groups criteria by meaning and exposes explicit age units", async () => {
  const { SEGMENT_RULE_GROUPS, SEGMENT_RULE_FIELDS, segmentFieldUnit, segmentFieldDefaultValue } = await runtime();
  assert.deepEqual(SEGMENT_RULE_GROUPS, ["Device age", "Device counts", "Operating system", "Opportunity & priority", "Workflow & activity", "Client details"]);
  assert.equal(SEGMENT_RULE_FIELDS.find((field) => field.id === "physical-server-age-years")?.label, "Physical server age");
  assert.equal(SEGMENT_RULE_FIELDS.find((field) => field.id === "workstation-age-years")?.label, "Physical workstation age");
  assert.equal(SEGMENT_RULE_FIELDS.find((field) => field.id === "server-os")?.label, "Physical server OS");
  assert.equal(SEGMENT_RULE_FIELDS.some((field) => field.id === "virtual-servers"), true);
  assert.equal(segmentFieldUnit("physical-server-age-years"), "years");
  assert.equal(segmentFieldDefaultValue("physical-server-age-years"), "5");
  assert.match(editor, /<optgroup key=\{group\} label=\{group\}>/);
  assert.match(editor, /segment-rule-number-unit/);
});

test("physical server and workstation age criteria use oldest known warranty-start age", async () => {
  const { buildSegmentClientMetrics, segmentRuleMatches } = await runtime();
  const dataset = {
    clients: [{ id: "c1", name: "Example", assignedOwner: "", city: "", state: "", market: "", industry: "", tags: [], lastAccountReview: "", lastQuoteDate: "", quoted: false }],
    devices: [
      device("c1", "server-old", "physical-server", "2019-01-01"),
      device("c1", "server-new", "physical-server", "2024-01-01"),
      device("c1", "ws-old", "physical-workstation", "2020-01-01", "replace-now"),
      device("c1", "ws-new", "physical-workstation", "2025-01-01", "current"),
      device("c1", "vm", "virtual-server", "2020-01-01"),
    ],
    summaries: [{ clientId: "c1", totalEstimatedValue: 0, priorityScore: 0 }],
    locations: [],
  };
  const metrics = buildSegmentClientMetrics(dataset, "c1", new Date("2026-08-08T12:00:00Z"));
  assert.ok(metrics);
  assert.equal(metrics.physicalServers, 2);
  assert.equal(metrics.virtualServers, 1);
  assert.equal(metrics.replaceNow, 1);
  assert.equal(metrics.healthy, 1);
  assert.ok(metrics.physicalServerAgeYears > 7);
  assert.ok(metrics.workstationAgeYears > 6);
  assert.equal(segmentRuleMatches({ id: "server-age", field: "physical-server-age-years", operator: "gte", value: "7" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "ws-age", field: "workstation-age-years", operator: "gte", value: "6" }, metrics), true);
  assert.equal(segmentRuleMatches({ id: "virtual-count", field: "virtual-servers", operator: "gte", value: "1" }, metrics), true);
});

test("territory map supports bounded pointer drag panning without turning drags into selections", () => {
  assert.match(mapPage, /type MapPan =/);
  assert.match(mapPage, /clampMapPan/);
  assert.match(mapPage, /onPointerDown=\{beginMapPan\}/);
  assert.match(mapPage, /onPointerMove=\{moveMapPan\}/);
  assert.match(mapPage, /onPointerUp=\{endMapPan\}/);
  assert.match(mapPage, /suppressMapClickRef/);
  assert.match(mapPage, /viewBox=\{viewBoxForZoom\(zoom, pan\)\}/);
  assert.match(css, /cursor:grab/);
  assert.match(css, /touch-action:none/);
});
`);
