export function isAdminConsoleEnabled(): boolean {
  return ["1", "true", "yes", "on"].includes(
    (process.env.ENABLE_ADMIN_CONSOLE ?? "").toLowerCase()
  );
}
