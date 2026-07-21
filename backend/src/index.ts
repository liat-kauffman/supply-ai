import { createServer } from "node:http";

const port = Number(process.env.HEALTH_PORT ?? 3001);
const abortController = new AbortController();

const server = createServer((request, response) => {
  if (request.url === "/health/live" || request.url === "/health/ready") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "ok", service: "worker" }));
    return;
  }
  response.writeHead(404).end();
});

server.listen(port, () =>
  console.info(
    JSON.stringify({ level: "info", event: "worker.started", port }),
  ),
);

function shutdown(signal: string) {
  if (abortController.signal.aborted) return;
  abortController.abort();
  console.info(
    JSON.stringify({ level: "info", event: "worker.stopping", signal }),
  );
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
