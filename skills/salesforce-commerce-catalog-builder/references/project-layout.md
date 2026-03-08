# Recommended Project Layout

Use this layout when the target repo does not already have an equivalent structure.

## Core Files

- `src/cli.js`
  Parse arguments, set defaults, load per-site config, orchestrate scrape + exports.

- `src/scraper.js`
  Launch Playwright, walk categories, visit products, merge duplicates, and return a normalized result object.

- `src/storefront.js`
  Encapsulate category discovery, subcategory discovery, product link extraction, and field extraction from product pages.

- `src/exporters/generic-csv.js`
  Emit the flat CSV for staging/demo work.

- `src/exporters/visual-html.js`
  Emit an HTML preview so the user can validate extraction visually before import.

- `src/exporters/salesforce-b2c.js`
  Emit the validated B2C catalog, pricebooks, and inventory XML. Follow `b2c-defaults.md`.

- `src/exporters/salesforce-b2b.js`
  Emit the starter B2B Commerce CSV.

- `src/utils/*.js`
  Keep helpers for files, CSV, HTML, XML escaping, URL cleanup, text normalization, and product/category merging here.

- `test/*.test.js`
  Cover exporter invariants and normalization logic.

## CLI Capabilities

Support these flags or equivalent:

- `--url`
- `--config`
- `--category`
- `--category-url`
- `--products-per-category`
- `--max-categories`
- `--max-subcategories`
- `--formats`
- `--output-dir`
- `--currency`
- `--catalog-id`
- `--pricebook-id`
- `--pricebook-name`
- `--headless`

## Site Config Shape

Keep the per-site JSON readable and selector-driven. At minimum support:

- `entryUrl`
- `currency`
- `lang`
- `categoryDiscovery.selectors`
- `categoryDiscovery.includePatterns`
- `categoryDiscovery.excludePatterns`
- `productDiscovery.selectors`
- `pagination.selectors`
- `productExtraction.name`
- `productExtraction.description`
- `productExtraction.sku`
- `productExtraction.price`
- `productExtraction.images`

## Product Data Model

Normalize products so exporters can share the same object shape. Keep, at minimum:

- `productId`
- `name`
- `description`
- `sku`
- `price`
- `currency`
- `brand`
- `category`
- `subcategory`
- `categoryPath`
- `allCategoryPaths`
- `imageUrls`
- `productUrl`

## Verification Flow

1. Install dependencies and browser runtime.
2. Run a bounded scrape against a real store.
3. Confirm the output count in `run-summary.json`.
4. Open `visual-catalog.html`.
5. Validate B2C XML when schemas are available.
6. Only then hand the files to the user for import.
