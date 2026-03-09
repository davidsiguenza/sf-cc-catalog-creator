import { normalizeWhitespace } from "../../utils/text.js";
import { cleanUrl, isHttpUrl, toOrigin } from "../../utils/url.js";

export function createCanonicalProduct(input = {}) {
  const knownCategoryPaths = normalizeCategoryPaths(input.allCategoryPaths || []);
  const categoryPathSeed =
    normalizeWhitespace(input.categoryPath) ||
    knownCategoryPaths[0] ||
    buildCategoryPath(input.categoryTrail, input.category, input.subcategory);
  const categoryTrail = normalizeCategoryTrail(input.categoryTrail, categoryPathSeed, input.category, input.subcategory);
  const categoryPath = normalizeWhitespace(categoryPathSeed || categoryTrail.join(" > "));
  const productUrl = normalizeHttpUrl(input.productUrl);
  const imageUrls = dedupeStrings((input.imageUrls || []).map(normalizeHttpUrl).filter(Boolean)).slice(0, 3);
  const allCategoryPaths = dedupeStrings([...knownCategoryPaths, categoryPath].filter(Boolean));

  return {
    ...input,
    productId: normalizeWhitespace(input.productId),
    sku: normalizeWhitespace(input.sku),
    name: normalizeWhitespace(input.name),
    description: normalizeWhitespace(input.description),
    brand: normalizeWhitespace(input.brand),
    price: normalizeWhitespace(input.price),
    currency: normalizeWhitespace(input.currency),
    productUrl,
    category: categoryTrail[0] || "",
    subcategory: categoryTrail[1] || "",
    categoryPath,
    categoryTrail,
    allCategoryPaths,
    imageUrls,
    sourceSite: normalizeSourceSite(input.sourceSite, productUrl),
    sourceType: normalizeWhitespace(input.sourceType),
    sourceConfidence: clampConfidence(input.sourceConfidence),
    rawSignals: {
      jsonld: false,
      dom: false,
      network: false,
      ...(input.rawSignals || {}),
    },
  };
}

function normalizeCategoryTrail(trail, categoryPath, category, subcategory) {
  const fromTrail = Array.isArray(trail)
    ? trail.map((value) => normalizeWhitespace(value)).filter(Boolean)
    : [];

  if (fromTrail.length) {
    return fromTrail;
  }

  if (categoryPath) {
    return String(categoryPath)
      .split(">")
      .map((segment) => normalizeWhitespace(segment))
      .filter(Boolean);
  }

  return [normalizeWhitespace(category), normalizeWhitespace(subcategory)].filter(Boolean);
}

function buildCategoryPath(trail, category, subcategory) {
  const normalizedTrail = normalizeCategoryTrail(trail, "", category, subcategory);
  return normalizedTrail.join(" > ");
}

function normalizeCategoryPaths(values) {
  return dedupeStrings(
    (Array.isArray(values) ? values : [])
      .map((value) => normalizeWhitespace(value))
      .filter(Boolean),
  );
}

function normalizeHttpUrl(value) {
  if (!isHttpUrl(value)) {
    return "";
  }

  try {
    return cleanUrl(value);
  } catch {
    return "";
  }
}

function normalizeSourceSite(value, productUrl) {
  if (isHttpUrl(value)) {
    try {
      return toOrigin(value);
    } catch {
      return "";
    }
  }

  if (!productUrl) {
    return "";
  }

  try {
    return toOrigin(productUrl);
  } catch {
    return "";
  }
}

function clampConfidence(value) {
  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(1, numeric));
}

function dedupeStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
