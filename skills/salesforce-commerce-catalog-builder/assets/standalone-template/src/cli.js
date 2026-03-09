import path from "node:path";

import { buildProfileAssistanceRequest, buildScrapeAssistanceRequest } from "./assistance/request.js";
import {
  applyAssistanceInputsToParsed,
  hasGuidedSampleUrls,
  promptForAssistanceInputs,
} from "./assistance/interactive.js";
import { loadSiteConfig, mergeOptionsWithConfig } from "./config.js";
import { profileSite } from "./profiler.js";
import { loadSiteProfile } from "./site-profiles/loader.js";
import { ensureDir, writeJsonFile } from "./utils/fs.js";
import { getDomainSlug } from "./utils/url.js";

const DEFAULTS = {
  headless: true,
  maxCategories: 4,
  maxSubcategoriesPerCategory: 2,
  productsPerCategory: 10,
  maxPaginationPages: 3,
  formats: ["generic", "b2c", "b2b"],
  currency: "USD",
  lang: "x-default",
  catalogId: "demo-catalog",
  pricebookId: "demo-pricebook",
  pricebookName: "Demo Price Book",
  timeoutMs: 30000,
  outputDir: "output",
  profilesDir: "profiles",
  profileTransport: "auto",
  interactiveAssistance: true,
};

export async function runCli(argv) {
  const parsed = parseArgs(argv);

  if (parsed.command === "help" || parsed.help) {
    printHelp();
    return;
  }

  if (!["scrape", "profile-site"].includes(parsed.command)) {
    throw new Error("Usa `scrape` o `help`.");
  }

  if (parsed.command === "profile-site") {
    await runProfileSiteCommand(parsed);
    return;
  }

  await runScrapeCommand(parsed);
}

async function runScrapeCommand(parsed) {
  let workingParsed = { ...parsed };
  let attempt = 0;

  while (attempt < 3) {
    const explicitConfig = await loadSiteConfig(workingParsed.configPath);
    const initialSiteProfile = workingParsed.entryUrl
      ? await loadSiteProfile(workingParsed.entryUrl, workingParsed.profilesDir)
      : null;
    const initialSiteConfig = mergeKnownConfig(initialSiteProfile || {}, explicitConfig || {});
    let options = mergeOptionsWithConfig(DEFAULTS, workingParsed, initialSiteConfig);

    if (!options.entryUrl) {
      throw new Error("Falta `--url` o `entryUrl` en el fichero de configuracion.");
    }

    if (hasGuidedSampleUrls(options)) {
      console.log("\nPreparando perfil guiado antes del scrape...");
      await runProfileBootstrap(options);
    }

    const siteProfile = options.entryUrl ? await loadSiteProfile(options.entryUrl, options.profilesDir) : null;
    const siteConfig = mergeKnownConfig(siteProfile || {}, explicitConfig || {});
    options = mergeOptionsWithConfig(DEFAULTS, workingParsed, siteConfig);
    const [{ scrapeCatalog }, { exportAll }] = await Promise.all([
      import("./scraper.js"),
      import("./exporters/index.js"),
    ]);

    const storeSlug = options.storeSlug || getDomainSlug(options.entryUrl);
    const outputDir = path.resolve(options.outputDir, storeSlug);

    console.log(`\nTienda: ${options.entryUrl}`);
    console.log(
      `Modo: ${options.categoryNames.length || options.categoryUrls.length ? "categorias concretas" : "descubrimiento automatico"}`,
    );
    console.log(`Salida: ${outputDir}`);
    if (siteProfile) {
      console.log(`Perfil: ${options.profilesDir}/${new URL(options.entryUrl).hostname.replace(/^www\./, "")}.json`);
    }

    const scrapeResult = await scrapeCatalog(options);
    const assistance = buildScrapeAssistanceRequest(options, scrapeResult);

    await ensureDir(outputDir);
    const exportedFiles = await exportAll(scrapeResult, options, outputDir);
    const summaryPath = path.join(outputDir, "run-summary.json");

    await writeJsonFile(summaryPath, {
      scrapedAt: new Date().toISOString(),
      entryUrl: options.entryUrl,
      requestedCategories: options.categoryNames,
      requestedCategoryUrls: options.categoryUrls,
      totals: scrapeResult.summary,
      validation: scrapeResult.validation,
      assistance,
      exportedFiles,
      warnings: scrapeResult.warnings,
      categories: scrapeResult.categories,
    });

    console.log("\nResumen");
    console.log(`- Categorias procesadas: ${scrapeResult.summary.categoriesProcessed}`);
    console.log(`- Productos unicos: ${scrapeResult.summary.productsExtracted}`);
    console.log(`- Productos validos: ${scrapeResult.summary.productsValid}`);
    console.log(`- Advertencias: ${scrapeResult.warnings.length}`);
    console.log(`- Errores de validacion: ${scrapeResult.summary.validationErrors}`);
    console.log(`- Summary: ${summaryPath}`);

    for (const file of exportedFiles) {
      console.log(`- ${file.label}: ${file.path}`);
    }

    printAssistanceRequest(assistance);

    const answers = await promptForAssistanceInputs(assistance, options);

    if (!answers) {
      return;
    }

    workingParsed = applyAssistanceInputsToParsed(workingParsed, answers, "scrape");
    console.log("\nReintentando scrape con ayuda del usuario...");
    attempt += 1;
  }

  console.log("\nSe alcanzo el maximo de reintentos asistidos para scrape.");
}

