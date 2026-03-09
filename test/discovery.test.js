import assert from "node:assert/strict";
import test from "node:test";

import { isCategoryCandidate, looksLikeProductUrl, scoreCategoryCandidate, scoreProductUrl } from "../src/discovery/url-scoring.js";
import { deriveCategoryPathFromUrl } from "../src/discovery/link-utils.js";

test("scoreProductUrl reconoce patrones clasicos y legacy ASPX", () => {
  assert.ok(scoreProductUrl("https://shop.example.com/p/red-shoe") >= 3);
  assert.ok(scoreProductUrl("https://eu.salesforcestore.com/Salesforce-Patagonia-Daypack-P1532.aspx") >= 3);
  assert.equal(looksLikeProductUrl("https://shop.example.com/account"), false);
});

test("scoreProductUrl prioriza PDP SEO de SFCC frente a quick view", () => {
  const seoProductUrl = "https://www.alvaromoreno.com/es_es/americana-domenico-crudo-769126050_IVO.html";
  const quickViewUrl =
    "https://www.alvaromoreno.com/on/demandware.store/Sites-AlvaroMoreno_es-Site/es/Product-ShowQuickView?pid=769126050_IVO";

  assert.ok(scoreProductUrl(seoProductUrl) > scoreProductUrl(quickViewUrl));
  assert.ok(looksLikeProductUrl(seoProductUrl));
});

test("scoreCategoryCandidate reconoce categorias legacy y evita textos excluidos", () => {
  const options = {
    categoryDiscovery: {
      includePatterns: ["/category/"],
      excludePatterns: ["/account", "/login", "/cart", "/checkout", "/wishlist", "/search", "/blog"],
    },
  };

  const legacyCategory = {
    url: "https://eu.salesforcestore.com/Apparel-C2.aspx",
    text: "Apparel",
  };
  const excluded = {
    url: "https://shop.example.com/search",
    text: "Search",
  };

  assert.ok(scoreCategoryCandidate(legacyCategory, options) >= 3);
  assert.equal(isCategoryCandidate(legacyCategory, options), true);
  assert.equal(isCategoryCandidate(excluded, options), false);
});

test("deriveCategoryPathFromUrl limpia sufijos legacy ASPX", () => {
  assert.deepEqual(deriveCategoryPathFromUrl("https://eu.salesforcestore.com/Apparel-C2.aspx"), ["Apparel"]);
});
