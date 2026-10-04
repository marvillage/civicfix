import { app } from "./app";
import { env } from "./config/env";
import { BRAND } from "./config/brand";
import { prisma } from "./lib/prisma";
import { startSLABreachJob } from "./jobs/sla.job";

// The app is built in app.ts (so tests can mount it without
// opening a port); this file only starts the process.

const server = app.listen(env.PORT, () => {
  console.log(
    `${BRAND.name} backend running on http://localhost:${env.PORT}`
  );
});

const slaJob = startSLABreachJob();

// Graceful shutdown: stop the job, finish in-flight requests,
// release database connections.
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down…`);

  clearInterval(slaJob);

  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
