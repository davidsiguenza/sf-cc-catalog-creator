import { collectLinks, extractNextPageUrl, gotoPage } from "../browser/navigation.js";
import { isSameDomain } from "../utils/url.js";
import { dedupeLinks, normalizeLink } from "../discovery/link-utils.js";
import { scoreProductUrl } from "../discovery/url-scoring.js";

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

    currentUrl = await extractNextPageUrl(page, currentUrl, options.pagination.selectors);
  }

  if (!collected.length) {
    warnings.push(`No se detectaron productos en la categoria ${category.url}`);
  }

  return collected.map((link) => link.url);
}
