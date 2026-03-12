import { readConfig } from "./config.js";
import { createPool, initializeDatabase, PgStore } from "./db.js";
import { importProjectCatalog } from "./project-catalog.js";

async function main(): Promise<void> {
  const config = readConfig({
    ...process.env,
    ENABLE_ADMIN_CONSOLE: "false",
    ENABLE_DEMO_SEED: "false"
  });
  const pool = createPool(config.databaseUrl);

  try {
    await initializeDatabase(pool);
    const store = new PgStore(pool);
    const result = await importProjectCatalog(store);
    console.log(
      `Imported ${result.cardsImported} cards and ${result.merchantsImported} merchants into ${config.databaseUrl}.`
    );
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
