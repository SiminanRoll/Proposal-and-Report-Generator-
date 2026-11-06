import { createServer } from "node:http";
import { createReaderHandler } from "./handler.mjs";

const port = Number(process.env.PORT || 8080);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error("Invalid PORT");
}
const handler = createReaderHandler();
const server = createServer((request, response) => {
  void handler(request, response).catch(() => {
    if (!response.headersSent) {
      response.writeHead(500, {
        "content-type": "application/json",
        "cache-control": "no-store",
      });
      response.end('{"error":"internal_error"}');
    } else {
      response.end();
    }
  });
});
server.requestTimeout = 12_000;
server.headersTimeout = 10_000;
server.listen(port, "0.0.0.0", () => {
  // No secrets, upstream endpoints, tenant data or credentials in logs.
  console.info("GHL read-only API service started");
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => server.close(() => process.exit(0)));
}
