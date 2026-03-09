import { gotoPage } from "../browser/navigation.js";
import { normalizeExtractedProduct } from "../core/normalize/product.js";

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
      hasJsonLdProduct: Boolean(productNode),
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
