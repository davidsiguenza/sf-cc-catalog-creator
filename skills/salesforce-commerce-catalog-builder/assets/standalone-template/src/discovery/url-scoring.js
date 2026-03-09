import { normalizeLookupValue } from "../utils/text.js";

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

export function scoreProductUrl(url) {
  if (!url) {
    return 0;
  }

  let score = 0;

  if (/\/p\/|\/product\/|\/products\/|\/producto(?:\/|\?|$)/i.test(url)) {
    score += 5;
  }

  if (/[?&](pid|sku|option)=/i.test(url)) {
    score += 5;
  }

  if (/-p\d+(?:\.aspx)?(?:$|[?#])/i.test(url)) {
    score += 4;
  }

  if (/\/(cart|checkout|wishlist|login|account|search)(?:[/?#]|$)/i.test(url)) {
    score -= 6;
  }

  return score;
}

export function looksLikeProductUrl(url) {
  return scoreProductUrl(url) >= 3;
}

export function scoreCategoryCandidate(link, options) {
  const text = normalizeLookupValue(link.text);

  if (!text || GENERIC_EXCLUDED_LINK_TEXT.has(text)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (text.length < 2 || text.length > 60) {
    return Number.NEGATIVE_INFINITY;
  }

  const { includePatterns, excludePatterns } = options.categoryDiscovery;

  if (excludePatterns.some((pattern) => link.url.includes(pattern))) {
    return Number.NEGATIVE_INFINITY;
  }

  let score = 0;

  if (includePatterns.some((pattern) => link.url.includes(pattern))) {
    score += 5;
  }

  if (/-c\d+\.aspx(?:$|[?#])/i.test(link.url)) {
    score += 5;
  }

  if (
    /shop|category|department|collection|women|men|mujer|hombre|ropa|zapatos|bags|accessories|kids|new|sale|apparel|electronics|office|drinkware|leisure|gift|stationery|travel|chargers|cables|sustainable|slack|agentforce|mulesoft|heritage|volunteer/i.test(
      `${link.url} ${link.text}`,
    )
  ) {
    score += 3;
  }

  if (looksLikeProductUrl(link.url)) {
    score -= 5;
  }

  return score;
}

export function isCategoryCandidate(link, options) {
  return scoreCategoryCandidate(link, options) >= 3;
}
