import path from "node:path";

import {
  DEFAULT_CATEGORY_DISCOVERY,
  DEFAULT_PAGINATION,
  DEFAULT_PRODUCT_DISCOVERY,
} from "./site-profiles/defaults.js";
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
      ...DEFAULT_CATEGORY_DISCOVERY,
      ...(config.categoryDiscovery || {}),
    },
    productDiscovery: {
      ...DEFAULT_PRODUCT_DISCOVERY,
      ...(config.productDiscovery || {}),
    },
    pagination: {
      ...DEFAULT_PAGINATION,
      ...(config.pagination || {}),
    },
    productExtraction: {
      name: [
        "[itemprop='name']",
        ".productName",
        ".product-name",
        "h1",
        "meta[property='og:title']@content",
        "meta[name='twitter:title']@content",
      ],
      description: [
        "[itemprop='description']",
        ".productDescription",
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
        "[itemprop='price']",
        "[itemprop='price']@content",
        ".sales .value",
        ".price",
        ".product-price",
      ],
      currency: [
        "[itemprop='priceCurrency']",
        "[itemprop='priceCurrency']@content",
        ".currency option[selected]@value",
        ".currency option[selected]",
      ],
      images: [
        "a.additionalImage@href",
        ".additionalImage@href",
        "a.fancygallery@href",
        "#ProductImage@src",
        "img.productImage@src",
        "[itemprop='image']@src",
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
