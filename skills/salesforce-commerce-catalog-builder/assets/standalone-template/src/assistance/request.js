export function buildScrapeAssistanceRequest(options, scrapeResult) {
  const reasons = [];
  const requestedInputs = [];
  const validationSummary = scrapeResult.validation?.summary || {};

  if (!scrapeResult.summary.categoriesProcessed) {
    reasons.push("No se detectaron categorias o PLPs navegables.");
    pushInput(
      requestedInputs,
      "plp_url",
      "PLP URL",
      true,
      "Pasa una o varias PLPs representativas del catalogo.",
      { multiple: true },
    );
    pushInput(requestedInputs, "home_url", "Home URL", false, "Ayuda a explorar la navegacion principal.");
  }

  if (!scrapeResult.summary.productsExtracted) {
    reasons.push("No se extrajeron productos desde las categorias detectadas.");
    pushInput(
      requestedInputs,
      "plp_url",
      "PLP URL",
      true,
      "Pasa una o varias PLPs donde se vean cards de producto reales.",
      { multiple: true },
    );
    pushInput(requestedInputs, "pdp_url", "PDP URL", true, "Pasa una PDP valida para ajustar titulo, precio e imagen.");
  }

  if (validationSummary.priceCoverage > 0 && validationSummary.priceCoverage < 0.8) {
    reasons.push(`La cobertura de precio es baja (${formatCoverage(validationSummary.priceCoverage)}).`);
    pushInput(requestedInputs, "pdp_url", "PDP URL", true, "Hace falta una PDP para ajustar la extraccion de precio.");
  }

  if (validationSummary.imageCoverage > 0 && validationSummary.imageCoverage < 0.8) {
    reasons.push(`La cobertura de imagen es baja (${formatCoverage(validationSummary.imageCoverage)}).`);
    pushInput(requestedInputs, "pdp_url", "PDP URL", true, "Hace falta una PDP para ajustar la extraccion de imagen.");
  }

  if (validationSummary.categoryCoverage > 0 && validationSummary.categoryCoverage < 0.8) {
    reasons.push(`La cobertura de categorias es baja (${formatCoverage(validationSummary.categoryCoverage)}).`);
    pushInput(
      requestedInputs,
      "plp_url",
      "PLP URL",
      true,
      "Hace falta una o varias PLPs para fijar mejor la categoria de descubrimiento.",
      { multiple: true },
    );
  }

  if (!reasons.length && shouldSuggestAdditionalPlp(options, scrapeResult)) {
    const categoryCount = countDistinctExtractedCategories(scrapeResult);
    reasons.push(
      `La muestra actual cubre solo ${categoryCount} ${pluralize("categoria distinta", "categorias distintas", categoryCount)}.`,
    );
    pushInput(
      requestedInputs,
      "additional_plp_url",
      "Otra PLP URL",
      false,
      "Si quieres ampliar el catalogo con mas productos y categorias, añade otra PLP.",
      { multiple: true },
    );
  }

  if (!reasons.length) {
    return emptyAssistanceRequest();
  }

  return {
    status: "needs_user_input",
    severity:
      !scrapeResult.summary.categoriesProcessed || !scrapeResult.summary.productsExtracted ? "blocking" : "advisory",
    reasons,
    requestedInputs,
    message: buildScrapeMessage(scrapeResult, requestedInputs),
    suggestedCommand: shouldSuggestScrapeRetry(requestedInputs)
      ? buildScrapeRetryCommand(options, requestedInputs)
      : buildProfileCommand(options, requestedInputs),
  };
}

