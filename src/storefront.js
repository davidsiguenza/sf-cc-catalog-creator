import { normalizeWhitespace, normalizeLookupValue, slugify, stripHtmlTags } from "./utils/text.js";
import {
  asAbsoluteUrl,
  cleanUrl,
  getDomainSlug,
  isHttpUrl,
  isSameDomain,
  toOrigin,
} from "./utils/url.js";

const GENERIC_EXCLUDED_LINK_TEXT = new Set([
  "home",
  "inicio",
  "cart",
  "basket",
  "bag",
  "account",
  "login",
  "sign in",
  "wishlist",
  "search",
  "help",
  "contact",
]);

export async function discoverCategories(page, entryUrl, options, warnings) {
  await gotoPage(page, entryUrl, options);

  const rawLinks = await collectLinks(page, options.categoryDiscovery.selectors);
  const unique = dedupeLinks(
    rawLinks
      .map((link) => normalizeLink(link, entryUrl))
      .filter(Boolean)
      .filter((link) => isSameDomain(link.url, entryUrl))
      .filter((link) => !looksLikeProductUrl(link.url))
      .filter((link) => isCategoryCandidate(link, options)),
  );

  if (!unique.length) {
    warnings.push(`No se detectaron categorias en ${entryUrl}; se usara la URL de entrada como unica categoria.`);
    return [
      {
        name: "catalog",
        url: cleanUrl(entryUrl),
        path: ["catalog"],
      },
    ];
  }

  return unique.slice(0, Math.max(options.maxCategories * 3, options.maxCategories)).map((link) => ({
    name: link.text,
    url: link.url,
    path: [link.text],
  }));
}

export async function findRequestedCategories(page, options, topLevelCategories, warnings) {
  const requested = [];
  const unmatchedNames = [];

  for (const categoryUrl of options.categoryUrls) {
    requested.push({
      name: formatCategoryLabel(slugFromUrl(categoryUrl)),
      url: cleanUrl(categoryUrl),
      path: deriveCategoryPathFromUrl(categoryUrl),
    });
  }

  if (!options.categoryNames.length) {
    return requested;
  }

  for (const categoryName of options.categoryNames) {
    const normalizedName = normalizeLookupValue(categoryName);
    const match = topLevelCategories.find(
      (category) => normalizeLookupValue(category.name).includes(normalizedName),
    );

    if (match) {
      requested.push(match);
      continue;
    }

    unmatchedNames.push(categoryName);
  }

  if (!unmatchedNames.length) {
    return dedupeCategoryTargets(requested);
  }

  const subcategoryPool = [];

  for (const category of topLevelCategories.slice(0, options.maxCategories)) {
    const subcategories = await discoverSubcategories(page, category, options, warnings);
    subcategoryPool.push(...subcategories);
  }

  for (const categoryName of unmatchedNames) {
    const normalizedName = normalizeLookupValue(categoryName);
    const match = subcategoryPool.find((category) =>
      normalizeLookupValue(category.name).includes(normalizedName),
    );

    if (match) {
      requested.push(match);
      continue;
    }

    warnings.push(`No se encontro una categoria que coincida con "${categoryName}".`);
  }

  return dedupeCategoryTargets(requested);
}

export async function discoverSubcategories(page, category, options, warnings) {
  await gotoPage(page, category.url, options);

  const links = dedupeLinks(
    (await collectLinks(page, options.categoryDiscovery.selectors))
      .map((link) => normalizeLink(link, category.url))
      .filter(Boolean)
      .filter((link) => isSameDomain(link.url, category.url))
      .filter((link) => link.url !== category.url)
      .filter((link) => !looksLikeProductUrl(link.url))
      .filter((link) => isCategoryCandidate(link, options)),
  )
    .filter((link) => link.url.startsWith(toOrigin(category.url)))
    .slice(0, Math.max(options.maxSubcategoriesPerCategory * 2, options.maxSubcategoriesPerCategory));

  if (!links.length) {
    return [];
  }

  return links.map((link) => ({
    name: link.text,
    url: link.url,
    path: [...category.path, link.text],
  }));
}

