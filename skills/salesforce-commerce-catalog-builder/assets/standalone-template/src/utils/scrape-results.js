import { validateCatalog } from "../core/validate/catalog.js";
import { mergeProducts } from "./products.js";

export function mergeScrapeResults(existing = null, incoming = null) {
  if (!existing && !incoming) {
    return buildEmptyScrapeResult();
  }

  if (!existing) {
    return finalizeScrapeResult(incoming);
  }

  if (!incoming) {
    return finalizeScrapeResult(existing);
  }

  const productMap = new Map();

  for (const product of existing.products || []) {
    upsertProduct(productMap, product);
  }

  for (const product of incoming.products || []) {
    upsertProduct(productMap, product);
  }

  const categories = mergeCategories(existing.categories || [], incoming.categories || []);
  const products = Array.from(productMap.values());
  const validation = validateCatalog(products);
  const warnings = dedupeValues([
    ...(existing.warnings || []),
    ...(incoming.warnings || []),
    ...validation.warnings,
  ]);

  return {
    products,
    categories,
    warnings,
    validation,
    summary: buildSummary(categories, products, validation),
  };
}

function finalizeScrapeResult(result) {
  const products = Array.isArray(result?.products) ? result.products : [];
  const categories = mergeCategories(result?.categories || [], []);
  const validation = validateCatalog(products);
  const warnings = dedupeValues([...(result?.warnings || []), ...validation.warnings]);

  return {
    products,
    categories,
    warnings,
    validation,
    summary: buildSummary(categories, products, validation),
  };
}

function buildEmptyScrapeResult() {
  const validation = validateCatalog([]);

  return {
    products: [],
    categories: [],
    warnings: [...validation.warnings],
    validation,
    summary: buildSummary([], [], validation),
  };
}

function buildSummary(categories, products, validation) {
  return {
    categoriesProcessed: categories.length,
    productsExtracted: products.length,
    productsValid: validation.summary.validProducts,
    validationErrors: validation.summary.errorCount,
    validationWarnings: validation.summary.warningCount,
  };
}

function upsertProduct(productMap, product) {
  const key = product?.sku || product?.productId || product?.productUrl;

  if (!key) {
    return;
  }

  const existing = productMap.get(key);
  productMap.set(key, mergeProducts(existing, product));
}

function mergeCategories(existingCategories, incomingCategories) {
  const categoryMap = new Map();

  for (const category of [...existingCategories, ...incomingCategories]) {
    const key = buildCategoryKey(category);

    if (!key) {
      continue;
    }

    const existing = categoryMap.get(key);
    categoryMap.set(key, mergeCategory(existing, category));
  }

  return Array.from(categoryMap.values());
}

function mergeCategory(existing, incoming) {
  if (!existing) {
    return {
      ...incoming,
    };
  }

  return {
    ...existing,
    ...incoming,
    name: incoming?.name || existing.name,
    url: incoming?.url || existing.url,
    path: Array.isArray(incoming?.path) && incoming.path.length ? incoming.path : existing.path,
    productLinksDiscovered: Math.max(existing.productLinksDiscovered || 0, incoming?.productLinksDiscovered || 0),
  };
}

function buildCategoryKey(category) {
  if (category?.url) {
    return category.url;
  }

  if (Array.isArray(category?.path) && category.path.length) {
    return category.path.join(" > ");
  }

  return category?.name || "";
}

function dedupeValues(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