async function runProfileSiteCommand(parsed) {
  if (!parsed.entryUrl) {
    throw new Error("Falta `--url` para generar el perfil del sitio.");
  }

  let workingParsed = { ...parsed };
  let attempt = 0;

  while (attempt < 3) {
    const options = {
      ...DEFAULTS,
      ...dropUndefined(workingParsed),
      entryUrl: workingParsed.entryUrl,
    };
    const result = await profileSite(options);
    const assistance = result.assistance || buildProfileAssistanceRequest(options, result);

    console.log(`\nTienda: ${options.entryUrl}`);
    console.log(`Perfil generado: ${result.profilePath}`);
    console.log(`Summary: ${result.summaryPath}`);
    console.log(`Plataforma detectada: ${result.profile.platformHint}`);
    console.log(`Confianza: ${Math.round(result.profile.confidence * 100)}%`);

    for (const recommendation of result.profile.recommendations || []) {
      console.log(`- ${recommendation}`);
    }

    for (const candidate of result.profile.learningCandidates || []) {
      console.log(`- Candidato reusable: ${candidate.message}`);
    }

    printAssistanceRequest(assistance);

    const answers = await promptForAssistanceInputs(assistance, options);

    if (!answers) {
      return;
    }

    workingParsed = applyAssistanceInputsToParsed(workingParsed, answers, "profile-site");
    console.log("\nReintentando profile-site con ayuda del usuario...");
    attempt += 1;
  }

  console.log("\nSe alcanzo el maximo de reintentos asistidos para profile-site.");
}

function parseArgs(argv) {
  const parsed = {
    command: argv[0] || "help",
    help: false,
    configPath: null,
    entryUrl: "",
    categoryNames: [],
    categoryUrls: [],
    headless: undefined,
    homeUrl: "",
    plpUrl: "",
    searchUrl: "",
    pdpUrl: "",
    formats: undefined,
    outputDir: undefined,
    profilesDir: DEFAULTS.profilesDir,
    profileTransport: DEFAULTS.profileTransport,
    interactiveAssistance: undefined,
    maxCategories: undefined,
    maxSubcategoriesPerCategory: undefined,
    productsPerCategory: undefined,
    maxPaginationPages: undefined,
    currency: undefined,
    lang: undefined,
    catalogId: undefined,
    pricebookId: undefined,
    pricebookName: undefined,
    timeoutMs: undefined,
    storeSlug: undefined,
  };

  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];

    switch (token) {
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      case "--config":
        parsed.configPath = argv[++index];
        break;
      case "--url":
        parsed.entryUrl = argv[++index];
        break;
      case "--category":
        parsed.categoryNames.push(argv[++index]);
        break;
      case "--category-url":
        parsed.categoryUrls.push(argv[++index]);
        break;
      case "--home-url":
        parsed.homeUrl = argv[++index];
        break;
      case "--plp-url":
        parsed.plpUrl = argv[++index];
        break;
      case "--search-url":
        parsed.searchUrl = argv[++index];
        break;
      case "--pdp-url":
        parsed.pdpUrl = argv[++index];
        break;
      case "--formats":
      case "--format":
        parsed.formats = argv[++index]
          .split(",")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean);
        break;
      case "--output-dir":
        parsed.outputDir = argv[++index];
        break;
      case "--profiles-dir":
        parsed.profilesDir = argv[++index];
        break;
      case "--profile-transport":
        parsed.profileTransport = argv[++index];
        break;
      case "--interactive-assistance":
        parsed.interactiveAssistance = parseBoolean(argv[++index]);
        break;
      case "--max-categories":
        parsed.maxCategories = Number(argv[++index]);
        break;
      case "--max-subcategories":
        parsed.maxSubcategoriesPerCategory = Number(argv[++index]);
        break;
      case "--products-per-category":
        parsed.productsPerCategory = Number(argv[++index]);
        break;
      case "--max-pagination-pages":
        parsed.maxPaginationPages = Number(argv[++index]);
        break;
      case "--currency":
        parsed.currency = argv[++index];
        break;
      case "--lang":
        parsed.lang = argv[++index];
        break;
      case "--catalog-id":
        parsed.catalogId = argv[++index];
        break;
      case "--pricebook-id":
        parsed.pricebookId = argv[++index];
        break;
      case "--pricebook-name":
        parsed.pricebookName = argv[++index];
        break;
      case "--timeout-ms":
        parsed.timeoutMs = Number(argv[++index]);
        break;
      case "--store-slug":
        parsed.storeSlug = argv[++index];
        break;
      case "--headless":
        parsed.headless = parseBoolean(argv[++index]);
        break;
      default:
        if (token.startsWith("--")) {
          throw new Error(`Parametro no soportado: ${token}`);
        }
    }
  }

  return parsed;
}

