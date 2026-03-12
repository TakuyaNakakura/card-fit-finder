import { createApp } from "./app.js";
import { readConfig } from "./config.js";
import { createPool, initializeDatabase, PgStore } from "./db.js";
import { seedAdminUser, seedDemoCatalog } from "./seed.js";

async function main(): Promise<void> {
  const config = readConfig();
  const pool = createPool(config.databaseUrl);

  await initializeDatabase(pool);

  const store = new PgStore(pool);
  await seedDemoCatalog(store);
  await seedAdminUser(store, {
    username: config.adminUsername,
    password: config.adminPassword,
    displayName: config.adminDisplayName
  });

  const app = createApp({
    store,
    sessionSecret: config.sessionSecret
  });

  const server = app.listen(config.port, () => {
    console.log(`Backend listening on http://localhost:${config.port}`);
  });

  const shutdown = async () => {
    server.close();
    await pool.end();
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
