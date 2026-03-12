import { hashPassword } from "../src/auth.js";
import { seedDemoCatalog } from "../src/seed.js";
import {
  type AdminUser,
  type CardRecord,
  type DataStore,
  type Merchant
} from "../src/types.js";

export class MemoryStore implements DataStore {
  private readonly merchants = new Map<string, Merchant>();
  private readonly cards = new Map<string, CardRecord>();
  private readonly adminUsers = new Map<string, AdminUser>();

  async listPublicMerchants(): Promise<Merchant[]> {
    return Array.from(this.merchants.values())
      .filter((merchant) => merchant.isActive)
      .sort((left, right) => left.name.localeCompare(right.name, "ja"));
  }

  async listAdminMerchants(): Promise<Merchant[]> {
    return Array.from(this.merchants.values()).sort((left, right) =>
      left.name.localeCompare(right.name, "ja")
    );
  }

  async createMerchant(merchant: Merchant): Promise<Merchant> {
    if (this.merchants.has(merchant.id)) {
      throw new Error("duplicate key value violates unique constraint");
    }

    this.merchants.set(merchant.id, merchant);
    return merchant;
  }

  async updateMerchant(merchant: Merchant): Promise<Merchant> {
    if (!this.merchants.has(merchant.id)) {
      throw new Error(`Merchant not found: ${merchant.id}`);
    }

    this.merchants.set(merchant.id, merchant);
    return merchant;
  }

  async upsertMerchant(merchant: Merchant): Promise<Merchant> {
    this.merchants.set(merchant.id, merchant);
    return merchant;
  }

  async listActiveCards(): Promise<CardRecord[]> {
    return Array.from(this.cards.values()).filter((card) => card.isActive);
  }

  async listAdminCards(): Promise<CardRecord[]> {
    return Array.from(this.cards.values());
  }

  async createCard(card: CardRecord): Promise<CardRecord> {
    if (this.cards.has(card.id)) {
      throw new Error("duplicate key value violates unique constraint");
    }

    this.cards.set(card.id, card);
    return card;
  }

  async updateCard(card: CardRecord): Promise<CardRecord> {
    if (!this.cards.has(card.id)) {
      throw new Error(`Card not found: ${card.id}`);
    }

    this.cards.set(card.id, card);
    return card;
  }

  async upsertCard(card: CardRecord): Promise<CardRecord> {
    this.cards.set(card.id, card);
    return card;
  }

  async findAdminUserByUsername(username: string): Promise<AdminUser | null> {
    return this.adminUsers.get(username) ?? null;
  }

  async upsertAdminUser(user: AdminUser): Promise<AdminUser> {
    this.adminUsers.set(user.username, user);
    return user;
  }

  async seedAdmin(): Promise<void> {
    await this.upsertAdminUser({
      id: "admin-test",
      username: "admin",
      displayName: "Test Admin",
      passwordHash: hashPassword("password123"),
      isActive: true
    });
  }
}

export async function buildSeededMemoryStore(): Promise<MemoryStore> {
  const store = new MemoryStore();
  await seedDemoCatalog(store);
  await store.seedAdmin();
  return store;
}
