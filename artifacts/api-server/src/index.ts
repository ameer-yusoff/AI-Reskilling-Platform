import app from "./app";
import { logger } from "./lib/logger";
import { seedCatalog } from "./lib/seed";
import { startMarketScheduler } from "./lib/market";
import { seedDemoAccounts, purgeStaleGuestData } from "./lib/auth";
import { seedDemoMembers } from "./lib/demo";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  seedCatalog()
    .then(() => seedDemoAccounts())
    .then(() => seedDemoMembers())
    .then(() => purgeStaleGuestData())
    .then(() => {
      startMarketScheduler();
      setInterval(() => purgeStaleGuestData().catch((err) => logger.error({ err }, "Guest purge failed")), 24 * 3600 * 1000).unref();
    })
    .catch((err) => logger.error({ err }, "Startup seeding failed"));
});
