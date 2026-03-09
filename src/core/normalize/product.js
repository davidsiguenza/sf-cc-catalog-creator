import { normalizeLookupValue, normalizeWhitespace, slugify, stripHtmlTags } from "../../utils/text.js";
import { asAbsoluteUrl, cleanUrl, getDomainSlug, isHttpUrl, toOrigin } from "../../utils/url.js";
import { createCanonicalProduct } from "../models/product.js";

export function normalizeExtractedProduct(extraction, productUrl, category, options) {
  const breadcrumb = normalizeBreadcrumb(extraction.breadcrumbTrail, category.path);
  const urlDerivedTrail = deriveCategoryPathFromUrl(productUrl);
  const categoryPath =
    urlDerivedTrail.length >= 2 ? urlDerivedTrail : breadcrumb.length ? breadcrumb : category.path;
  const allImages = (extraction.images || [])
    .map((image) => asAbsoluteUrl(image, productUrl))
    .filter(Boolean)
    .filter(isHttpUrl);

  const price = parsePrice(extraction.price);
  const normalizedDescription = normalizeWhitespace(stripHtmlTags(extraction.description || ""));
  const normalizedSku = normalizeSku(extraction.sku, extraction.bodyText || "", productUrl);
  const productId = slugify(normalizedSku || extraction.name || productUrl) || getDomainSlug(productUrl);
  const categoryPathValue = categoryPath.join(" > ");
  const hasJsonLdProduct = Boolean(extraction.hasJsonLdProduct);

  return createCanonicalProduct({
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
    categoryPath: categoryPathValue,
    categoryTrail: categoryPath,
    allCategoryPaths: categoryPathValue ? [categoryPathValue] : [],
    imageUrls: allImages,
    sourceSite: toOrigin(productUrl),
    sourceType: hasJsonLdProduct ? "jsonld+dom" : "dom",
    sourceConfidence: hasJsonLdProduct ? 0.8 : 0.55,
    rawSignals: {
      jsonld: hasJsonLdProduct,
      dom: true,
      network: false,
    },
  });
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

function formatCategoryLabel(value) {
  const normalized = String(value || "")
    .replace(/-([cp])\d+(?=\.[a-z0-9]+$)/gi, "")
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/\b(cgid|pid)\b.*$/i, "")
    .trim();

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
