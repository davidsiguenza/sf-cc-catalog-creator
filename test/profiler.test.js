import assert from "node:assert/strict";
import test from "node:test";

import { inferPageType } from "../src/profiler.js";

test("inferPageType prioriza PLP cuando una muestra marcada como plp tiene varios enlaces de producto", () => {
  const detectedType = inferPageType(
    { type: "plp" },
    {
      url: "https://www.alvaromoreno.com/es_es/hombre/americanas/",
      productCandidateCount: 8,
      categoryCandidateCount: 8,
      signals: {
        hasJsonLdProduct: false,
        hasAddToCart: true,
        hasPriceNodes: true,
      },
    },
  );

  assert.equal(detectedType, "plp");
});

test("inferPageType mantiene PDP cuando la muestra marcada como pdp tiene senales de compra", () => {
  const detectedType = inferPageType(
    { type: "pdp" },
    {
      url: "https://www.alvaromoreno.com/es_es/americana-domenico-crudo-769126050_IVO.html",
      productCandidateCount: 6,
      categoryCandidateCount: 1,
      signals: {
        hasJsonLdProduct: false,
        hasAddToCart: true,
        hasPriceNodes: true,
      },
    },
  );

  assert.equal(detectedType, "pdp");
});