export async function extractProductLinksFromCategory(page, category, options, warnings) {
  const collected = [];
  const visited = new Set();
  let currentUrl = category.url;

  for (let pageIndex = 0; pageIndex < options.maxPaginationPages; pageIndex += 1) {
    if (!currentUrl || visited.has(currentUrl)) {
      break;
    }

    visited.add(currentUrl);
    await gotoPage(page, currentUrl, options);

    const pageLinks = dedupeLinks(
      (await collectLinks(page, options.productDiscovery.selectors))
        .map((link) => normalizeLink(link, currentUrl))
        .filter(Boolean)
        .filter((link) => isSameDomain(link.url, currentUrl))
        .filter((link) => looksLikeProductUrl(link.url)),
    );

    for (const link of pageLinks) {
      if (!collected.some((entry) => entry.url === link.url)) {
        collected.push(link);
      }
    }

    if (collected.length >= options.productsPerCategory) {
      break;
    }

    currentUrl = await extractNextPageUrl(page, currentUrl, options.pagination.selectors);
  }

  if (!collected.length) {
    warnings.push(`No se detectaron productos en la categoria ${category.url}`);
  }

  return collected.map((link) => link.url);
}

export async function extractProductData(page, productUrl, category, options, warnings) {
  await gotoPage(page, productUrl, options);

  const extraction = await page.evaluate((config) => {
    const queryValues = (candidates = [], multiple = false) => {
      const values = [];

      for (const candidate of candidates) {
        const [selector, attribute] = candidate.split("@");
        const elements = Array.from(document.querySelectorAll(selector));

        for (const element of elements) {
          const rawValue = attribute ? element.getAttribute(attribute) : element.textContent;
          const value = (rawValue || "").trim();

          if (!value) {
            continue;
          }

          values.push(value);

          if (!multiple) {
            return values;
          }
        }
      }

      return values;
    };

    const parseJson = () => {
      const scripts = Array.from(document.querySelectorAll("script[type='application/ld+json']"));
      const entries = [];

      for (const script of scripts) {
        try {
          const parsed = JSON.parse(script.textContent || "null");
          entries.push(parsed);
        } catch {
          continue;
        }
      }

      return entries.flatMap((entry) => flattenJsonLd(entry));
    };

    const flattenJsonLd = (entry) => {
      if (!entry) {
        return [];
      }

      if (Array.isArray(entry)) {
        return entry.flatMap(flattenJsonLd);
      }

      if (entry["@graph"]) {
        return flattenJsonLd(entry["@graph"]);
      }

      return [entry];
    };

    const jsonLd = parseJson();
    const productNode =
      jsonLd.find((entry) => matchesType(entry, "Product")) ||
      jsonLd.find((entry) => entry.sku || entry.offers || entry.image);

    const breadcrumbNode =
      jsonLd.find((entry) => matchesType(entry, "BreadcrumbList")) || null;

    const breadcrumbTrail = breadcrumbNode?.itemListElement
      ?.map((item) => item?.name || item?.item?.name || item?.item)
      .filter(Boolean);

    const offer = Array.isArray(productNode?.offers) ? productNode.offers[0] : productNode?.offers;

    return {
      name: productNode?.name || queryValues(config.name)[0] || "",
      description:
        productNode?.description ||
        queryValues(config.description)[0] ||
        "",
      sku:
        productNode?.sku ||
        productNode?.mpn ||
        queryValues(config.sku)[0] ||
        "",
      brand:
        productNode?.brand?.name ||
        productNode?.brand ||
        "",
      price:
        offer?.price ||
        offer?.lowPrice ||
        queryValues(config.price)[0] ||
        "",
      currency:
        offer?.priceCurrency ||
        "",
      images: normalizeImages(
        productNode?.image ||
          queryValues(config.images, true),
      ),
      breadcrumbTrail:
        breadcrumbTrail ||
        Array.from(document.querySelectorAll("nav[aria-label*='breadcrumb' i] a, .breadcrumb a"))
          .map((element) => element.textContent?.trim())
          .filter(Boolean),
      bodyText: (document.body?.innerText || "").slice(0, 15000),
      title: document.title || "",
      canonicalUrl:
        document.querySelector("link[rel='canonical']")?.getAttribute("href") || "",
    };

    function matchesType(entry, type) {
      const entryType = entry?.["@type"];

      if (Array.isArray(entryType)) {
        return entryType.includes(type);
      }

      return entryType === type;
    }

    function normalizeImages(value) {
      const list = Array.isArray(value) ? value : [value];

      return list
        .flatMap((item) => {
          if (!item) {
            return [];
          }

          if (typeof item === "string") {
            return [item];
          }

          if (typeof item === "object") {
            return [item.url || item.contentUrl || item.src || ""];
          }

          return [];
        })
        .filter(Boolean);
    }
  }, options.productExtraction);

  const normalized = normalizeExtractedProduct(extraction, productUrl, category, options);

  if (!normalized.price) {
    warnings.push(`No se pudo extraer precio de ${productUrl}`);
  }

  return normalized;
}

