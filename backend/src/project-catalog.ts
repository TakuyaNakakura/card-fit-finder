import { readFile } from "node:fs/promises";
import {
  ensureUniqueRecordIds,
  parseCardImportBody,
  parseMerchantImportBody,
  resolveMissingCardImportMerchants
} from "./catalog-import.js";
import { type DataStore } from "./types.js";

const merchantsFileUrl = new URL("../../data/shop.json", import.meta.url);
const cardsFileUrl = new URL("../../data/cards.json", import.meta.url);

async function readJsonFile(url: URL): Promise<unknown> {
  const content = await readFile(url, "utf8");
  return JSON.parse(content) as unknown;
}

export async function importProjectCatalog(store: DataStore): Promise<{
  merchantsImported: number;
  cardsImported: number;
}> {
  const [merchantInput, cardInput] = await Promise.all([
    readJsonFile(merchantsFileUrl),
    readJsonFile(cardsFileUrl)
  ]);

  const merchants = parseMerchantImportBody(merchantInput);
  ensureUniqueRecordIds(merchants, "Merchant");

  for (const merchant of merchants) {
    await store.upsertMerchant(merchant);
  }

  const cards = parseCardImportBody(cardInput);
  ensureUniqueRecordIds(cards, "Card");

  const adminMerchants = await store.listAdminMerchants();
  const missingMerchants = resolveMissingCardImportMerchants(cards, adminMerchants);

  for (const merchant of missingMerchants) {
    await store.upsertMerchant(merchant);
  }

  for (const card of cards) {
    await store.upsertCard(card);
  }

  return {
    merchantsImported: merchants.length + missingMerchants.length,
    cardsImported: cards.length
  };
}
