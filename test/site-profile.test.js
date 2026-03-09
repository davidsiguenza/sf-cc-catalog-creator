import assert from "node:assert/strict";
import test from "node:test";

import { detectPlatformHint } from "../src/platforms/detector.js";
import { buildSiteProfile } from "../src/site-profiles/schema.js";

test("detectPlatformHint reconoce legacy ASP.NET store", () => {
  const detector = detectPlatformHint([
    {
      url: "https://eu.salesforcestore.com/Apparel-C2.aspx",
      topProductUrls: ["https://eu.salesforcestore.com/Salesforce-Patagonia-Daypack-P1532.aspx"],
      topCategoryUrls: ["https://eu.salesforcestore.com/Apparel-C2.aspx"],
      signals: { platformTokens: ["aspnet-viewstate", "aspnet-webforms"] },
    },
  ]);

  assert.equal(detector.hint, "legacy-aspnet-store");
  assert.ok(detector.confidence >= 0.8);
});

test("buildSiteProfile genera perfil util y candidatos de aprendizaje", () => {
  const profile = buildSiteProfile({
    entryUrl: "https://eu.salesforcestore.com/",
    samplePages: [
      {
        typeRequested: "home",
        detectedType: "home",
        url: "https://eu.salesforcestore.com/",
        topProductUrls: ["https://eu.salesforcestore.com/Salesforce-Patagonia-Daypack-P1532.aspx"],
        topCategoryUrls: ["https://eu.salesforcestore.com/Apparel-C2.aspx"],
        productCandidateCount: 3,
        categoryCandidateCount: 4,
        signals: {
          hasJsonLdProduct: false,
          platformTokens: ["aspnet-viewstate", "aspnet-webforms"],
        },
      },
    ],
  });

  assert.equal(profile.platformHint, "legacy-aspnet-store");
  assert.ok(profile.categoryDiscovery.includePatterns.includes("-C\\d+\\.aspx$"));
  assert.ok(profile.productDiscovery.selectors.includes("a[href*='-P']"));
  assert.equal(profile.preferredSources[0], "dom");
});

test("buildSiteProfile propone aprendizaje cuando no hay plataforma conocida", () => {
  const profile = buildSiteProfile({
    entryUrl: "https://catalog.example.com/",
    samplePages: [
      {
        typeRequested: "plp",
        detectedType: "plp",
        url: "https://catalog.example.com/list",
        topProductUrls: ["https://catalog.example.com/item-1001"],
        topCategoryUrls: ["https://catalog.example.com/section/shoes"],
        productCandidateCount: 2,
        categoryCandidateCount: 2,
        signals: {
          hasJsonLdProduct: false,
          platformTokens: [],
        },
      },
    ],
  });

  assert.equal(profile.platformHint, "generic");
  assert.ok(profile.learningCandidates.length >= 1);
});

test("buildSiteProfile no penaliza una PLP aportada por el usuario", () => {
  const profile = buildSiteProfile({
    entryUrl: "https://shop.example.com/",
    samplePages: [
      {
        typeRequested: "plp",
        detectedType: "pdp",
        source: "input",
        url: "https://shop.example.com/category/blazers",
        topProductUrls: [
          "https://shop.example.com/on/demandware.store/Sites-Shop-Site/es/Product-ShowQuickView?pid=769126050_IVO",
        ],
        topCategoryUrls: ["https://shop.example.com/category/blazers"],
        productCandidateCount: 8,
        categoryCandidateCount: 2,
        signals: {
          hasJsonLdProduct: false,
          platformTokens: ["demandware"],
        },
      },
    ],
  });

  assert.equal(profile.platformHint, "sfcc");
  assert.ok(profile.confidence >= 0.7);
});