async function gotoPage(page, url, options) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeoutMs, 5000) }).catch(() => {});
}

async function collectLinks(page, selectors) {
  return page.evaluate((candidateSelectors) => {
    const links = [];
    const used = new Set();

    for (const selector of candidateSelectors) {
      for (const element of document.querySelectorAll(selector)) {
        const href = element.getAttribute("href");
        const text = (element.textContent || element.getAttribute("aria-label") || "").trim();
        const key = `${href}|${text}`;

        if (!href || used.has(key)) {
          continue;
        }

        used.add(key);
        links.push({ href, text });
      }
    }

    if (links.length) {
      return links;
    }

    return Array.from(document.querySelectorAll("a[href]")).map((element) => ({
      href: element.getAttribute("href"),
      text: (element.textContent || element.getAttribute("aria-label") || "").trim(),
    }));
  }, selectors);
}

async function extractNextPageUrl(page, currentUrl, selectors) {
  const nextLink = await page.evaluate((candidateSelectors) => {
    for (const selector of candidateSelectors) {
      const element = document.querySelector(selector);

      if (element?.getAttribute("href")) {
        return element.getAttribute("href");
      }
    }

    return "";
  }, selectors);

  return nextLink ? asAbsoluteUrl(nextLink, currentUrl) : "";
}

function normalizeExtractedProduct(extraction, productUrl, category, options) {
  const breadcrumb = normalizeBreadcrumb(extraction.breadcrumbTrail, category.path);
  const urlDerivedTrail = deriveCategoryPathFromUrl(productUrl);
  const categoryPath =
    urlDerivedTrail.length >= 2 ? urlDerivedTrail : breadcrumb.length ? breadcrumb : category.path;
  const allImages = extraction.images
    .map((image) => asAbsoluteUrl(image, productUrl))
    .filter(Boolean)
    .filter(isHttpUrl);

  const price = parsePrice(extraction.price);
  const normalizedDescription = normalizeWhitespace(stripHtmlTags(extraction.description || ""));
  const normalizedSku = normalizeSku(extraction.sku, extraction.bodyText, productUrl);
  const productId = slugify(normalizedSku || extraction.name || productUrl) || getDomainSlug(productUrl);

  return {
    productId,
    name: normalizeWhitespace(extraction.name || extraction.title),
    description: normalizedDescription,
    sku: normalizedSku,
    price,
    currency: extraction.currency || options.currency,
    brand: normalizeWhitespace(extraction.brand || ""),
    productUrl: cleanUrl(extraction.canonicalUrl || productUrl),
    category: categoryPath[0] || "",
    subcategory: categoryPath.length > 1 ? categoryPath[1] : "",
    categoryPath: categoryPath.join(" > "),
    categoryTrail: categoryPath,
    allCategoryPaths: [categoryPath.join(" > ")],
    imageUrls: dedupeStrings(allImages).slice(0, 3),
    sourceSite: toOrigin(productUrl),
  };
}

function normalizeBreadcrumb(values, fallbackPath) {
  const trail = (values || [])
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .filter((value) => !["home", "inicio"].includes(normalizeLookupValue(value)));

  return trail.length ? trail : fallbackPath;
}

function deriveCategoryPathFromUrl(url) {
  try {
    const segments = new URL(url).pathname
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment));

    const localeOffset = segments[0]?.includes("_") ? 1 : 0;
    const candidates = segments.slice(localeOffset, localeOffset + 2);

    if (candidates.length < 2) {
      return candidates.map(formatCategoryLabel).filter(Boolean);
    }

    if (!isCategoryPathSegment(candidates[0]) || !isCategoryPathSegment(candidates[1])) {
      return [];
    }

    return candidates.map(formatCategoryLabel);
  } catch {
    return [];
  }
}

