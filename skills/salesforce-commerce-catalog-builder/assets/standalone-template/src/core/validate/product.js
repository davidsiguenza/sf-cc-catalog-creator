export function validateCanonicalProduct(product) {
  const issues = [];

  if (!product.productId) {
    issues.push(buildIssue("error", "productId", "Producto sin productId canonico."));
  }

  if (!product.name) {
    issues.push(buildIssue("error", "name", "Producto sin nombre."));
  }

  if (!product.sku) {
    issues.push(buildIssue("warning", "sku", "Producto sin SKU."));
  }

  if (!product.price) {
    issues.push(buildIssue("warning", "price", "Producto sin precio."));
  }

  if (!product.productUrl) {
    issues.push(buildIssue("warning", "productUrl", "Producto sin URL canonica."));
  }

  if (!product.imageUrls?.length) {
    issues.push(buildIssue("warning", "imageUrls", "Producto sin imagenes."));
  }

  if (!product.categoryPath && !product.allCategoryPaths?.length) {
    issues.push(buildIssue("warning", "categoryPath", "Producto sin categoria canonica."));
  }

  return {
    valid: !issues.some((issue) => issue.level === "error"),
    issues,
    errorCount: issues.filter((issue) => issue.level === "error").length,
    warningCount: issues.filter((issue) => issue.level === "warning").length,
  };
}

function buildIssue(level, field, message) {
  return { level, field, message };
}