export function buildProfileAssistanceRequest(options, profileResult) {
  const reasons = [];
  const requestedInputs = [];
  const samplePages = profileResult.samplePages || [];
  const hasPlp = samplePages.some((page) => page.detectedType === "plp");
  const hasPdp = samplePages.some((page) => page.detectedType === "pdp");

  if (!hasPlp) {
    reasons.push("No se ha identificado una PLP fiable durante el perfilado.");
    pushInput(requestedInputs, "plp_url", "PLP URL", true, "Pasa una PLP representativa del catalogo.");
  }

  if (!hasPdp) {
    reasons.push("No se ha identificado una PDP fiable durante el perfilado.");
    pushInput(requestedInputs, "pdp_url", "PDP URL", true, "Pasa una PDP con nombre, precio e imagen.");
  }

  if (profileResult.profile.platformHint === "generic" && profileResult.profile.confidence < 0.7) {
    reasons.push(`La confianza del perfil es baja (${Math.round(profileResult.profile.confidence * 100)}%).`);
    pushInput(requestedInputs, "search_url", "Search URL", false, "Una busqueda real ayuda a entender filtros y listados.");
  }

  if (!reasons.length) {
    return emptyAssistanceRequest();
  }

  return {
    status: "needs_user_input",
    severity: !hasPlp || !hasPdp ? "blocking" : "advisory",
    reasons,
    requestedInputs,
    message:
      "El perfil automatico no tiene suficiente contexto. Pasa una PLP y una PDP reales para consolidar el perfil del sitio.",
    suggestedCommand: buildProfileCommand(options, requestedInputs),
  };
}

function emptyAssistanceRequest() {
  return {
    status: "not_needed",
    severity: "none",
    reasons: [],
    requestedInputs: [],
    message: "",
    suggestedCommand: "",
  };
}

function pushInput(target, id, label, required, reason, extra = {}) {
  if (target.some((entry) => entry.id === id)) {
    return;
  }

  target.push({ id, label, required, reason, ...extra });
}

function buildScrapeMessage(scrapeResult, requestedInputs) {
  if (!scrapeResult.summary.categoriesProcessed) {
    return "No he encontrado PLPs fiables. Para seguir, necesito al menos una URL de categoria o listado.";
  }

  if (!scrapeResult.summary.productsExtracted) {
    return "He llegado a categorias, pero no a productos validos. Necesito una PLP y una PDP reales para ajustar la extraccion.";
  }

  if (requestedInputs.some((input) => input.id === "additional_plp_url")) {
    return "La extraccion funciona, pero la muestra cubre pocas categorias. Si quieres ampliar el catalogo, añade otra PLP.";
  }

  return "La extraccion funciona, pero la calidad no es suficiente. Necesito una muestra real del sitio para ajustar el perfil.";
}

function buildProfileCommand(options, requestedInputs) {
  const command = ["npm start -- profile-site", `--url ${options.entryUrl}`];

  for (const input of requestedInputs) {
    const flag = INPUT_TO_FLAG[input.id];

    if (flag) {
      command.push(`${flag} <${input.id.toUpperCase()}>`);
    }
  }

  return command.join(" ");
}

function buildScrapeRetryCommand(options, requestedInputs) {
  const command = ["npm start -- scrape", `--url ${options.entryUrl}`];

  for (const categoryUrl of options.categoryUrls || []) {
    command.push(`--category-url ${categoryUrl}`);
  }

  for (const input of requestedInputs) {
    if (input.id === "additional_plp_url") {
      command.push("--category-url <OTRA_PLP_URL>");
    }
  }

  return command.join(" ");
}

function shouldSuggestScrapeRetry(requestedInputs) {
  return requestedInputs.length === 1 && requestedInputs[0].id === "additional_plp_url";
}

function shouldSuggestAdditionalPlp(options, scrapeResult) {
  if (!options.categoryUrls?.length) {
    return false;
  }

  if (!scrapeResult.summary.productsExtracted) {
    return false;
  }

  return countDistinctExtractedCategories(scrapeResult) < 2;
}

function countDistinctExtractedCategories(scrapeResult) {
  const categories = new Set();

  for (const product of scrapeResult.products || []) {
    const candidates = [
      product.categoryPath,
      ...((Array.isArray(product.allCategoryPaths) ? product.allCategoryPaths : [])),
    ];

    for (const candidate of candidates) {
      const normalized = String(candidate || "").trim();

      if (normalized) {
        categories.add(normalized);
      }
    }
  }

  return categories.size;
}

function formatCoverage(value) {
  return `${Math.round(value * 100)}%`;
}

function pluralize(singular, plural, count) {
  return count === 1 ? singular : plural;
}

const INPUT_TO_FLAG = {
  home_url: "--home-url",
  plp_url: "--plp-url",
  search_url: "--search-url",
  pdp_url: "--pdp-url",
};
