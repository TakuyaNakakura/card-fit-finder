import { Pool, type PoolClient } from "pg";
import { type AdminUser, type CardRecord, type DataStore, type Merchant } from "./types.js";

function toNumber(value: number | string): number {
  return typeof value === "number" ? value : Number(value);
}

function normalizeCard(row: {
  id: string;
  name: string;
  issuer: string;
  description: string;
  annual_fee_yen: number;
  base_reward_rate_pct: number | string;
  supported_brands: string[];
  is_active: boolean;
}): CardRecord {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    description: row.description,
    annualFeeYen: row.annual_fee_yen,
    baseRewardRatePct: toNumber(row.base_reward_rate_pct),
    supportedBrands: row.supported_brands as CardRecord["supportedBrands"],
    isActive: row.is_active,
    merchantBenefitRates: []
  };
}

async function replaceBenefits(
  client: PoolClient,
  cardId: string,
  benefits: CardRecord["merchantBenefitRates"]
): Promise<void> {
  await client.query("DELETE FROM card_merchant_benefits WHERE card_id = $1", [cardId]);

  for (const benefit of benefits) {
    await client.query(
      `
        INSERT INTO card_merchant_benefits (
          id,
          card_id,
          merchant_id,
          reward_rate_pct,
          note,
          is_active
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        `${cardId}-${benefit.merchantId}`,
        cardId,
        benefit.merchantId,
        benefit.rewardRatePct,
        benefit.note,
        benefit.isActive
      ]
    );
  }
}

export async function initializeDatabase(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS merchants (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      issuer TEXT NOT NULL,
      description TEXT NOT NULL,
      annual_fee_yen INTEGER NOT NULL,
      base_reward_rate_pct NUMERIC(6, 2) NOT NULL,
      supported_brands TEXT[] NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS card_merchant_benefits (
      id TEXT PRIMARY KEY,
      card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
      merchant_id TEXT NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
      reward_rate_pct NUMERIC(6, 2) NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (card_id, merchant_id)
    );

    CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

export class PgStore implements DataStore {
  constructor(private readonly pool: Pool) {}

  async listPublicMerchants(): Promise<Merchant[]> {
    const result = await this.pool.query(
      `
        SELECT id, name, category, is_active
        FROM merchants
        WHERE is_active = TRUE
        ORDER BY category, name
      `
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      isActive: row.is_active
    }));
  }

  async listAdminMerchants(): Promise<Merchant[]> {
    const result = await this.pool.query(
      `
        SELECT id, name, category, is_active
        FROM merchants
        ORDER BY category, name
      `
    );

    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      category: row.category,
      isActive: row.is_active
    }));
  }

  async createMerchant(merchant: Merchant): Promise<Merchant> {
    await this.pool.query(
      `
        INSERT INTO merchants (id, name, category, is_active, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
      `,
      [merchant.id, merchant.name, merchant.category, merchant.isActive]
    );
    return merchant;
  }

  async updateMerchant(merchant: Merchant): Promise<Merchant> {
    const result = await this.pool.query(
      `
        UPDATE merchants
        SET name = $2, category = $3, is_active = $4, updated_at = NOW()
        WHERE id = $1
      `,
      [merchant.id, merchant.name, merchant.category, merchant.isActive]
    );

    if (result.rowCount === 0) {
      throw new Error(`Merchant not found: ${merchant.id}`);
    }

    return merchant;
  }

  async upsertMerchant(merchant: Merchant): Promise<Merchant> {
    await this.pool.query(
      `
        INSERT INTO merchants (id, name, category, is_active, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (id)
        DO UPDATE
          SET name = EXCLUDED.name,
              category = EXCLUDED.category,
              is_active = EXCLUDED.is_active,
              updated_at = NOW()
      `,
      [merchant.id, merchant.name, merchant.category, merchant.isActive]
    );
    return merchant;
  }

  async listActiveCards(): Promise<CardRecord[]> {
    return this.listCards(true);
  }

  async listAdminCards(): Promise<CardRecord[]> {
    return this.listCards(false);
  }

  private async listCards(onlyActive: boolean): Promise<CardRecord[]> {
    const cardsQuery = onlyActive
      ? `
          SELECT id, name, issuer, description, annual_fee_yen, base_reward_rate_pct, supported_brands, is_active
          FROM cards
          WHERE is_active = TRUE
          ORDER BY annual_fee_yen, name
        `
      : `
          SELECT id, name, issuer, description, annual_fee_yen, base_reward_rate_pct, supported_brands, is_active
          FROM cards
          ORDER BY annual_fee_yen, name
        `;
    const cardsResult = await this.pool.query(cardsQuery);

    const cards = cardsResult.rows.map((row) => normalizeCard(row));

    if (cards.length === 0) {
      return [];
    }

    const benefitsResult = await this.pool.query(
      `
        SELECT card_id, merchant_id, reward_rate_pct, note, is_active
        FROM card_merchant_benefits
        ORDER BY merchant_id
      `
    );

    const benefitsByCardId = new Map<string, CardRecord["merchantBenefitRates"]>();

    for (const row of benefitsResult.rows) {
      const current = benefitsByCardId.get(row.card_id) ?? [];
      current.push({
        merchantId: row.merchant_id,
        rewardRatePct: toNumber(row.reward_rate_pct),
        note: row.note,
        isActive: row.is_active
      });
      benefitsByCardId.set(row.card_id, current);
    }

    return cards.map((card) => ({
      ...card,
      merchantBenefitRates: benefitsByCardId.get(card.id) ?? []
    }));
  }

  async createCard(card: CardRecord): Promise<CardRecord> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO cards (
            id,
            name,
            issuer,
            description,
            annual_fee_yen,
            base_reward_rate_pct,
            supported_brands,
            is_active,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        `,
        [
          card.id,
          card.name,
          card.issuer,
          card.description,
          card.annualFeeYen,
          card.baseRewardRatePct,
          card.supportedBrands,
          card.isActive
        ]
      );
      await replaceBenefits(client, card.id, card.merchantBenefitRates);
      await client.query("COMMIT");
      return card;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async updateCard(card: CardRecord): Promise<CardRecord> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await client.query(
        `
          UPDATE cards
          SET
            name = $2,
            issuer = $3,
            description = $4,
            annual_fee_yen = $5,
            base_reward_rate_pct = $6,
            supported_brands = $7,
            is_active = $8,
            updated_at = NOW()
          WHERE id = $1
        `,
        [
          card.id,
          card.name,
          card.issuer,
          card.description,
          card.annualFeeYen,
          card.baseRewardRatePct,
          card.supportedBrands,
          card.isActive
        ]
      );

      if (result.rowCount === 0) {
        throw new Error(`Card not found: ${card.id}`);
      }

      await replaceBenefits(client, card.id, card.merchantBenefitRates);
      await client.query("COMMIT");
      return card;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async upsertCard(card: CardRecord): Promise<CardRecord> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO cards (
            id,
            name,
            issuer,
            description,
            annual_fee_yen,
            base_reward_rate_pct,
            supported_brands,
            is_active,
            updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id)
          DO UPDATE
            SET
              name = EXCLUDED.name,
              issuer = EXCLUDED.issuer,
              description = EXCLUDED.description,
              annual_fee_yen = EXCLUDED.annual_fee_yen,
              base_reward_rate_pct = EXCLUDED.base_reward_rate_pct,
              supported_brands = EXCLUDED.supported_brands,
              is_active = EXCLUDED.is_active,
              updated_at = NOW()
        `,
        [
          card.id,
          card.name,
          card.issuer,
          card.description,
          card.annualFeeYen,
          card.baseRewardRatePct,
          card.supportedBrands,
          card.isActive
        ]
      );
      await replaceBenefits(client, card.id, card.merchantBenefitRates);
      await client.query("COMMIT");
      return card;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findAdminUserByUsername(username: string): Promise<AdminUser | null> {
    const result = await this.pool.query(
      `
        SELECT id, username, display_name, password_hash, is_active
        FROM admin_users
        WHERE username = $1
      `,
      [username]
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      passwordHash: row.password_hash,
      isActive: row.is_active
    };
  }

  async upsertAdminUser(user: AdminUser): Promise<AdminUser> {
    await this.pool.query(
      `
        INSERT INTO admin_users (
          id,
          username,
          display_name,
          password_hash,
          is_active,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (username)
        DO UPDATE
          SET
            display_name = EXCLUDED.display_name,
            password_hash = EXCLUDED.password_hash,
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
      `,
      [user.id, user.username, user.displayName, user.passwordHash, user.isActive]
    );
    return user;
  }
}

export function createPool(connectionString: string): Pool {
  return new Pool({ connectionString });
}
