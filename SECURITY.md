# Security and privacy

## Data boundary

The application is designed as a static, browser-local tool. It does not provide API routes, hosted file storage, a client portal, or application-server persistence.

Source files are read from browser file buffers. Structured project data is stored locally, and original source bytes may be cached in browser IndexedDB for local reprocessing.

## Sensitive information

Do not place patient information, passwords, credentials, or unnecessary regulated data into project notes or client-facing PDF fields.

## Reporting an issue

Report suspected security or privacy issues privately to the project owner before opening a public issue. Include the affected version, reproduction steps, and whether source data could leave the intended browser boundary.

## Change requirements

Any feature that adds network transport, hosted persistence, authentication, public sharing, analytics, or third-party document processing requires an explicit privacy and security review before implementation.
