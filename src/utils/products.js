import { slugify } from "./text.js";

export function mergeProducts(existing, next) {
  if (!existing) {
    return {
      ...next,
      allCategoryPaths: Array.from(new Set(next.allCategoryPaths)),
      imageUrls: Array.from(new Set(next.imageUrls)),
    };
  }

  return {
    ...existing,
    ...pickDefined(existing, next),
    imageUrls: Array.from(new Set([...(existing.imageUrls || []), ...(next.imageUrls || [])])).slice(0, 3),
    allCategoryPaths: Array.from(
      new Set([...(existing.allCategoryPaths || []), ...(next.allCategoryPaths || [])]),
    ),
  };
}

export function buildCategoryTree(products) {
  const categories = new Map();

  for (const product of products) {
    for (const categoryPath of product.allCategoryPaths) {
      const segments = categoryPath
        .split(">")
        .map((segment) => segment.trim())
        .filter(Boolean);

      let currentPath = [];

      for (const segment of segments) {
        currentPath = [...currentPath, segment];
        const fullPath = currentPath.join(" > ");

        if (categories.has(fullPath)) {
          continue;
        }

        const parentPath = currentPath.slice(0, -1).join(" > ");
        categories.set(fullPath, {
          id: slugify(fullPath),
          name: segment,
          path: [...currentPath],
          depth: currentPath.length,
          parentId: parentPath ? slugify(parentPath) : "",
        });
      }
    }
  }

  return categories;
}

function pickDefined(existing, next) {
  return Object.fromEntries(
    Object.entries(next).map(([key, value]) => [
      key,
      value === undefined || value === null || value === "" ? existing[key] : value,
    ]),
  );
}
