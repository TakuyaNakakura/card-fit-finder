import type { Express } from "express";
import type { Pool } from "pg";
import { createApp } from "./app.js";
import { readConfig, type AppConfig } from "./config.js";
import { createPool, initializeDatabase, PgStore } from "./db.js";
import { seedAdminUser, seedDemoCatalog } from "./seed.js";

export interface AppRuntime {
  app: Express;
  pool: Pool;
  store: PgStore;
  config: AppConfig;
}

declare global {
  var __creditCardRuntimePromise: Promise<AppRuntime> | undefined;
}

export async function buildRuntime(env: NodeJS.ProcessEnv = process.env): Promise<AppRuntime> {
  const config = readConfig(env);
  const pool = createPool(config.databaseUrl);

  await initializeDatabase(pool);

  const store = new PgStore(pool);

  if (config.enableDemoSeed) {
    await seedDemoCatalog(store);
  }

  if (
    config.adminConsoleEnabled &&
    config.bootstrapAdmin &&
    config.adminUsername &&
    config.adminPassword &&
    config.adminDisplayName
  ) {
    await seedAdminUser(store, {
      username: config.adminUsername,
      password: config.adminPassword,
      displayName: config.adminDisplayName
    });
  }

  const app = createApp({
    store,
    sessionSecret: config.sessionSecret,
    secureCookies: config.secureCookies,
    adminConsoleEnabled: config.adminConsoleEnabled
  });

  return {
    app,
    pool,
    store,
    config
  };
}

export function getRuntime(env: NodeJS.ProcessEnv = process.env): Promise<AppRuntime> {
  if (!globalThis.__creditCardRuntimePromise) {
    globalThis.__creditCardRuntimePromise = buildRuntime(env).catch((error) => {
      globalThis.__creditCardRuntimePromise = undefined;
      throw error;
    });
  }

  return globalThis.__creditCardRuntimePromise;
}
