import assert from "node:assert/strict";
import test from "node:test";

import {
  applyAdditionalCategoriesToParsed,
  applyAutoScrapeAnswersToParsed,
  applyAssistanceInputsToParsed,
  hasGuidedSampleUrls,
  isProfileValidForAutomaticSelection,
  shouldPromptForAdditionalCategoriesAfterScrape,
  shouldOfferAutoScrapeAfterProfile,
} from "../src/assistance/interactive.js";
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

test("buildProfileAssistanceRequest confia en la PLP aportada por el usuario", () => {
  const assistance = buildProfileAssistanceRequest(
    {
      entryUrl: "https://shop.example.com",
      plpUrl: "https://shop.example.com/category/shoes",
    },
    {
      profile: {
        platformHint: "sfcc",
        confidence: 0.72,
      },
      samplePages: [
        {
          typeRequested: "plp",
          detectedType: "pdp",
          source: "input",
        },
      ],
    },
  );

  assert.equal(assistance.status, "not_needed");
  assert.equal(assistance.requestedInputs.some((input) => input.id === "plp_url"), false);
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

test("applyAssistanceInputsToParsed conserva PLPs facilitadas durante profile-site", () => {
  const next = applyAssistanceInputsToParsed(
    {
      categoryUrls: [],
      homeUrl: "",
      plpUrl: "",
      searchUrl: "",
      pdpUrl: "",
    },
    {
      plp_url: [
        "https://shop.example.com/category/shoes",
        "https://shop.example.com/category/jackets",
      ],
    },
    "profile-site",
  );

  assert.equal(next.plpUrl, "https://shop.example.com/category/shoes");
  assert.deepEqual(next.categoryUrls, [
    "https://shop.example.com/category/shoes",
    "https://shop.example.com/category/jackets",
  ]);
});

test("hasGuidedSampleUrls detecta urls de apoyo", () => {
  assert.equal(hasGuidedSampleUrls({}), false);
  assert.equal(hasGuidedSampleUrls({ pdpUrl: "https://shop.example.com/p/red-shoe" }), true);
});

test("shouldOfferAutoScrapeAfterProfile propone continuar cuando el perfil es conocido y suficiente", () => {
  const originalStdinTty = process.stdin.isTTY;
  const originalStdoutTty = process.stdout.isTTY;

  process.stdin.isTTY = true;
  process.stdout.isTTY = true;

  try {
    const shouldOffer = shouldOfferAutoScrapeAfterProfile(
      {
        profile: {
          platformHint: "sfcc",
        },
        assistance: {
          status: "not_needed",
        },
      },
      {
        interactiveAssistance: true,
      },
    );

    assert.equal(shouldOffer, true);
  } finally {
    process.stdin.isTTY = originalStdinTty;
    process.stdout.isTTY = originalStdoutTty;
  }
});

test("shouldOfferAutoScrapeAfterProfile tambien propone continuar si el perfil no es valido", () => {
  const originalStdinTty = process.stdin.isTTY;
  const originalStdoutTty = process.stdout.isTTY;

  process.stdin.isTTY = true;
  process.stdout.isTTY = true;

  try {
    const shouldOffer = shouldOfferAutoScrapeAfterProfile(
      {
        profile: {
          platformHint: "sfcc",
        },
        assistance: {
          status: "needs_user_input",
        },
      },
      {
        interactiveAssistance: true,
      },
    );

    assert.equal(shouldOffer, true);
  } finally {
    process.stdin.isTTY = originalStdinTty;
    process.stdout.isTTY = originalStdoutTty;
  }
});

test("isProfileValidForAutomaticSelection detecta cuando se puede ir por el branch auto", () => {
  assert.equal(
    isProfileValidForAutomaticSelection({
      profile: {
        platformHint: "sfcc",
      },
      assistance: {
        status: "not_needed",
      },
    }),
    true,
  );

  assert.equal(
    isProfileValidForAutomaticSelection({
      profile: {
        platformHint: "generic",
      },
      assistance: {
        status: "not_needed",
      },
    }),
    false,
  );
});

test("applyAutoScrapeAnswersToParsed prepara un scrape automatico reutilizando el perfil", () => {
  const next = applyAutoScrapeAnswersToParsed(
    {
      command: "profile-site",
      entryUrl: "https://shop.example.com",
      maxCategories: 4,
      productsPerCategory: 10,
      categoryNames: ["Men"],
      categoryUrls: ["https://shop.example.com/category/shoes"],
      homeUrl: "https://shop.example.com",
      plpUrl: "https://shop.example.com/category/shoes",
      searchUrl: "https://shop.example.com/search?q=shirt",
      pdpUrl: "https://shop.example.com/p/red-shirt",
    },
    {
      entryUrl: "https://shop.example.com",
      maxCategories: 6,
      productsPerCategory: 12,
      categoryUrls: ["https://shop.example.com/category/jackets"],
    },
  );

  assert.equal(next.command, "scrape");
  assert.equal(next.entryUrl, "https://shop.example.com");
  assert.equal(next.maxCategories, 6);
  assert.equal(next.productsPerCategory, 12);
  assert.deepEqual(next.categoryNames, []);
  assert.deepEqual(next.categoryUrls, ["https://shop.example.com/category/jackets"]);
  assert.equal(next.homeUrl, "");
  assert.equal(next.plpUrl, "");
  assert.equal(next.searchUrl, "");
  assert.equal(next.pdpUrl, "");
});

test("applyAdditionalCategoriesToParsed prepara una nueva pasada solo con las categorias añadidas", () => {
  const next = applyAdditionalCategoriesToParsed(
    {
      command: "scrape",
      categoryNames: ["Men"],
      categoryUrls: ["https://shop.example.com/category/shoes"],
      homeUrl: "https://shop.example.com",
      plpUrl: "https://shop.example.com/category/shoes",
      searchUrl: "https://shop.example.com/search?q=shirt",
      pdpUrl: "https://shop.example.com/p/red-shirt",
    },
    {
      categoryUrls: [
        "https://shop.example.com/category/jackets",
        "https://shop.example.com/category/accessories",
      ],
    },
  );

  assert.equal(next.command, "scrape");
  assert.deepEqual(next.categoryNames, []);
  assert.deepEqual(next.categoryUrls, [
    "https://shop.example.com/category/jackets",
    "https://shop.example.com/category/accessories",
  ]);
  assert.equal(next.homeUrl, "");
  assert.equal(next.plpUrl, "");
  assert.equal(next.searchUrl, "");
  assert.equal(next.pdpUrl, "");
});

test("shouldPromptForAdditionalCategoriesAfterScrape solo pregunta si hay categorias procesadas y tty", () => {
  const originalStdinTty = process.stdin.isTTY;
  const originalStdoutTty = process.stdout.isTTY;

  process.stdin.isTTY = true;
  process.stdout.isTTY = true;

  try {
    assert.equal(
      shouldPromptForAdditionalCategoriesAfterScrape(
        {
          summary: {
            categoriesProcessed: 2,
          },
        },
        {
          interactiveAssistance: true,
        },
      ),
      true,
    );

    assert.equal(
      shouldPromptForAdditionalCategoriesAfterScrape(
        {
          summary: {
            categoriesProcessed: 0,
          },
        },
        {
          interactiveAssistance: true,
        },
      ),
      false,
    );
  } finally {
    process.stdin.isTTY = originalStdinTty;
    process.stdout.isTTY = originalStdoutTty;
  }
});
