import assert from "node:assert/strict";
import test from "node:test";

import { buildCategoryTree, mergeProducts } from "../src/utils/products.js";

test("mergeProducts conserva categorias e imagenes unicas", () => {
  const base = {
    productId: "sku-1",
    name: "Base",
    description: "",
    imageUrls: ["https://example.com/1.jpg"],
    allCategoryPaths: ["Men > Shoes"],
  };

  const incoming = {
    productId: "sku-1",
    name: "",
    description: "Desc",
    imageUrls: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    allCategoryPaths: ["Sale > Shoes"],
  };

  const merged = mergeProducts(base, incoming);

  assert.equal(merged.name, "Base");
  assert.equal(merged.description, "Desc");
  assert.deepEqual(merged.imageUrls, [
    "https://example.com/1.jpg",
    "https://example.com/2.jpg",
  ]);
  assert.deepEqual(merged.allCategoryPaths, ["Men > Shoes", "Sale > Shoes"]);
});

test("buildCategoryTree crea ids jerarquicos", () => {
  const categories = buildCategoryTree([
    {
      allCategoryPaths: ["Men > Shoes", "Sale > Shoes"],
    },
  ]);

  assert.equal(categories.get("Men").id, "men");
  assert.equal(categories.get("Men > Shoes").id, "men-shoes");
  assert.equal(categories.get("Men > Shoes").parentId, "men");
  assert.equal(categories.get("Sale > Shoes").parentId, "sale");
});
