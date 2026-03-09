import { detectPlatformHint } from "../platforms/detector.js";
import {
  DEFAULT_CATEGORY_DISCOVERY,
  DEFAULT_PAGINATION,
  DEFAULT_PRODUCT_DISCOVERY,
} from "./defaults.js";

export function buildSiteProfile({ entryUrl, samplePages }) {
  const detector = detectPlatformHint(samplePages);
  const domain = new URL(entryUrl).hostname.replace(/^www\./, "");
  const urlPatterns = inferUrlPatterns(samplePages);
  const confidence = calculateProfileConfidence(samplePages, detector, urlPatterns);
  const learningCandidates = buildLearningCandidates(detector, samplePages, urlPatterns);

  return {
    schemaVersion: 1,
    domain,
    entryUrl,
    platformHint: detector.hint,
    platformConfidence: detector.confidence,
    sampleUrls: Object.fromEntries(samplePages.map((page) => [page.typeRequested, page.url])),
    urlPatterns,
    categoryDiscovery: {
      selectors: dedupeStrings([
        ...buildCategorySelectors(detector.hint),
        ...DEFAULT_CATEGORY_DISCOVERY.selectors,
      ]),
      includePatterns: dedupeStrings([
        ...DEFAULT_CATEGORY_DISCOVERY.includePatterns,
        ...urlPatterns.category,
      ]),
      excludePatterns: DEFAULT_CATEGORY_DISCOVERY.excludePatterns,
    },
    productDiscovery: {
      selectors: dedupeStrings([
        ...buildProductSelectors(detector.hint),
        ...DEFAULT_PRODUCT_DISCOVERY.selectors,
      ]),
    },
    pagination: {
      selectors: DEFAULT_PAGINATION.selectors,
    },
    preferredSources: inferPreferredSources(samplePages),
    confidence,
    recommendations: [
      ...detector.reasons,
      ...(learningCandidates.length
        ? ["Se detectaron patrones candidatos para convertir en logica reusable futura."]
        : []),
    ],
    learningCandidates,
  };
}

function inferUrlPatterns(samplePages) {
  const urls = samplePages.flatMap((page) => [
    page.url,
    ...(page.topProductUrls || []),
    ...(page.topCategoryUrls || []),
  ]);

  const patterns = {
    category: [],
    product: [],
  };

  if (urls.some((url) => /-c\d+\.aspx(?:$|[?#])/i.test(url))) {
    patterns.category.push("-C\\d+\\.aspx$");
  }

  if (urls.some((url) => /-p\d+\.aspx(?:$|[?#])/i.test(url))) {
    patterns.product.push("-P\\d+\\.aspx$");
  }

  if (urls.some((url) => /\/collections\//i.test(url))) {
    patterns.category.push("/collections/");
  }

  if (urls.some((url) => /\/products\//i.test(url))) {
    patterns.product.push("/products/");
  }

  if (urls.some((url) => /[?&]cgid=/i.test(url))) {
    patterns.category.push("cgid=");
  }

  if (urls.some((url) => /[?&]pid=/i.test(url))) {
    patterns.product.push("pid=");
  }

  if (urls.some((url) => /\/c\//i.test(url))) {
    patterns.category.push("/c/");
  }

  if (urls.some((url) => /\/p\//i.test(url))) {
    patterns.product.push("/p/");
  }

  return patterns;
}

function buildCategorySelectors(platformHint) {
  if (platformHint === "legacy-aspnet-store") {
    return ["a[href*='-C']", "#accordion a[href]"];
  }

  return [];
}

function buildProductSelectors(platformHint) {
  if (platformHint === "legacy-aspnet-store") {
    return ["a[href*='-P']", ".productItemDisplay a[href]"];
  }

  if (platformHint === "shopify") {
    return ["a[href*='/products/']"];
  }

  if (platformHint === "sfcc") {
    return ["a[href*='pid=']", "a[href*='/p/']"];
  }

  if (platformHint === "magento") {
    return [".product-item-link[href]", "a[href$='.html']"];
  }

  return [];
}

function inferPreferredSources(samplePages) {
  if (samplePages.some((page) => page.signals?.hasJsonLdProduct)) {
    return ["jsonld", "dom"];
  }

  return ["dom"];
}

function calculateProfileConfidence(samplePages, detector, urlPatterns) {
  let score = detector.confidence * 0.6;

  const typedSamples = samplePages.filter((page) => page.typeRequested !== "home");
  const typeMatches = typedSamples.filter((page) => page.detectedType === page.typeRequested).length;
  const typeScore = typedSamples.length ? typeMatches / typedSamples.length : 0.5;
  score += typeScore * 0.2;

  const urlSignalCount = urlPatterns.category.length + urlPatterns.product.length;
  score += Math.min(0.2, urlSignalCount * 0.05);

  return Number(Math.max(0, Math.min(1, score)).toFixed(2));
}

function buildLearningCandidates(detector, samplePages, urlPatterns) {
  const candidates = [];

  if (detector.hint === "generic" && samplePages.some((page) => page.productCandidateCount || page.categoryCandidateCount)) {
    candidates.push({
      type: "platform-logic-candidate",
      confidence: 0.65,
      message:
        "La web tiene senales utiles, pero no encaja con una logica conocida. Conviene revisar si este patron merece una estrategia reusable.",
    });
  }

  if (detector.hint === "generic" && urlPatterns.product.length) {
    candidates.push({
      type: "product-pattern-candidate",
      confidence: 0.7,
      pattern: urlPatterns.product[0],
      message: `Patron de producto detectado sin plataforma conocida: ${urlPatterns.product[0]}.`,
    });
  }

  if (detector.hint === "generic" && urlPatterns.category.length) {
    candidates.push({
      type: "category-pattern-candidate",
      confidence: 0.7,
      pattern: urlPatterns.category[0],
      message: `Patron de categoria detectado sin plataforma conocida: ${urlPatterns.category[0]}.`,
    });
  }

  return candidates;
}

function dedupeStrings(values) {
  return Array.from(new Set(values.filter(Boolean)));
}
