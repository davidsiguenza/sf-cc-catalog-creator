import { validateCatalog } from "./core/validate/catalog.js";
import { mergeProducts } from "./utils/products.js";

export async function scrapeCatalog(options) {
  const storefront = await loadStorefrontTransport(options);
  const { browser, context, categoryPage, createProductHandle } = await createTransportHandles(options);
  const warnings = [];
  const productMap = new Map();
  const processedCategories = [];

  try {
    const topLevelCategories = await storefront.discoverCategories(categoryPage, options.entryUrl, options, warnings);

    const requestedCategories =
      options.categoryNames.length || options.categoryUrls.length
        ? await storefront.findRequestedCategories(categoryPage, options, topLevelCategories, warnings)
        : topLevelCategories.slice(0, options.maxCategories);

    const categoriesToProcess = [];

    for (const category of requestedCategories) {
      categoriesToProcess.push(category);

      if (options.maxSubcategoriesPerCategory > 0) {
        const subcategories = await storefront.discoverSubcategories(categoryPage, category, options, warnings);
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

      const productLinks = await storefront.extractProductLinksFromCategory(categoryPage, category, options, warnings);
      processedCategories.push({
        ...category,
        productLinksDiscovered: productLinks.length,
      });

      for (const productLink of productLinks.slice(0, options.productsPerCategory)) {
        const productPage = await createProductHandle();

        try {
          const product = await storefront.extractProductData(productPage, productLink, category, options, warnings);

          if (!product.name && !product.sku) {
            warnings.push(`Producto omitido por datos insuficientes: ${productLink}`);
            continue;
          }

          const key = product.sku || product.productId || product.productUrl;
          const existing = productMap.get(key);
          productMap.set(key, mergeProducts(existing, product));
        } finally {
          await closeTransportHandle(productPage);
        }
      }
    }
  } finally {
    await closeTransportHandle(categoryPage);
    await context?.close?.();
    await browser?.close?.();
  }

  const products = Array.from(productMap.values());
  const validation = validateCatalog(products);

  for (const warning of validation.warnings) {
    if (!warnings.includes(warning)) {
      warnings.push(warning);
    }
  }

  return {
    products,
    categories: processedCategories,
    warnings,
    validation,
    summary: {
      categoriesProcessed: processedCategories.length,
      productsExtracted: productMap.size,
      productsValid: validation.summary.validProducts,
      validationErrors: validation.summary.errorCount,
      validationWarnings: validation.summary.warningCount,
    },
  };
}

async function loadStorefrontTransport(options) {
  if (options.profileTransport === "fetch") {
    return import("./fetch-storefront.js");
  }

  return import("./storefront.js");
}

async function createTransportHandles(options) {
  if (options.profileTransport === "fetch") {
    return {
      browser: null,
      context: null,
      categoryPage: null,
      createProductHandle: async () => null,
    };
  }

  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  return {
    browser,
    context,
    categoryPage: await context.newPage(),
    createProductHandle: async () => context.newPage(),
  };
}

async function closeTransportHandle(handle) {
  await handle?.close?.();
}
