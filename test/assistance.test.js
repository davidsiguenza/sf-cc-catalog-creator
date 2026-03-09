import assert from "node:assert/strict";
import test from "node:test";

import { applyAssistanceInputsToParsed, hasGuidedSampleUrls } from "../src/assistance/interactive.js";
import { buildProfileAssistanceRequest, buildScrapeAssistanceRequest } from "../src/assistance/request.js";

test("buildScrapeAssistanceRequest pide PLP y PDP cuando no hay productos", () => {
  const assistance = buildScrapeAssistanceRequest(
    { entryUrl: "https://shop.example.com" },
    {
      summary: {
        categoriesProcessed: 0,
        productsExtracted: 0,
      },
      validation: {
        summary: {},
      },
    },
  );

  assert.equal(assistance.status, "needs_user_input");
  assert.equal(assistance.severity, "blocking");
  assert.ok(assistance.requestedInputs.some((input) => input.id === "plp_url"));
  assert.ok(assistance.requestedInputs.some((input) => input.id === "pdp_url"));
  assert.match(assistance.suggestedCommand, /--plp-url <PLP_URL>/);
});

test("buildScrapeAssistanceRequest no pide ayuda cuando la calidad es suficiente", () => {
  const assistance = buildScrapeAssistanceRequest(
    { entryUrl: "https://shop.example.com" },
    {
      summary: {
        categoriesProcessed: 2,
        productsExtracted: 10,
      },
      validation: {
        summary: {
          priceCoverage: 1,
          imageCoverage: 1,
          categoryCoverage: 1,
        },
      },
    },
  );

  assert.equal(assistance.status, "not_needed");
});

test("buildScrapeAssistanceRequest sugiere otra PLP cuando la muestra cubre una sola categoria", () => {
  const assistance = buildScrapeAssistanceRequest(
    {
      entryUrl: "https://shop.example.com",
      categoryUrls: ["https://shop.example.com/category/shoes"],
    },
    {
      summary: {
        categoriesProcessed: 1,
        productsExtracted: 6,
      },
      products: [
        {
          categoryPath: "Men > Shoes",
          allCategoryPaths: ["Men > Shoes"],
        },
        {
          categoryPath: "Men > Shoes",
          allCategoryPaths: ["Men > Shoes"],
        },
      ],
      validation: {
        summary: {
          priceCoverage: 1,
          imageCoverage: 1,
          categoryCoverage: 1,
        },
      },
    },
  );

  assert.equal(assistance.status, "needs_user_input");
  assert.equal(assistance.severity, "advisory");
  assert.ok(assistance.requestedInputs.some((input) => input.id === "additional_plp_url"));
  assert.match(assistance.message, /pocas categorias/i);
  assert.match(assistance.suggestedCommand, /npm start -- scrape/);
  assert.match(assistance.suggestedCommand, /--category-url https:\/\/shop\.example\.com\/category\/shoes/);
  assert.match(assistance.suggestedCommand, /--category-url <OTRA_PLP_URL>/);
});

test("buildProfileAssistanceRequest pide PLP y PDP cuando el perfilado no los encuentra", () => {
  const assistance = buildProfileAssistanceRequest(
    { entryUrl: "https://shop.example.com" },
    {
      profile: {
        platformHint: "generic",
        confidence: 0.55,
      },
      samplePages: [
        {
          detectedType: "home",
        },
      ],
    },
  );

  assert.equal(assistance.status, "needs_user_input");
  assert.ok(assistance.requestedInputs.some((input) => input.id === "plp_url"));
  assert.ok(assistance.requestedInputs.some((input) => input.id === "pdp_url"));
  assert.ok(assistance.requestedInputs.some((input) => input.id === "search_url"));
});

test("applyAssistanceInputsToParsed rellena samples y category-url para scrape", () => {
  const next = applyAssistanceInputsToParsed(
    {
      categoryUrls: [],
      homeUrl: "",
      plpUrl: "",
      searchUrl: "",
      pdpUrl: "",
    },
    {
      plp_url: "https://shop.example.com/category/shoes",
      pdp_url: "https://shop.example.com/p/red-shoe",
    },
    "scrape",
  );

  assert.equal(next.plpUrl, "https://shop.example.com/category/shoes");
  assert.equal(next.pdpUrl, "https://shop.example.com/p/red-shoe");
  assert.deepEqual(next.categoryUrls, ["https://shop.example.com/category/shoes"]);
});

test("applyAssistanceInputsToParsed acumula multiples PLPs para scrape", () => {
  const next = applyAssistanceInputsToParsed(
    {
      categoryUrls: ["https://shop.example.com/category/shoes"],
      homeUrl: "",
      plpUrl: "https://shop.example.com/category/shoes",
      searchUrl: "",
      pdpUrl: "",
    },
    {
      additional_plp_url: [
        "https://shop.example.com/category/jackets",
        "https://shop.example.com/category/accessories",
      ],
    },
    "scrape",
  );

  assert.equal(next.plpUrl, "https://shop.example.com/category/shoes");
  assert.deepEqual(next.categoryUrls, [
    "https://shop.example.com/category/shoes",
    "https://shop.example.com/category/jackets",
    "https://shop.example.com/category/accessories",
  ]);
});

test("hasGuidedSampleUrls detecta urls de apoyo", () => {
  assert.equal(hasGuidedSampleUrls({}), false);
  assert.equal(hasGuidedSampleUrls({ pdpUrl: "https://shop.example.com/p/red-shoe" }), true);
});
