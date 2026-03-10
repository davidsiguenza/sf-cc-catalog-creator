import assert from "node:assert/strict";
import test from "node:test";

import { extractProductLinksFromCategory } from "../src/extraction/plp-extractor.js";

test("extractProductLinksFromCategory rescata PDPs SEO desde cards con data-product-id", async () => {
  const page = {
    async goto() {},
    async waitForLoadState() {},
    async evaluate(_fn, selectors) {
      if (!Array.isArray(selectors)) {
        return "";
      }

      if (selectors.includes("[data-product-id] a[href]")) {
        return [
          {
            href: "/es_ES/mujer/zapatos/cdi/nnormal-cadi_women_beige-NS4CD1W-001",
            text: "Cadí Women Beige",
          },
        ];
      }

      return [];
    },
  };
  const warnings = [];
  const links = await extractProductLinksFromCategory(
    page,
    { url: "https://www.nnormal.com/es_ES/mujer/zapatos" },
    {
      maxPaginationPages: 1,
      productsPerCategory: 10,
      timeoutMs: 1000,
      productDiscovery: {
        selectors: ["a[href*='/p/']", "a[href*='/product/']"],
      },
      pagination: {
        selectors: ["a[rel='next']"],
      },
    },
    warnings,
  );

  assert.deepEqual(links, ["https://www.nnormal.com/es_ES/mujer/zapatos/cdi/nnormal-cadi_women_beige-NS4CD1W-001"]);
  assert.deepEqual(warnings, []);
});
