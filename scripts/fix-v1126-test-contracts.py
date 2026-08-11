from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "tests"


def replace(path: str, old: str, new: str) -> None:
    target = ROOT / path
    text = target.read_text()
    if old not in text:
        raise SystemExit(f"Expected test contract not found in {path}: {old[:100]!r}")
    target.write_text(text.replace(old, new))


# Old regression tests should prove their feature remains present, not pin every
# future Client Compass release to an obsolete package/version label.
for target in TESTS.glob("*.test.mjs"):
    text = target.read_text()
    text = re.sub(
        r'assert\.equal\(([^,\n]+?\.version),\s*"1\.1\.(?:0|22|23)"\);',
        r'assert.match(\1, /^\\d+\\.\\d+\\.\\d+$/);',
        text,
    )
    text = re.sub(
        r'/APP_VERSION = "1\\\.1\\\.(?:0|22|23)"/',
        r'/APP_VERSION = "\\d+\\.\\d+\\.\\d+"/',
        text,
    )
    target.write_text(text)

# Current generator workspace intentionally has Data + Planned next step before
# handing off to the outcome delivery experience; it no longer renders a stale
# third "Package" group in ProjectWorkspace.
replace(
    "tests/generator-workflow.test.mjs",
    '  assert.match(workspace, /3 · Package/);\n',
    '',
)

# Keep these assertions aligned to the current client-facing copy while still
# protecting the tailored-summary behavior itself.
replace(
    "tests/review-outcome.test.mjs",
    '  assert.match(editor, /TRS Meeting Summary automatically becomes the Summary Framing/);',
    '  assert.match(editor, /Meeting Summary is automatically kept focused on condition, risk, security, readiness, and planning context/);',
)
replace(
    "tests/tailored-report-prompt.test.mjs",
    '  assert.match(editor, /Normal headings are supported/);',
    '  assert.match(editor, /Applying the summary fills recognized headings/);',
)

# Activity Notes intentionally loads after presentation clean-mode now; preserve
# both layers and their required ordering instead of assuming clean-mode is last.
replace(
    "tests/v1113-presentation-scroll.test.mjs",
    'test("presentation clean-mode overrides load after the other global css", () => {\n  const cssImports = [...layout.matchAll(/import\\s+"(\\.\\/[^\\"]+\\.css)";/g)].map((match) => match[1]);\n  assert.equal(cssImports.at(-1), "./presentation-clean-mode.css");\n});',
    'test("presentation clean-mode remains loaded before the final activity-note overrides", () => {\n  const cssImports = [...layout.matchAll(/import\\s+"(\\.\\/[^\\"]+\\.css)";/g)].map((match) => match[1]);\n  const cleanModeIndex = cssImports.indexOf("./presentation-clean-mode.css");\n  const activityIndex = cssImports.indexOf("./client-activity-notes.css");\n  assert.ok(cleanModeIndex >= 0, "presentation clean-mode should remain loaded");\n  assert.ok(activityIndex > cleanModeIndex, "activity-note overrides should load after presentation clean-mode");\n});',
)

# v1.1.26 deliberately removes Add Task's duplicate GET preflight. Settings still
# performs the live data-path check; Add Task goes straight to one idempotent write.
replace(
    "tests/v1119-captains-log-connection-preflight.test.mjs",
    '''test("Client Compass proves the Captain's Log connection before beginning task creation", () => {\n  const preflight = action.indexOf("await verifyCaptainsLogTaskConnection();");\n  const request = action.indexOf("const requestId =");\n  const write = action.indexOf("await writeCoordinationTaskToCaptainsLog(request);");\n  assert.ok(preflight >= 0, "connection preflight should be present");\n  assert.ok(request > preflight, "task identity should not be created until the connection passes");\n  assert.ok(write > request, "task write should happen only after preflight and request construction");\n  assert.match(action, /Checking Captain's Log connection/);\n  assert.match(action, /Reconnect in Settings → Cloud & recovery/);\n});''',
    '''test("Client Compass writes one idempotent Captain's Log task without a redundant preflight", () => {\n  const request = action.indexOf("const requestId =");\n  const write = action.indexOf("await writeCoordinationTaskToCaptainsLog(request);");\n  assert.ok(request >= 0, "task identity should be created before the write");\n  assert.ok(write > request, "task write should happen after request construction");\n  assert.doesNotMatch(action, /verifyCaptainsLogTaskConnection/);\n  assert.match(action, /Adding to Captain's Log/);\n  assert.match(action, /Task write failed:/);\n});''',
)

