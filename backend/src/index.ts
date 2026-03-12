import { getRuntime } from "./runtime.js";

async function main(): Promise<void> {
  const { app, pool, config } = await getRuntime();

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
