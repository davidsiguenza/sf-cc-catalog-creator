import { load } from "cheerio";

import { normalizeExtractedProduct } from "./core/normalize/product.js";
import {
  dedupeCategoryTargets,
  dedupeLinks,
  deriveCategoryPathFromUrl,
  formatCategoryLabel,
  normalizeLink,
  slugFromUrl,
} from "./discovery/link-utils.js";
import {
  isCategoryCandidate,
  looksLikeProductUrl,
  scoreCategoryCandidate,
  scoreProductUrl,
} from "./discovery/url-scoring.js";
import { normalizeLookupValue, normalizeWhitespace } from "./utils/text.js";
import { asAbsoluteUrl, cleanUrl, isSameDomain, toOrigin } from "./utils/url.js";

export async function discoverCategories(_page, entryUrl, options, warnings) {
  const document = await fetchDocument(entryUrl, options);
  const rawLinks = collectLinksFromDocument(document.$, options.categoryDiscovery.selectors);
  const unique = dedupeLinks(
    rawLinks
      .map((link) => normalizeLink(link, document.url))
      .filter(Boolean)
      .filter((link) => isSameDomain(link.url, entryUrl))
      .filter((link) => !looksLikeProductUrl(link.url))
      .map((link) => ({ ...link, score: scoreCategoryCandidate(link, options) }))
      .filter((link) => isCategoryCandidate(link, options))
      .sort((left, right) => right.score - left.score),
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

export async function findRequestedCategories(_page, options, topLevelCategories, warnings) {
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
    const subcategories = await discoverSubcategories(null, category, options, warnings);
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

export async function discoverSubcategories(_page, category, options, _warnings) {
  const document = await fetchDocument(category.url, options);
  const links = dedupeLinks(
    collectLinksFromDocument(document.$, options.categoryDiscovery.selectors)
      .map((link) => normalizeLink(link, document.url))
      .filter(Boolean)
      .filter((link) => isSameDomain(link.url, category.url))
      .filter((link) => link.url !== category.url)
      .filter((link) => !looksLikeProductUrl(link.url))
      .map((link) => ({ ...link, score: scoreCategoryCandidate(link, options) }))
      .filter((link) => isCategoryCandidate(link, options))
      .sort((left, right) => right.score - left.score),
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

export async function extractProductLinksFromCategory(_page, category, options, warnings) {
  const collected = [];
  const visited = new Set();
  let currentUrl = category.url;

  for (let pageIndex = 0; pageIndex < options.maxPaginationPages; pageIndex += 1) {
    if (!currentUrl || visited.has(currentUrl)) {
      break;
    }

    visited.add(currentUrl);
    const document = await fetchDocument(currentUrl, options);
    const pageLinks = dedupeLinks(
      collectLinksFromDocument(document.$, options.productDiscovery.selectors)
        .map((link) => normalizeLink(link, document.url))
        .filter(Boolean)
        .filter((link) => isSameDomain(link.url, currentUrl))
        .map((link) => ({ ...link, score: scoreProductUrl(link.url) }))
        .filter((link) => link.score >= 3)
        .sort((left, right) => right.score - left.score),
    );

    for (const link of pageLinks) {
      if (!collected.some((entry) => entry.url === link.url)) {
        collected.push(link);
      }
    }

    if (collected.length >= options.productsPerCategory) {
      break;
    }

    currentUrl = extractNextPageUrlFromDocument(document.$, document.url, options.pagination.selectors);
  }

  if (!collected.length) {
    warnings.push(`No se detectaron productos en la categoria ${category.url}`);
  }

  return collected.map((link) => link.url);
}

export async function extractProductData(_page, productUrl, category, options, warnings) {
  const document = await fetchDocument(productUrl, options);
  const extraction = extractProductFields(document.$, document.url, options.productExtraction);
  const normalized = normalizeExtractedProduct(extraction, document.url, category, options);

  if (!normalized.price) {
    warnings.push(`No se pudo extraer precio de ${productUrl}`);
  }

  return normalized;
}

async function fetchDocument(url, options) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (Catalog Scraper HTTP Transport)" },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  return {
    url: response.url,
    html,
    $: load(html),
  };
}

function collectLinksFromDocument($, selectors) {
  const links = [];
  const used = new Set();

  for (const selector of selectors) {
    $(selector).each((_, element) => {
      const href = $(element).attr("href");
      const text = normalizeWhitespace($(element).text() || $(element).attr("aria-label") || "");
      const key = `${href}|${text}`;

      if (!href || used.has(key)) {
        return;
      }

      used.add(key);
      links.push({ href, text });
    });
  }

  if (links.length) {
    return links;
  }

  $("a[href]").each((_, element) => {
    links.push({
      href: $(element).attr("href"),
      text: normalizeWhitespace($(element).text() || $(element).attr("aria-label") || ""),
    });
  });

  return links;
}

function extractNextPageUrlFromDocument($, currentUrl, selectors) {
  for (const selector of selectors) {
    const href = $(selector).first().attr("href");

    if (href) {
      return asAbsoluteUrl(href, currentUrl);
    }
  }

  return "";
}

function extractProductFields($, pageUrl, config) {
  const jsonLd = parseJsonLd($);
  const productNode =
    jsonLd.find((entry) => matchesType(entry, "Product")) ||
    jsonLd.find((entry) => entry.sku || entry.offers || entry.image);
  const breadcrumbNode =
    jsonLd.find((entry) => matchesType(entry, "BreadcrumbList")) || null;
  const breadcrumbTrail = breadcrumbNode?.itemListElement
    ?.map((item) => item?.name || item?.item?.name || item?.item)
    .filter(Boolean);
  const offer = Array.isArray(productNode?.offers) ? productNode.offers[0] : productNode?.offers;
  const canonicalHref = $("link[rel='canonical']").attr("href") || "";

  return {
    name: productNode?.name || queryValues($, config.name)[0] || "",
    description: productNode?.description || queryValues($, config.description)[0] || "",
    sku: productNode?.sku || productNode?.mpn || queryValues($, config.sku)[0] || "",
    brand: productNode?.brand?.name || productNode?.brand || "",
    price: offer?.price || offer?.lowPrice || queryValues($, config.price)[0] || "",
    currency: normalizeCurrency(
      offer?.priceCurrency ||
        queryValues($, config.currency)[0] ||
        inferCurrencyFromPrice(queryValues($, config.price)[0] || ""),
    ),
    images: normalizeImages(productNode?.image || queryValues($, config.images, true)),
    breadcrumbTrail: breadcrumbTrail || collectBreadcrumb($),
    bodyText: $("body").text().slice(0, 15000),
    title: $("title").text().trim() || "",
    canonicalUrl: asAbsoluteUrl(canonicalHref, pageUrl) || "",
    hasJsonLdProduct: Boolean(productNode),
  };
}

function queryValues($, candidates = [], multiple = false) {
  for (const candidate of candidates) {
    const [selector, attribute] = candidate.split("@");
    const values = [];

    $(selector).each((_, element) => {
      const rawValue = attribute ? $(element).attr(attribute) : $(element).text();
      const value = normalizeWhitespace(rawValue || "");

      if (!value) {
        return;
      }

      values.push(value);
    });

    if (!values.length) {
      continue;
    }

    if (!multiple) {
      return [values[0]];
    }

    return Array.from(new Set(values));
  }

  return [];
}

function parseJsonLd($) {
  const entries = [];

  $("script[type='application/ld+json']").each((_, element) => {
    try {
      entries.push(JSON.parse($(element).text() || "null"));
    } catch {
      // Ignore invalid JSON-LD entries.
    }
  });

  return entries.flatMap(flattenJsonLd);
}

function flattenJsonLd(entry) {
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
}

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
    .filter(Boolean)
    .filter(isLikelyProductImage);
}

function collectBreadcrumb($) {
  const breadcrumbSelectors = [
    ".breadCrumbs a",
    "nav[aria-label*='breadcrumb'] a",
    "nav[aria-label*='Breadcrumb'] a",
    ".breadcrumb a",
  ];

  for (const selector of breadcrumbSelectors) {
    const items = $(selector)
      .map((_, element) => normalizeWhitespace($(element).text()))
      .get()
      .filter(Boolean);

    if (items.length) {
      return items;
    }
  }

  return [];
}

function isLikelyProductImage(value) {
  const normalized = String(value || "").toLowerCase();

  if (!normalized) {
    return false;
  }

  const excludedTokens = [
    "/assets/layout/",
    "/images/site/",
    "/app_themes/",
    "processing.gif",
    "icon_search",
    "icon_account",
    "icon_basket",
    "heart.png",
    "nav-arrow",
  ];

  return !excludedTokens.some((token) => normalized.includes(token));
}

function normalizeCurrency(value) {
  const normalized = normalizeWhitespace(value).toUpperCase();

  if (!normalized) {
    return "";
  }

  const directMap = new Map([
    ["€", "EUR"],
    ["EUR", "EUR"],
    ["EURO", "EUR"],
    ["1", "EUR"],
    ["£", "GBP"],
    ["GBP", "GBP"],
    ["GREAT BRITISH POUND", "GBP"],
    ["2", "GBP"],
    ["$", "USD"],
    ["USD", "USD"],
    ["DOLLAR", "USD"],
  ]);

  if (directMap.has(normalized)) {
    return directMap.get(normalized);
  }

  if (normalized.includes("EURO")) {
    return "EUR";
  }

  if (normalized.includes("POUND")) {
    return "GBP";
  }

  if (normalized.includes("DOLLAR")) {
    return "USD";
  }

  return normalized;
}

function inferCurrencyFromPrice(value) {
  const normalized = String(value || "");

  if (normalized.includes("€")) {
    return "EUR";
  }

  if (normalized.includes("£")) {
    return "GBP";
  }

  if (normalized.includes("$")) {
    return "USD";
  }

  return "";
}
