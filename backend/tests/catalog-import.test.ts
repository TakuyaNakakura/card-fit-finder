import { describe, expect, it } from "vitest";
import { parseMerchantImportBody } from "../src/catalog-import.js";

describe("catalog import normalization", () => {
  it("normalizes merchant ids during merchant imports", () => {
    const merchants = parseMerchantImportBody({
      merchants: [
        {
          id: "7-eleven",
          name: "セブン-イレブン",
          category: "Convenience Store",
          isActive: true
        }
      ]
    });

    expect(merchants).toEqual([
      {
        id: "seven-eleven",
        name: "セブン-イレブン",
        category: "Convenience Store",
        isActive: true
      }
    ]);
  });
});
