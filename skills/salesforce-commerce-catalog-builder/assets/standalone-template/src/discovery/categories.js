import { gotoPage, collectLinks } from "../browser/navigation.js";
import { normalizeLookupValue } from "../utils/text.js";
import { cleanUrl, isSameDomain, toOrigin } from "../utils/url.js";
import {
  dedupeCategoryTargets,
  dedupeLinks,
  deriveCategoryPathFromUrl,
  formatCategoryLabel,
  normalizeLink,
  slugFromUrl,
} from "./link-utils.js";
import { isCategoryCandidate, looksLikeProductUrl, scoreCategoryCandidate } from "./url-scoring.js";

export async function discoverCategories(page, entryUrl, options, warnings) {
  await gotoPage(page, entryUrl, options);

  const rawLinks = await collectLinks(page, options.categoryDiscovery.selectors);
  const unique = dedupeLinks(
    rawLinks
      .map((link) => normalizeLink(link, entryUrl))
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