replace(
    "tests/v1120-captains-log-live-status.test.mjs",
    '''test("Settings only shows Connected after the same live task-path check used by Add Task", () => {\n  assert.match(settings, /verifyCaptainsLogTaskConnection/);\n  assert.match(settings, /Checking live connection/);\n  assert.match(settings, /await verifyCaptainsLogTaskConnection\\(\\)/);\n  assert.match(action, /await verifyCaptainsLogTaskConnection\\(\\)/);\n  assert.doesNotMatch(settings, /setConnected\\(snapshot\\.signedIn\\)/);\n});\n\ntest("task failures distinguish connection-check failure from write failure", () => {\n  assert.match(action, /Captain's Log connection check failed:/);\n  assert.match(action, /Captain's Log is connected, but the task write failed:/);\n});''',
    '''test("Settings verifies the live task path while Add Task avoids a duplicate preflight", () => {\n  assert.match(settings, /verifyCaptainsLogTaskConnection/);\n  assert.match(settings, /Checking Supabase data access/);\n  assert.match(settings, /await verifyCaptainsLogTaskConnection\\(\\)/);\n  assert.doesNotMatch(action, /verifyCaptainsLogTaskConnection/);\n  assert.doesNotMatch(settings, /setConnected\\(snapshot\\.signedIn\\)/);\n});\n\ntest("task failures report the direct write failure", () => {\n  assert.match(action, /Task write failed:/);\n  assert.doesNotMatch(action, /Captain's Log connection check failed:/);\n});''',
)

# Data Tools still returns complete history for every Compass client, but the
# ledger query is now bounded to those clients' universal company UUIDs.
replace(
    "tests/v187-captains-log-sync-first.test.mjs",
    '''test("Data Tools syncs complete shared history across the client book from one ledger load", () => {\n  assert.match(dataTools, /Sync all client history/);\n  assert.match(dataTools, /Sync all history/);\n  assert.match(dataTools, /syncClientsFromCaptainsLog/);\n  assert.match(dataTools, /activityCount = appliedResults\\.reduce/);\n  assert.doesNotMatch(dataTools, /replaceCaptainsLogQueue/);\n  assert.match(bridgeSource, /const hydrated = await hydrateClientCompanyIds\\(cleaned\\)/);\n  assert.match(bridgeSource, /const ledger = await loadSupabaseLedger\\(true\\)/);\n  assert.match(bridgeSource, /buildClientSnapshotsFromLedger\\(ledger, hydrated\\)/);\n  assert.doesNotMatch(bridgeSource, /sync_clients_batch|index \\+= 20|client_compass_response/);\n});''',
    '''test("Data Tools syncs complete shared history across the client book from a company-scoped ledger load", () => {\n  assert.match(dataTools, /Sync all client history/);\n  assert.match(dataTools, /Sync all history/);\n  assert.match(dataTools, /syncClientsFromCaptainsLog/);\n  assert.match(dataTools, /activityCount = appliedResults\\.reduce/);\n  assert.doesNotMatch(dataTools, /replaceCaptainsLogQueue/);\n  assert.match(bridgeSource, /const hydrated = await hydrateClientCompanyIds\\(cleaned\\)/);\n  assert.match(bridgeSource, /loadSupabaseLedgerForCompanyIds\\(hydrated\\.map\\(\\(client\\) => client\\.companyId \\|\\| ""\\)\\)/);\n  assert.match(bridgeSource, /buildClientSnapshotsFromLedger\\(ledger, hydrated\\)/);\n  assert.doesNotMatch(bridgeSource, /sync_clients_batch|index \\+= 20|client_compass_response/);\n});''',
)

print("Updated stale release assertions and v1.1.26 behavioral contracts.")
