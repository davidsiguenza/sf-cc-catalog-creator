import path from "node:path";

import { loadSiteConfig, mergeOptionsWithConfig } from "./config.js";
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
};

export async function runCli(argv) {
  const parsed = parseArgs(argv);

  if (parsed.command === "help" || parsed.help) {
    printHelp();
    return;
  }

  if (parsed.command !== "scrape") {
    throw new Error("Usa `scrape` o `help`.");
  }

  const siteConfig = await loadSiteConfig(parsed.configPath);
  const options = mergeOptionsWithConfig(DEFAULTS, parsed, siteConfig);
  const [{ scrapeCatalog }, { exportAll }] = await Promise.all([
    import("./scraper.js"),
    import("./exporters/index.js"),
  ]);

  if (!options.entryUrl) {
    throw new Error("Falta `--url` o `entryUrl` en el fichero de configuracion.");
  }

  const storeSlug = options.storeSlug || getDomainSlug(options.entryUrl);
  const outputDir = path.resolve(options.outputDir, storeSlug);

  console.log(`\nTienda: ${options.entryUrl}`);
  console.log(`Modo: ${options.categoryNames.length || options.categoryUrls.length ? "categorias concretas" : "descubrimiento automatico"}`);
  console.log(`Salida: ${outputDir}`);

  const scrapeResult = await scrapeCatalog(options);

  await ensureDir(outputDir);
  const exportedFiles = await exportAll(scrapeResult, options, outputDir);
  const summaryPath = path.join(outputDir, "run-summary.json");

  await writeJsonFile(summaryPath, {
    scrapedAt: new Date().toISOString(),
    entryUrl: options.entryUrl,
    requestedCategories: options.categoryNames,
    requestedCategoryUrls: options.categoryUrls,
    totals: scrapeResult.summary,
    exportedFiles,
    warnings: scrapeResult.warnings,
    categories: scrapeResult.categories,
  });

  console.log("\nResumen");
  console.log(`- Categorias procesadas: ${scrapeResult.summary.categoriesProcessed}`);
  console.log(`- Productos unicos: ${scrapeResult.summary.productsExtracted}`);
  console.log(`- Advertencias: ${scrapeResult.warnings.length}`);
  console.log(`- Summary: ${summaryPath}`);

  for (const file of exportedFiles) {
    console.log(`- ${file.label}: ${file.path}`);
  }
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
    formats: undefined,
    outputDir: undefined,
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

Opciones principales:
  --url <url>                        URL de entrada de la tienda
  --config <path>                    Configuracion JSON por tienda
  --category <nombre>                Categoria concreta por nombre (repetible)
  --category-url <url>               Categoria concreta por URL (repetible)
  --products-per-category <n>        Productos maximos por categoria
  --max-categories <n>               Categorias top a rastrear en modo automatico
  --max-subcategories <n>            Subcategorias maximas por categoria
  --formats generic,b2c,b2b          Formatos de salida
  --output-dir <dir>                 Directorio raiz de salida
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
`);
}
