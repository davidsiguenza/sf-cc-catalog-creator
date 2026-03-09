import readline from "node:readline/promises";
import process from "node:process";

export async function promptForAssistanceInputs(assistance, options) {
  if (!shouldPromptForAssistance(assistance, options)) {
    return null;
  }

  const outstandingInputs = assistance.requestedInputs.filter((input) => !getExistingValue(options, input.id));

  if (!outstandingInputs.length) {
    return null;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const confirmation = normalizeYesNo(
      await rl.question("\nQuieres aportar ahora esas URLs para reintentar automaticamente? [y/N]: "),
    );

    if (!confirmation) {
      return null;
    }

    const answers = {};

    for (const input of outstandingInputs) {
      const response = (
        await rl.question(buildPromptLabel(input))
      ).trim();

      if (!response) {
        continue;
      }

      const values = parseHttpUrlValues(response);

      if (!values.length) {
        console.log(`- Valor ignorado para ${input.label}: no parece una URL http/https valida.`);
        continue;
      }

      answers[input.id] = input.multiple ? values : values[0];
    }

    const missingRequired = outstandingInputs.filter((input) => input.required && !hasProvidedValue(answers[input.id]));

    if (missingRequired.length) {
      console.log("- No se aportaron todas las URLs obligatorias; no se reintentara automaticamente.");
      return null;
    }

    if (!Object.keys(answers).length) {
      return null;
    }

    return answers;
  } finally {
    rl.close();
  }
}

export function applyAssistanceInputsToParsed(parsed, answers, command) {
  if (!answers) {
    return parsed;
  }

  const next = {
    ...parsed,
  };

  const homeUrls = normalizeAnsweredUrls(answers.home_url);
  const primaryPlpUrls = normalizeAnsweredUrls(answers.plp_url);
  const additionalPlpUrls = normalizeAnsweredUrls(answers.additional_plp_url);
  const searchUrls = normalizeAnsweredUrls(answers.search_url);
  const pdpUrls = normalizeAnsweredUrls(answers.pdp_url);
  const assistedPlpUrls = dedupeUrls([...primaryPlpUrls, ...additionalPlpUrls]);

  if (homeUrls[0]) {
    next.homeUrl = homeUrls[0];
  }

  if (primaryPlpUrls[0]) {
    next.plpUrl = primaryPlpUrls[0];
  }

  if (!next.plpUrl && additionalPlpUrls[0]) {
    next.plpUrl = additionalPlpUrls[0];
  }

  if ((command === "scrape" || command === "profile-site") && assistedPlpUrls.length) {
    next.categoryUrls = dedupeUrls([...(next.categoryUrls || []), ...assistedPlpUrls]);
  }

  if (searchUrls[0]) {
    next.searchUrl = searchUrls[0];
  }

  if (pdpUrls[0]) {
    next.pdpUrl = pdpUrls[0];
  }

  return next;
}

export function hasGuidedSampleUrls(options) {
  return Boolean(options.homeUrl || options.plpUrl || options.searchUrl || options.pdpUrl);
}

export async function promptForAutoScrapeAfterProfile(result, options) {
  if (!shouldOfferAutoScrapeAfterProfile(result, options)) {
    return null;
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const profileValid = isProfileValidForAutomaticSelection(result);
    const confirmation = normalizeYesNo(await rl.question(buildProfileContinuationPrompt(profileValid)));

    if (!confirmation) {
      return null;
    }

    const entryUrl = await promptUrlWithDefault(rl, "URL de la tienda", options.entryUrl);
    const knownPlpUrls = dedupeUrls([...(options.categoryUrls || []), ...(options.plpUrl ? [options.plpUrl] : [])]);
    let categoryUrls = [];
    let maxCategories = options.maxCategories;

    if (profileValid) {
      const categoryMode = await promptCategorySelectionMode(rl);

      if (categoryMode === "select") {
        categoryUrls = await promptUrlListWithDefault(
          rl,
          "Dame un listado de PLPs separadas por comas",
          knownPlpUrls,
        );
      } else {
        maxCategories = await promptPositiveIntegerWithDefault(
          rl,
          "Cuantas categorias quieres procesar",
          options.maxCategories,
        );
      }
    } else {
      categoryUrls = await promptUrlListWithDefault(
        rl,
        "Dame un listado de PLPs separadas por comas",
        knownPlpUrls,
      );
    }

    const productsPerCategory = await promptPositiveIntegerWithDefault(
      rl,
      "Cuantos productos por categoria quieres extraer",
      options.productsPerCategory,
    );

    return {
      entryUrl,
      maxCategories,
      productsPerCategory,
      categoryUrls,
    };
  } finally {
    rl.close();
  }
}

