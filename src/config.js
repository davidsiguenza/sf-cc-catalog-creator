import path from "node:path";

import { readJsonFile } from "./utils/fs.js";

export async function loadSiteConfig(configPath) {
  if (!configPath) {
    return {};
  }

  const absolutePath = path.resolve(configPath);
  return readJsonFile(absolutePath);
}

export function mergeOptionsWithConfig(defaults, parsed, config) {
  return {
    ...defaults,
    ...config,
    ...dropUndefined(parsed),
    entryUrl: parsed.entryUrl || config.entryUrl || defaults.entryUrl,
    categoryNames: parsed.categoryNames.length ? parsed.categoryNames : config.categoryNames || [],
    categoryUrls: parsed.categoryUrls.length ? parsed.categoryUrls : config.categoryUrls || [],
    formats: parsed.formats || config.formats || defaults.formats,
    categoryDiscovery: {
      selectors: [
        "header nav a[href]",
        "nav a[href]",
        "[role='navigation'] a[href]",
        ".menu a[href]",
        ".navigation a[href]",
      ],
      includePatterns: ["/c/", "cgid=", "/collections/", "/category/", "/departments/", "/shop/"],
      excludePatterns: ["/account", "/login", "/cart", "/checkout", "/wishlist", "/search", "/blog"],
      ...(config.categoryDiscovery || {}),
    },
    productDiscovery: {
      selectors: [
        "a[href*='/p/']",
        "a[href*='/product/']",
        "a[href*='/products/']",
        "a[href*='pid=']",
        "[data-product-id] a[href]",
        ".product a[href]",
        ".product-card a[href]",
      ],
      ...(config.productDiscovery || {}),
    },
    pagination: {
      selectors: [
        "a[rel='next']",
        ".pagination-next a[href]",
        ".next a[href]",
        ".pagination a.next[href]",
      ],
      ...(config.pagination || {}),
    },
    productExtraction: {
      name: ["h1", "meta[property='og:title']@content", "meta[name='twitter:title']@content"],
      description: [
        "[itemprop='description']",
        ".product-description",
        "meta[name='description']@content",
      ],
      sku: [
        "[itemprop='sku']",
        "[data-product-id]@data-product-id",
        ".sku",
        ".product-id",
      ],
      price: [
        "[itemprop='price']@content",
        ".sales .value",
        ".price",
        ".product-price",
      ],
      images: [
        "meta[property='og:image']@content",
        ".product-detail img@src",
        ".product img@src",
        "img@src",
      ],
      ...(config.productExtraction || {}),
    },
  };
}

function dropUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
