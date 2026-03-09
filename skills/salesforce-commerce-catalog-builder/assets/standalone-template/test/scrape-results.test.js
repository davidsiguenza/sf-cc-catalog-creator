import assert from "node:assert/strict";
import test from "node:test";

import { mergeScrapeResults } from "../src/utils/scrape-results.js";

test("mergeScrapeResults acumula productos, categorias y warnings de varias pasadas", () => {
  const merged = mergeScrapeResults(
    {
      products: [
        {
          sku: "sku-1",
          name: "Blazer",
          imageUrls: ["https://cdn.example.com/1.jpg"],
          allCategoryPaths: ["Men > Blazers"],
          categoryPath: "Men > Blazers",
        },
      ],
      categories: [
        {
          name: "Blazers",
          url: "https://shop.example.com/category/blazers",
          path: ["Men", "Blazers"],
          productLinksDiscovered: 8,
        },
      ],
      warnings: ["Advertencia 1"],
    },
    {
      products: [
        {
          sku: "sku-1",
          name: "",
          imageUrls: ["https://cdn.example.com/2.jpg"],
          allCategoryPaths: ["Sale > Blazers"],
          categoryPath: "Sale > Blazers",
        },
        {
          sku: "sku-2",
          name: "Jacket",
          price: "59.00",
          imageUrls: ["https://cdn.example.com/3.jpg"],
          allCategoryPaths: ["Men > Jackets"],
          categoryPath: "Men > Jackets",
        },
      ],
      categories: [
        {
          name: "Jackets",
          url: "https://shop.example.com/category/jackets",
          path: ["Men", "Jackets"],
          productLinksDiscovered: 6,
        },
      ],
      warnings: ["Advertencia 2"],
    },
  );

  assert.equal(merged.summary.productsExtracted, 2);
  assert.equal(merged.summary.categoriesProcessed, 2);
  assert.deepEqual(merged.warnings.slice(0, 2), ["Advertencia 1", "Advertencia 2"]);
  assert.deepEqual(merged.products.find((product) => product.sku === "sku-1").imageUrls, [
    "https://cdn.example.com/1.jpg",
    "https://cdn.example.com/2.jpg",
  ]);
  assert.deepEqual(merged.products.find((product) => product.sku === "sku-1").allCategoryPaths, [
    "Men > Blazers",
    "Sale > Blazers",
  ]);
});
