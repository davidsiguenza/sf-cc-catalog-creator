import { chromium } from "playwright";

import { mergeProducts } from "./utils/products.js";
import {
  discoverCategories,
  discoverSubcategories,
  findRequestedCategories,
  extractProductLinksFromCategory,
  extractProductData,
} from "./storefront.js";

export async function scrapeCatalog(options) {
  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  const warnings = [];
  const categoryPage = await context.newPage();
  const productMap = new Map();
  const processedCategories = [];

  try {
    const topLevelCategories = await discoverCategories(categoryPage, options.entryUrl, options, warnings);

    const requestedCategories =
      options.categoryNames.length || options.categoryUrls.length
        ? await findRequestedCategories(categoryPage, options, topLevelCategories, warnings)
        : topLevelCategories.slice(0, options.maxCategories);

    const categoriesToProcess = [];

    for (const category of requestedCategories) {
      categoriesToProcess.push(category);

      if (options.maxSubcategoriesPerCategory > 0) {
        const subcategories = await discoverSubcategories(categoryPage, category, options, warnings);
        categoriesToProcess.push(
          ...subcategories.slice(0, options.maxSubcategoriesPerCategory),
        );
      }
    }

    const seenCategoryUrls = new Set();

    for (const category of categoriesToProcess) {
      if (!category?.url || seenCategoryUrls.has(category.url)) {
        continue;
      }

      seenCategoryUrls.add(category.url);

      const productLinks = await extractProductLinksFromCategory(categoryPage, category, options, warnings);
      processedCategories.push({
        ...category,
        productLinksDiscovered: productLinks.length,
      });

      for (const productLink of productLinks.slice(0, options.productsPerCategory)) {
        const productPage = await context.newPage();

        try {
          const product = await extractProductData(productPage, productLink, category, options, warnings);

          if (!product.name && !product.sku) {
            warnings.push(`Producto omitido por datos insuficientes: ${productLink}`);
            continue;
          }

          const key = product.sku || product.productId || product.productUrl;
          const existing = productMap.get(key);
          productMap.set(key, mergeProducts(existing, product));
        } finally {
          await productPage.close();
        }
      }
    }
  } finally {
    await categoryPage.close();
    await context.close();
    await browser.close();
  }

  return {
    products: Array.from(productMap.values()),
    categories: processedCategories,
    warnings,
    summary: {
      categoriesProcessed: processedCategories.length,
      productsExtracted: productMap.size,
    },
  };
}