function parseBoolean(value) {
  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`Valor booleano invalido: ${value}`);
}

function printHelp() {
  console.log(`
Uso:
  npm start -- scrape --url https://example.com [opciones]
  npm start -- profile-site --url https://example.com [opciones]

Opciones principales:
  --url <url>                        URL de entrada de la tienda
  --config <path>                    Configuracion JSON por tienda
  --category <nombre>                Categoria concreta por nombre (repetible)
  --category-url <url>               Categoria concreta por URL (repetible)
  --home-url <url>                   URL de home para profile-site
  --plp-url <url>                    URL de PLP para profile-site
  --search-url <url>                 URL de resultados de busqueda para profile-site
  --pdp-url <url>                    URL de PDP para profile-site
  --products-per-category <n>        Productos maximos por categoria
  --max-categories <n>               Categorias top a rastrear en modo automatico
  --max-subcategories <n>            Subcategorias maximas por categoria
  --formats generic,b2c,b2b          Formatos de salida
  --output-dir <dir>                 Directorio raiz de salida
  --profiles-dir <dir>               Directorio de perfiles por sitio
  --profile-transport <modo>         auto o fetch para profile-site
  --interactive-assistance true|false Reintenta pidiendo URLs al usuario si falta contexto
  --currency <ISO>                   Moneda por defecto
  --catalog-id <id>                  Catalog ID para B2C
  --pricebook-id <id>                Pricebook ID para B2C
  --pricebook-name <nombre>          Nombre del pricebook
  --headless true|false              Ejecuta Chromium en headless
  --timeout-ms <n>                   Timeout de navegacion

Ejemplos:
  npm start -- scrape --url https://example.com --max-categories 4 --products-per-category 8
  npm start -- scrape --url https://example.com --category "Men" --category "Women"
  npm start -- scrape --config ./site-config.example.json --formats generic,b2c,b2b
  npm start -- profile-site --url https://example.com --plp-url https://example.com/category/shoes --pdp-url https://example.com/p/red-shoe
`);
}

function printAssistanceRequest(assistance) {
  if (!assistance || assistance.status !== "needs_user_input") {
    return;
  }

  console.log("\nSe necesita ayuda del usuario");
  console.log(`- Nivel: ${assistance.severity}`);
  console.log(`- ${assistance.message}`);

  for (const reason of assistance.reasons) {
    console.log(`- Motivo: ${reason}`);
  }

  for (const input of assistance.requestedInputs) {
    console.log(`- Solicitar ${input.label}${input.required ? " (obligatorio)" : " (opcional)"}: ${input.reason}`);
  }

  if (assistance.suggestedCommand) {
    console.log(`- Reintento sugerido: ${assistance.suggestedCommand}`);
  }
}

async function runProfileBootstrap(options) {
  const bootstrapOptions = {
    ...DEFAULTS,
    ...dropUndefined(options),
    entryUrl: options.entryUrl,
  };
  const result = await profileSite(bootstrapOptions);

  console.log(`- Perfil guiado actualizado: ${result.profilePath}`);
}

function mergeKnownConfig(profile, explicit) {
  return {
    ...profile,
    ...explicit,
    categoryDiscovery: {
      ...(profile.categoryDiscovery || {}),
      ...(explicit.categoryDiscovery || {}),
    },
    productDiscovery: {
      ...(profile.productDiscovery || {}),
      ...(explicit.productDiscovery || {}),
    },
    pagination: {
      ...(profile.pagination || {}),
      ...(explicit.pagination || {}),
    },
    productExtraction: {
      ...(profile.productExtraction || {}),
      ...(explicit.productExtraction || {}),
    },
  };
}

function dropUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
