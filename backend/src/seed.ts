import { hashPassword } from "./auth.js";
import { seedCards, seedMerchants } from "./seed-data.js";
import { type DataStore } from "./types.js";

export async function seedDemoCatalog(store: DataStore): Promise<void> {
  for (const merchant of seedMerchants) {
    await store.upsertMerchant(merchant);
  }

  for (const card of seedCards) {
    await store.upsertCard(card);
  }
}

export async function seedAdminUser(
  store: DataStore,
  input: { username: string; password: string; displayName: string }
): Promise<void> {
  await store.upsertAdminUser({
    id: `admin-${input.username}`,
    username: input.username,
    displayName: input.displayName,
    passwordHash: hashPassword(input.password),
    isActive: true
  });
}
