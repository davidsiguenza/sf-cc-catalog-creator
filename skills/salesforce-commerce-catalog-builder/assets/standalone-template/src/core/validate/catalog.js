import { validateCanonicalProduct } from "./product.js";

export function validateCatalog(products = []) {
  const results = products.map((product) => ({
    key: product.productId || product.sku || product.productUrl || "unknown-product",
    ...validateCanonicalProduct(product),
  }));

  const summary = {
    productCount: products.length,
    validProducts: results.filter((result) => result.valid).length,
    productsWithErrors: results.filter((result) => result.errorCount > 0).length,
    productsWithWarnings: results.filter((result) => result.warningCount > 0).length,
    errorCount: results.reduce((total, result) => total + result.errorCount, 0),
    warningCount: results.reduce((total, result) => total + result.warningCount, 0),
    priceCoverage: calculateCoverage(products, (product) => Boolean(product.price)),
    imageCoverage: calculateCoverage(products, (product) => Boolean(product.imageUrls?.length)),
    categoryCoverage: calculateCoverage(
      products,
      (product) => Boolean(product.categoryPath || product.allCategoryPaths?.length),
    ),
  };

  const warnings = [];

  if (!products.length) {
    warnings.push("No se extrajeron productos para validar.");
  }

  if (products.length && summary.priceCoverage < 0.5) {
    warnings.push(`Cobertura de precio baja (${formatPercentage(summary.priceCoverage)}).`);
  }

  if (products.length && summary.imageCoverage < 0.5) {
    warnings.push(`Cobertura de imagen baja (${formatPercentage(summary.imageCoverage)}).`);
  }

  if (products.length && summary.categoryCoverage < 0.5) {
    warnings.push(`Cobertura de categoria baja (${formatPercentage(summary.categoryCoverage)}).`);
  }

  return {
    products: results,
    summary,
    warnings,
  };
}

function calculateCoverage(products, predicate) {
  if (!products.length) {
    return 0;
  }

  const hits = products.filter(predicate).length;
  return Number((hits / products.length).toFixed(4));
}

function formatPercentage(value) {
  return `${Math.round(value * 100)}%`;
}
