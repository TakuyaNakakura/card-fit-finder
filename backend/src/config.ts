export interface AppConfig {
  port: number;
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  sessionSecret: string;
  secureCookies: boolean;
  adminConsoleEnabled: boolean;
  bootstrapAdmin: boolean;
  adminUsername: string | null;
  adminPassword: string | null;
  adminDisplayName: string | null;
  enableDemoSeed: boolean;
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function normalizeNodeEnv(value: string | undefined): AppConfig["nodeEnv"] {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

function validateBootstrapPassword(password: string, isProduction: boolean): void {
  const minimumLength = isProduction ? 14 : 8;

  if (password.length < minimumLength) {
    throw new Error(`ADMIN_PASSWORD must be at least ${minimumLength} characters long.`);
  }
}

function validateSessionSecret(secret: string, isProduction: boolean): void {
  const minimumLength = isProduction ? 32 : 12;

  if (secret.length < minimumLength) {
    throw new Error(`SESSION_SECRET must be at least ${minimumLength} characters long.`);
  }
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = normalizeNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === "production";
  const secureCookies = readBoolean(env.SECURE_COOKIES, isProduction);
  const adminConsoleEnabled = readBoolean(env.ENABLE_ADMIN_CONSOLE, !isProduction);
  const bootstrapAdmin = adminConsoleEnabled && readBoolean(env.BOOTSTRAP_ADMIN, !isProduction);
  const enableDemoSeed = readBoolean(env.ENABLE_DEMO_SEED, !isProduction);

  const sessionSecret = adminConsoleEnabled
    ? env.SESSION_SECRET ?? (!isProduction ? "dev-session-secret" : undefined)
    : env.SESSION_SECRET ?? "public-mode-session-secret";

  if (!sessionSecret) {
    throw new Error("Missing required environment variable: SESSION_SECRET");
  }

  if (adminConsoleEnabled) {
    validateSessionSecret(sessionSecret, isProduction);
  }

  const adminUsername = bootstrapAdmin
    ? env.ADMIN_USERNAME ?? (!isProduction ? "admin" : undefined)
    : env.ADMIN_USERNAME ?? null;
  const adminPassword = bootstrapAdmin
    ? env.ADMIN_PASSWORD ?? (!isProduction ? "password123" : undefined)
    : env.ADMIN_PASSWORD ?? null;
  const adminDisplayName = bootstrapAdmin
    ? env.ADMIN_DISPLAY_NAME ?? (!isProduction ? "Operations Admin" : undefined)
    : env.ADMIN_DISPLAY_NAME ?? null;

  if (bootstrapAdmin) {
    if (!adminUsername || !adminPassword || !adminDisplayName) {
      throw new Error(
        "ADMIN_USERNAME, ADMIN_PASSWORD, and ADMIN_DISPLAY_NAME are required when BOOTSTRAP_ADMIN is enabled."
      );
    }

    validateBootstrapPassword(adminPassword, isProduction);
  }

  return {
    port: Number(env.PORT ?? "4000"),
    nodeEnv,
    databaseUrl: requireEnv("DATABASE_URL", env.DATABASE_URL),
    sessionSecret,
    secureCookies,
    adminConsoleEnabled,
    bootstrapAdmin,
    adminUsername: adminUsername ?? null,
    adminPassword: adminPassword ?? null,
    adminDisplayName: adminDisplayName ?? null,
    enableDemoSeed
  };
}
