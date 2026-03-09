export function detectPlatformHint(samplePages = []) {
  const urls = samplePages.flatMap((page) => [
    page.url,
    ...(page.topProductUrls || []),
    ...(page.topCategoryUrls || []),
  ]);
  const tokens = samplePages.flatMap((page) => page.signals?.platformTokens || []);
  const haystack = [...urls, ...tokens].join(" ");

  if (/cdn\.shopify\.com|shopify-section|\/products\/|\/collections\//i.test(haystack)) {
    return {
      hint: "shopify",
      confidence: 0.9,
      reasons: ["Se detectaron rutas o assets tipicos de Shopify."],
    };
  }

  if (/demandware|dwvar_|cgid=|[?&]pid=|on\/demandware\.store/i.test(haystack)) {
    return {
      hint: "sfcc",
      confidence: 0.9,
      reasons: ["Se detectaron senales tipicas de SFCC."],
    };
  }

  if (/magento|mage\/|pricebox|catalog\/product/i.test(haystack)) {
    return {
      hint: "magento",
      confidence: 0.85,
      reasons: ["Se detectaron senales tipicas de Magento/Adobe Commerce."],
    };
  }

  if (
    /aspnet-viewstate|aspnet-webforms/i.test(haystack) ||
    samplePages.some((page) =>
      [page.url, ...(page.topProductUrls || []), ...(page.topCategoryUrls || [])].some((value) =>
        /-(?:[a-z0-9-]+-)?[cp]\d+\.aspx(?:$|[?#])/i.test(value),
      ),
    )
  ) {
    return {
      hint: "legacy-aspnet-store",
      confidence: 0.88,
      reasons: ["Se detectaron senales de ASP.NET Web Forms y patrones legacy ASPX."],
    };
  }

  return {
    hint: "generic",
    confidence: 0.45,
    reasons: ["No se detecto una plataforma conocida con suficiente confianza."],
  };
}
