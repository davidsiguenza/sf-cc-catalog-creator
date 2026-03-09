import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalProduct } from "../src/core/models/product.js";
import { normalizeExtractedProduct } from "../src/core/normalize/product.js";
import { validateCatalog } from "../src/core/validate/catalog.js";

test("createCanonicalProduct normaliza arrays, categoria y sourceSite", () => {
  const product = createCanonicalProduct({
    productId: " demo-product ",
    name: " Demo Product ",
    categoryPath: "Men > Shoes",
    allCategoryPaths: ["Men > Shoes", "Men > Shoes", "Sale > Shoes"],
    imageUrls: [
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/1.jpg",
      "https://cdn.example.com/2.jpg",
    ],
    productUrl: "https://shop.example.com/p/demo-product?utm_source=test",
  });

  assert.equal(product.productId, "demo-product");
  assert.equal(product.name, "Demo Product");
  assert.deepEqual(product.categoryTrail, ["Men", "Shoes"]);
  assert.deepEqual(product.allCategoryPaths, ["Men > Shoes", "Sale > Shoes"]);
  assert.deepEqual(product.imageUrls, [
    "https://cdn.example.com/1.jpg",
    "https://cdn.example.com/2.jpg",
  ]);
  assert.equal(product.sourceSite, "https://shop.example.com");
  assert.equal(product.productUrl, "https://shop.example.com/p/demo-product");
});

test("normalizeExtractedProduct crea producto canonico con senales de origen", () => {
  const normalized = normalizeExtractedProduct(
    {
      name: " Trail Shoe ",
      description: "<p>Lightweight</p>",
      sku: "SKU-TRAIL-1",
      price: "129,99 EUR",
      currency: "EUR",
      brand: " Acme ",
      images: ["/images/trail-shoe.jpg"],
      breadcrumbTrail: ["Home", "Men", "Shoes"],
      bodyText: "SKU SKU-TRAIL-1",
      title: "Trail Shoe",
      canonicalUrl: "https://shop.example.com/p/trail-shoe",
      hasJsonLdProduct: true,
    },
    "https://shop.example.com/p/trail-shoe",
    { path: ["Fallback"] },
    { currency: "USD" },
  );

  assert.equal(normalized.name, "Trail Shoe");
  assert.equal(normalized.description, "Lightweight");
  assert.equal(normalized.price, "129.99");
  assert.equal(normalized.categoryPath, "Men > Shoes");
  assert.equal(normalized.sourceType, "jsonld+dom");
  assert.equal(normalized.sourceConfidence, 0.8);
  assert.deepEqual(normalized.rawSignals, {
    jsonld: true,
    dom: true,
    network: false,
  });
});

test("normalizeExtractedProduct usa pid como fallback de sku para quick views de SFCC", () => {
  const normalized = normalizeExtractedProduct(
    {
      name: "",
      description: "",
      sku: "",
      price: "",
      currency: "",
      brand: "",
      images: [],
      breadcrumbTrail: ["Home", "Men", "Blazers"],
      bodyText: "",
      title: "",
      canonicalUrl: "",
      hasJsonLdProduct: false,
    },
    "https://www.alvaromoreno.com/on/demandware.store/Sites-AlvaroMoreno_es-Site/es/Product-ShowQuickView?pid=769126050_IVO",
    { path: ["Men", "Blazers"] },
    { currency: "EUR" },
  );

  assert.equal(normalized.sku, "769126050_IVO");
  assert.equal(normalized.productId, "769126050-ivo");
});

test("validateCatalog detecta coberturas bajas y productos no validos", () => {
  const validation = validateCatalog([
    createCanonicalProduct({
      productId: "valid-product",
      name: "Valid Product",
      categoryPath: "Men > Shoes",
      imageUrls: ["https://cdn.example.com/1.jpg"],
      productUrl: "https://shop.example.com/p/valid-product",
      price: "99.00",
    }),
    createCanonicalProduct({
      productId: "invalid-product",
      name: "",
      categoryPath: "",
      imageUrls: [],
      productUrl: "",
      price: "",
    }),
  ]);

  assert.equal(validation.summary.productCount, 2);
  assert.equal(validation.summary.productsWithErrors, 1);
  assert.equal(validation.summary.validProducts, 1);
  assert.equal(validation.summary.priceCoverage, 0.5);
  assert.equal(validation.summary.imageCoverage, 0.5);
  assert.equal(validation.summary.categoryCoverage, 0.5);
  assert.match(validation.products[1].issues[0].message, /nombre/i);
});