function normalizeSku(value, bodyText, productUrl) {
  const normalizedValue = normalizeWhitespace(value);

  if (normalizedValue) {
    const optionMatch = normalizedValue.match(/[?&]option=([A-Z0-9-]+)/i);
    if (optionMatch?.[1]) {
      return optionMatch[1];
    }

    const codeMatch = normalizedValue.match(/-([A-Z0-9]{5,}-\d{3})(?:$|[?#/])/i);
    if (codeMatch?.[1]) {
      return codeMatch[1];
    }

    if (!/^https?:\/\//i.test(normalizedValue)) {
      return normalizedValue;
    }
  }

  const match = bodyText.match(/\bsku\b[\s:#-]*([A-Z0-9._-]+)/i);

  if (match?.[1]) {
    return match[1];
  }

  return slugify(productUrl).slice(0, 50);
}

function parsePrice(rawPrice) {
  const candidate = String(rawPrice || "")
    .replace(/[^\d,.-]/g, "")
    .trim();

  if (!candidate) {
    return "";
  }

  const normalized =
    candidate.includes(",") && candidate.includes(".")
      ? candidate.lastIndexOf(",") > candidate.lastIndexOf(".")
        ? candidate.replace(/\./g, "").replace(",", ".")
        : candidate.replace(/,/g, "")
      : candidate.replace(",", ".");

  const numeric = Number.parseFloat(normalized);
  return Number.isFinite(numeric) ? numeric.toFixed(2) : "";
}

function isCategoryPathSegment(value) {
  return /^(hombre|mujer|men|women|unisex|ropa|zapatos|bags-accessories|bolsos-accesorios|accessories)$/i.test(
    value,
  );
}

function normalizeLink(link, baseUrl) {
  const url = asAbsoluteUrl(link.href, baseUrl);
  const text = normalizeWhitespace(link.text);

  if (!url) {
    return null;
  }

  return {
    url: cleanUrl(url),
    text,
  };
}

function dedupeLinks(links) {
  const seen = new Set();
  const result = [];

  for (const link of links) {
    if (!link?.url || seen.has(link.url)) {
      continue;
    }

    seen.add(link.url);
    result.push(link);
  }

  return result;
}

function dedupeStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function looksLikeProductUrl(url) {
  return /\/p\/|\/product\/|\/products\/|\/producto(?:\/|\?|$)|[?&]pid=|[?&]sku=|[?&]option=|-[A-Z0-9]{5,}-\d{3}(?:$|[?#])/i.test(
    url,
  );
}

function isCategoryCandidate(link, options) {
  const text = normalizeLookupValue(link.text);

  if (!text || GENERIC_EXCLUDED_LINK_TEXT.has(text)) {
    return false;
  }

  if (text.length < 2 || text.length > 60) {
    return false;
  }

  const { includePatterns, excludePatterns } = options.categoryDiscovery;

  if (excludePatterns.some((pattern) => link.url.includes(pattern))) {
    return false;
  }

  if (includePatterns.some((pattern) => link.url.includes(pattern))) {
    return true;
  }

  return /shop|category|department|collection|women|men|mujer|hombre|ropa|zapatos|bags-accessories|kids|new|sale/i.test(
    link.url + link.text,
  );
}

function slugFromUrl(url) {
  const pathname = new URL(url).pathname.split("/").filter(Boolean);
  return pathname.at(-1) || "category";
}

function dedupeCategoryTargets(categories) {
  const seen = new Set();
  const result = [];

  for (const category of categories) {
    if (!category?.url || seen.has(category.url)) {
      continue;
    }

    seen.add(category.url);
    result.push(category);
  }

  return result;
}

function formatCategoryLabel(value) {
  const normalized = String(value || "")
    .replace(/[-_]+/g, " ")
    .trim();

  const aliases = new Map([
    ["bags accessories", "Accesorios"],
    ["bolsos accesorios", "Accesorios"],
    ["men", "Hombre"],
    ["women", "Mujer"],
    ["hombre", "Hombre"],
    ["mujer", "Mujer"],
    ["ropa", "Ropa"],
    ["zapatos", "Zapatos"],
    ["unisex", "Unisex"],
    ["accessories", "Accesorios"],
  ]);

  const alias = aliases.get(normalizeLookupValue(normalized));
  if (alias) {
    return alias;
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
    .join(" ");
}
