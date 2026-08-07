# Client Compass v1.8.6

## Captain's Log cloud connection fix

This release fixes the Windows/Chromium error:

`Failed to read the 'headers' property from 'RequestInit': String contains non ISO-8859-1 code point.`

### What changed

- Sanitizes pasted Supabase project URL, publishable/anon key, and email before sign-in.
- Removes zero-width characters, BOM characters, non-breaking spaces, surrounding smart quotes, and accidental whitespace from pasted connection values.
- Validates the Supabase publishable/anon key before it is placed into an HTTP header.
- Validates Supabase access-token and Prefer header values before requests are created.
- Replaces the browser's low-level header exception with a clear message if unsupported pasted characters remain.
- Updates the visible Settings fields to the normalized values before attempting sign-in.

### Validation

- `npm run lint` passed.
- `npm test` passed: 340 tests total, 335 passed, 0 failed, 5 skipped.
- Freshly extracted release package passed lint and tests again.
- Full TypeScript module resolution remains unavailable in the validation container because the React/Next/XLSX dependency tree is not installed in this packaged source checkout.
