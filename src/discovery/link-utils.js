import { normalizeLookupValue, normalizeWhitespace } from "../utils/text.js";
import { asAbsoluteUrl, cleanUrl } from "../utils/url.js";

export function normalizeLink(link, baseUrl) {
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

export function dedupeLinks(links) {
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

export function dedupeCategoryTargets(categories) {
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

export function slugFromUrl(url) {
  const pathname = new URL(url).pathname.split("/").filter(Boolean);
  return pathname.at(-1) || "category";
}

export function deriveCategoryPathFromUrl(url) {
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

export function formatCategoryLabel(value) {
  const normalized = String(value || "")
    .replace(/-([cp])\d+(?=\.[a-z0-9]+$)/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z0-9]+$/i, "")
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

function isCategoryPathSegment(value) {
  return /^(hombre|mujer|men|women|unisex|ropa|zapatos|bags-accessories|bolsos-accesorios|accessories)$/i.test(
    value,
  );
}
