import path from "node:path";

import { chromium } from "playwright";

import { buildProfileAssistanceRequest } from "./assistance/request.js";
import { gotoPage, collectLinks } from "./browser/navigation.js";
import { normalizeLink, dedupeLinks } from "./discovery/link-utils.js";
import { scoreCategoryCandidate, scoreProductUrl } from "./discovery/url-scoring.js";
import { buildSiteProfile } from "./site-profiles/schema.js";
import { resolveSiteProfilePath } from "./site-profiles/loader.js";
import {
  DEFAULT_CATEGORY_DISCOVERY,
  DEFAULT_PRODUCT_DISCOVERY,
} from "./site-profiles/defaults.js";
import { ensureDir, writeJsonFile } from "./utils/fs.js";
import { getDomainSlug, isSameDomain } from "./utils/url.js";

export async function profileSite(options) {
  if (options.profileTransport === "fetch") {
    return profileSiteViaFetch(options);
  }

  const browser = await chromium.launch({ headless: options.headless });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  });

  const sampleQueue = buildSampleQueue(options);
  const samplePages = [];

  try {
    for (let index = 0; index < sampleQueue.length; index += 1) {
      const sample = sampleQueue[index];

      if (samplePages.some((page) => page.url === sample.url)) {
        continue;
      }

      const page = await context.newPage();

      try {
        const inspected = await inspectSamplePage(page, sample, options);
        samplePages.push(inspected);
        enqueueAutoSamples(sampleQueue, samplePages, inspected);
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const profile = buildSiteProfile({
    entryUrl: options.entryUrl,
    samplePages,
  });
  const assistance = buildProfileAssistanceRequest(options, { profile, samplePages });
  const storeSlug = options.storeSlug || getDomainSlug(options.entryUrl);
  const outputDir = path.resolve(options.outputDir, storeSlug);
  const summaryPath = path.join(outputDir, "profile-summary.json");
  const profilePath = resolveSiteProfilePath(options.entryUrl, options.profilesDir);

  await ensureDir(outputDir);
  await writeJsonFile(summaryPath, {
    profiledAt: new Date().toISOString(),
    entryUrl: options.entryUrl,
    samplePages,
    profile,
    assistance,
  });
  await writeJsonFile(profilePath, profile);

  return {
    assistance,
    profile,
    samplePages,
    summaryPath,
    profilePath,
  };
}

async function profileSiteViaFetch(options) {
  const sampleQueue = buildSampleQueue(options);
  const samplePages = [];

  for (let index = 0; index < sampleQueue.length; index += 1) {
    const sample = sampleQueue[index];

    if (samplePages.some((page) => page.url === sample.url)) {
      continue;
    }

    const inspected = await inspectSamplePageViaFetch(sample, options);
    const finalized = finalizeInspection(sample, inspected);
    samplePages.push(finalized);
    enqueueAutoSamples(sampleQueue, samplePages, finalized);
  }

  const profile = buildSiteProfile({
    entryUrl: options.entryUrl,
    samplePages,
  });
  const assistance = buildProfileAssistanceRequest(options, { profile, samplePages });
  const storeSlug = options.storeSlug || getDomainSlug(options.entryUrl);
  const outputDir = path.resolve(options.outputDir, storeSlug);
  const summaryPath = path.join(outputDir, "profile-summary.json");
  const profilePath = resolveSiteProfilePath(options.entryUrl, options.profilesDir);

  await ensureDir(outputDir);
  await writeJsonFile(summaryPath, {
    profiledAt: new Date().toISOString(),
    entryUrl: options.entryUrl,
    samplePages,
    profile,
    assistance,
  });
  await writeJsonFile(profilePath, profile);

  return {
    assistance,
    profile,
    samplePages,
    summaryPath,
    profilePath,
  };
}

function buildSampleQueue(options) {
  const queue = [];

  pushSample(queue, "home", options.homeUrl || options.entryUrl, "input");
  pushSample(queue, "plp", options.plpUrl, "input");
  pushSample(queue, "search", options.searchUrl, "input");
  pushSample(queue, "pdp", options.pdpUrl, "input");

  return queue;
}

function pushSample(queue, type, url, source) {
  if (!url || queue.some((sample) => sample.url === url || sample.type === type)) {
    return;
  }

  queue.push({ type, url, source });
}

async function inspectSamplePage(page, sample, options) {
  try {
    const browserOptions = {
      ...options,
      timeoutMs: Math.min(options.timeoutMs, 8000),
    };
    await gotoPage(page, sample.url, browserOptions);

    const rawLinks = await collectLinks(page, ["a[href]"]);
    const normalizedLinks = rawLinks
      .map((link) => normalizeLink(link, sample.url))
      .filter(Boolean)
      .filter((link) => isSameDomain(link.url, options.entryUrl));
    const categoryDiscoveryOptions = { categoryDiscovery: DEFAULT_CATEGORY_DISCOVERY };

    const topCategoryLinks = dedupeLinks(
      normalizedLinks
        .map((link) => ({ ...link, score: scoreCategoryCandidate(link, categoryDiscoveryOptions) }))
        .filter((link) => link.score >= 3)
        .sort((left, right) => right.score - left.score),
    ).slice(0, 8);
    const topProductLinks = dedupeLinks(
      normalizedLinks
        .map((link) => ({ ...link, score: scoreProductUrl(link.url) }))
        .filter((link) => link.score >= 3)
        .sort((left, right) => right.score - left.score),
    ).slice(0, 8);
    const signals = await page.evaluate(() => {
      const html = document.documentElement.innerHTML;
      const hasJsonLdProduct =
        html.includes('"@type":"Product"') ||
        html.includes('"@type": "Product"') ||
        html.includes('"@type":"["Product"]');

      return {
        hasSearchInput: Boolean(
          document.querySelector("input[type='search'], input[name*='search' i], input[name='q' i]"),
        ),
        hasJsonLdProduct,
        hasAddToCart: Boolean(
          document.querySelector(
            "button[id*='add' i], button[class*='add' i], input[value*='add to cart' i], [data-add-to-cart]",
          ),
        ),
        hasPriceNodes: Boolean(
          document.querySelector("[itemprop='price'], .price, .product-price, [data-price-amount]"),
        ),
        hasPagination: Boolean(document.querySelector("a[rel='next'], .pagination, .pager, .next a")),
        platformTokens: [
          html.includes("cdn.shopify.com") ? "shopify-cdn" : "",
          html.includes("shopify-section") ? "shopify-section" : "",
          html.includes("demandware") ? "demandware" : "",
          html.includes("dwvar_") ? "dwvar_" : "",
          html.includes("__VIEWSTATE") ? "aspnet-viewstate" : "",
          html.includes("WebForm_DoPostBackWithOptions") ? "aspnet-webforms" : "",
          html.includes("data-role=\"priceBox\"") ? "magento-pricebox" : "",
          html.includes("mage/") ? "magento-mage" : "",
        ].filter(Boolean),
      };
    });

    return finalizeInspection(sample, {
      url: page.url(),
      title: await page.title(),
      topCategoryLinks,
      topProductLinks,
      signals,
      transport: "playwright",
    });
  } catch (error) {
    const fallbackInspection = await inspectSamplePageViaFetch(sample, options, error);
    return finalizeInspection(sample, fallbackInspection);
  }
}

async function inspectSamplePageViaFetch(sample, options, originalError) {
  const response = await fetch(sample.url, {
    headers: { "user-agent": "Mozilla/5.0 (Codex Profiler)" },
    signal: AbortSignal.timeout(options.timeoutMs),
    redirect: "follow",
  });

  if (!response.ok) {
    throw new Error(`Fallback fetch fallo para ${sample.url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const normalizedLinks = extractLinksFromHtml(html, response.url)
    .map((link) => normalizeLink(link, response.url))
    .filter(Boolean)
    .filter((link) => isSameDomain(link.url, options.entryUrl));
  const categoryDiscoveryOptions = { categoryDiscovery: DEFAULT_CATEGORY_DISCOVERY };
  const topCategoryLinks = dedupeLinks(
    normalizedLinks
      .map((link) => ({ ...link, score: scoreCategoryCandidate(link, categoryDiscoveryOptions) }))
      .filter((link) => link.score >= 3)
      .sort((left, right) => right.score - left.score),
  ).slice(0, 8);
  const topProductLinks = dedupeLinks(
    normalizedLinks
      .map((link) => ({ ...link, score: scoreProductUrl(link.url) }))
      .filter((link) => link.score >= 3)
      .sort((left, right) => right.score - left.score),
  ).slice(0, 8);

  return {
    url: response.url,
    title: extractTitleFromHtml(html),
    topCategoryLinks,
    topProductLinks,
    signals: extractSignalsFromHtml(html),
    transport: "fetch-fallback",
    fallbackReason: originalError?.message || "Playwright navigation failed.",
  };
}

function finalizeInspection(sample, inspection) {
  const detectedType = inferPageType(sample, {
    url: inspection.url,
    signals: inspection.signals,
    topCategoryLinks: inspection.topCategoryLinks,
    topProductLinks: inspection.topProductLinks,
  });

  return {
    typeRequested: sample.type,
    detectedType,
    source: sample.source,
    transport: inspection.transport,
    fallbackReason: inspection.fallbackReason || "",
    url: inspection.url,
    title: inspection.title,
    categoryCandidateCount: inspection.topCategoryLinks.length,
    productCandidateCount: inspection.topProductLinks.length,
    topCategoryUrls: inspection.topCategoryLinks.map((link) => link.url),
    topProductUrls: inspection.topProductLinks.map((link) => link.url),
    signals: inspection.signals,
  };
}

export function inferPageType(sample, inspection) {
  const hasProductSchema = inspection.signals.hasJsonLdProduct;
  const hasPurchaseSignals = inspection.signals.hasAddToCart && inspection.signals.hasPriceNodes;
  const hasStrongPlpSignals =
    inspection.productCandidateCount >= 6 || (sample.type === "plp" && inspection.productCandidateCount >= 3);

  if (sample.type === "search" || /search/i.test(inspection.url)) {
    return "search";
  }

  if (sample.type === "pdp" && (hasProductSchema || hasPurchaseSignals)) {
    return "pdp";
  }

  // SFCC PLPs often expose quick-view CTAs and prices inside product cards.
  // When the user explicitly marked the page as PLP, or the page exposes many product links,
  // that listing signal should win over add-to-cart noise.
  if (hasStrongPlpSignals) {
    return "plp";
  }

  if (hasProductSchema || hasPurchaseSignals) {
    return "pdp";
  }

  if (sample.type === "home" || inspection.categoryCandidateCount >= 4) {
    return "home";
  }

  return sample.type || "unknown";
}

function enqueueAutoSamples(queue, samplePages, inspected) {
  if (!queue.some((sample) => sample.type === "plp") && inspected.topCategoryUrls[0]) {
    pushSample(queue, "plp", inspected.topCategoryUrls[0], "auto");
  }

  if (!queue.some((sample) => sample.type === "pdp")) {
    const candidateProductUrl =
      inspected.topProductUrls[0] ||
      samplePages.find((page) => page.topProductUrls?.length)?.topProductUrls?.[0];

    if (candidateProductUrl) {
      pushSample(queue, "pdp", candidateProductUrl, "auto");
    }
  }
}

function extractLinksFromHtml(html, baseUrl) {
  const links = [];
  const pattern = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    const [, , href, innerHtml] = match;
    const text = stripHtml(innerHtml);

    links.push({
      href,
      text,
      baseUrl,
    });
  }

  return links;
}

function extractTitleFromHtml(html) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] || "");
}

function extractSignalsFromHtml(html) {
  const normalizedHtml = html.toLowerCase();
  const hasJsonLdProduct =
    normalizedHtml.includes('"@type":"product"') ||
    normalizedHtml.includes('"@type": "product"') ||
    normalizedHtml.includes('"@type":["product"]');

  return {
    hasSearchInput: /input[^>]+type=["']search["']|input[^>]+name=["'][^"']*search/i.test(html),
    hasJsonLdProduct,
    hasAddToCart: /add to cart|addtobasket|data-add-to-cart|buyproductdialog/i.test(html),
    hasPriceNodes: /itemprop=["']price["']|class=["'][^"']*price[^"']*["']|product-price/i.test(html),
    hasPagination: /rel=["']next["']|class=["'][^"']*(pagination|pager|next)[^"']*["']/i.test(html),
    platformTokens: [
      normalizedHtml.includes("cdn.shopify.com") ? "shopify-cdn" : "",
      normalizedHtml.includes("shopify-section") ? "shopify-section" : "",
      normalizedHtml.includes("demandware") ? "demandware" : "",
      normalizedHtml.includes("dwvar_") ? "dwvar_" : "",
      normalizedHtml.includes("__viewstate") ? "aspnet-viewstate" : "",
      normalizedHtml.includes("webform_dopostbackwithoptions") ? "aspnet-webforms" : "",
      normalizedHtml.includes("data-role=\"pricebox\"") ? "magento-pricebox" : "",
      normalizedHtml.includes("mage/") ? "magento-mage" : "",
    ].filter(Boolean),
  };
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}