export function applyAutoScrapeAnswersToParsed(parsed, answers) {
  if (!answers) {
    return parsed;
  }

  return {
    ...parsed,
    command: "scrape",
    entryUrl: answers.entryUrl || parsed.entryUrl,
    maxCategories: answers.maxCategories ?? parsed.maxCategories,
    productsPerCategory: answers.productsPerCategory ?? parsed.productsPerCategory,
    categoryNames: [],
    categoryUrls: answers.categoryUrls || [],
    homeUrl: "",
    plpUrl: "",
    searchUrl: "",
    pdpUrl: "",
  };
}

export function shouldOfferAutoScrapeAfterProfile(result, options) {
  if (!result?.profile) {
    return false;
  }

  if (options.interactiveAssistance === false) {
    return false;
  }

  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

export function isProfileValidForAutomaticSelection(result) {
  if (!result?.profile || result.profile.platformHint === "generic") {
    return false;
  }

  return result.assistance?.status !== "needs_user_input";
}

function shouldPromptForAssistance(assistance, options) {
  if (!assistance || assistance.status !== "needs_user_input") {
    return false;
  }

  if (options.interactiveAssistance === false) {
    return false;
  }

  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function getExistingValue(options, id) {
  switch (id) {
    case "home_url":
      return options.homeUrl || options.entryUrl;
    case "plp_url":
      return options.plpUrl || options.categoryUrls?.[0] || "";
    case "additional_plp_url":
      return "";
    case "search_url":
      return options.searchUrl || "";
    case "pdp_url":
      return options.pdpUrl || "";
    default:
      return "";
  }
}

function normalizeYesNo(value) {
  return ["y", "yes", "s", "si"].includes(String(value || "").trim().toLowerCase());
}

async function promptUrlWithDefault(rl, label, fallback) {
  while (true) {
    const response = (await rl.question(`${label} [${fallback}]: `)).trim();
    const value = response || fallback;

    if (isHttpUrl(value)) {
      return value;
    }

    console.log(`- Valor ignorado para ${label}: no parece una URL http/https valida.`);
  }
}

async function promptPositiveIntegerWithDefault(rl, label, fallback) {
  while (true) {
    const response = (await rl.question(`${label} [${fallback}]: `)).trim();

    if (!response) {
      return fallback;
    }

    const parsed = Number(response);

    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }

    console.log(`- Valor ignorado para ${label}: introduce un entero positivo.`);
  }
}

async function promptUrlListWithDefault(rl, label, fallback = []) {
  while (true) {
    const fallbackLabel = fallback.length ? ` [${fallback.join(", ")}]` : "";
    const response = (await rl.question(`${label}${fallbackLabel}: `)).trim();
    const values = response ? parseHttpUrlValues(response) : fallback;

    if (values.length) {
      return dedupeUrls(values);
    }

    console.log(`- Valor ignorado para ${label}: necesito al menos una PLP valida.`);
  }
}

async function promptCategorySelectionMode(rl) {
  while (true) {
    const response = normalizeLookupChoice(
      await rl.question(
        "\nQuieres categorias concretas o que las seleccione automaticamente? [select/auto]: ",
      ),
    );

    if (!response || response === "auto") {
      return "auto";
    }

    if (response === "select") {
      return "select";
    }

    console.log("- Valor ignorado: responde `select` o `auto`.");
  }
}

function buildPromptLabel(input) {
  const suffix = input.multiple ? " (puedes pegar varias separadas por comas o saltos de linea)" : "";
  return `${input.label}${input.required ? " (obligatorio)" : " (opcional)"}${suffix}: `;
}

function parseHttpUrlValues(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => isHttpUrl(entry));
}

function hasProvidedValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
}

function normalizeAnsweredUrls(value) {
  if (Array.isArray(value)) {
    return dedupeUrls(value.map((entry) => String(entry || "").trim()).filter(Boolean));
  }

  return dedupeUrls([String(value || "").trim()].filter(Boolean));
}

function dedupeUrls(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function buildProfileContinuationPrompt(profileValid) {
  return profileValid
    ? "\nEl perfil es valido. Quieres continuar ahora hacia el scrape? [y/N]: "
    : "\nEl perfil no es suficiente para modo auto. Quieres continuar igualmente con un listado de PLPs? [y/N]: ";
}

function normalizeLookupChoice(value) {
  const normalized = String(value || "").trim().toLowerCase();

  if (["select", "seleccionar", "seleccion", "concretas", "concreta", "listado", "lista"].includes(normalized)) {
    return "select";
  }

  if (
    ["auto", "automatico", "automatica", "automaticamente", "automatic", ""].includes(normalized)
  ) {
    return "auto";
  }

  return normalized;
}
