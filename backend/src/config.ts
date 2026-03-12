export interface AppConfig {
  port: number;
  databaseUrl: string;
  adminUsername: string;
  adminPassword: string;
  adminDisplayName: string;
  sessionSecret: string;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: Number(env.PORT ?? "4000"),
    databaseUrl: requireEnv("DATABASE_URL", env.DATABASE_URL),
    adminUsername: requireEnv("ADMIN_USERNAME", env.ADMIN_USERNAME),
    adminPassword: requireEnv("ADMIN_PASSWORD", env.ADMIN_PASSWORD),
    adminDisplayName: requireEnv("ADMIN_DISPLAY_NAME", env.ADMIN_DISPLAY_NAME),
    sessionSecret: requireEnv("SESSION_SECRET", env.SESSION_SECRET)
  };
}
