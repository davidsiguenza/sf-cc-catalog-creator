---
name: salesforce-commerce-catalog-builder
description: Use when the user wants to scrape a public ecommerce storefront and generate reusable demo/import artifacts for Salesforce B2C Commerce or B2B Commerce, especially a generic CSV, visual HTML preview, B2C catalog/pricebook/inventory XML, and per-site selector configuration that should work on first import.
---

# Salesforce Commerce Catalog Builder

Use this skill when the user wants a reusable storefront scraping pipeline that can:

- discover categories and subcategories or work from explicit category inputs
- extract product fields for a demo catalog
- export CSV, HTML, and Salesforce Commerce imports
- preserve the validated B2C import shape from this repo without re-deciding the XML contract
- run as a standalone tool without touching the user's existing app code

## Workflow

1. Inspect the target repo before changing anything.
   If there is already a scraper/export pipeline, adapt it instead of replacing it.

2. Default placement rule:
   - if the workspace is empty, create the scraper there
   - if the workspace already contains an app or other code, create a standalone subdirectory such as `catalog-scraper/`
   - do not modify the user's existing app files unless the user explicitly asks for integration

3. If `assets/standalone-template/` exists in this skill, copy that template instead of inventing a fresh implementation. It is the preferred bootstrap path because it already contains the validated CLI, exporters, tests, and defaults.
   If the root repo contains a newer runtime than the packaged template, prefer the newer runtime or sync the template before handing off the result.

4. If no template is available, scaffold a small Node CLI with Playwright and a modular structure equivalent to:
   - `src/cli.js`
   - `src/scraper.js`
   - `src/storefront.js`
   - `src/exporters/*.js`
   - `src/utils/*.js`
   - `test/*.test.js`

5. Make extraction configurable per site.
   Create a JSON config with selectors for category discovery, product discovery, pagination, and field extraction. Keep fallback heuristics so the tool still works with minimal input.

6. Support both operating modes:
   - automatic discovery of top categories and subcategories
   - explicit categories by name or URL

7. Unless the user asks otherwise, default to a demo-friendly run:
   - 4 top categories
   - up to 2 subcategories per category
   - 10 products per processed category
   - output directory `output/<domain>/`

8. Always generate these deliverables:
   - `generic-products.csv`
   - `visual-catalog.html`
   - `salesforce-b2c/<brand>-catalog.xml`
   - `salesforce-b2c/<brand>-pricebooks.xml`
   - `salesforce-b2c/<brand>-inventory.xml`
   - `salesforce-b2b/commerce-import.csv`
   - `run-summary.json`

9. Treat the B2C export contract in `references/b2c-defaults.md` as mandatory unless the user explicitly asks for a different import shape.

10. Do not stop after writing files. Run the full flow:
    - install dependencies
    - install Chromium
    - profile the site first when it is new or ambiguous
    - execute the scrape
    - confirm that products were actually exported

11. Validate with:
   - unit tests for normalization/exporters
   - a real scrape against the requested store
   - a visual check of `visual-catalog.html`
   - XSD validation for B2C XML when schemas are available locally

12. If the scrape produces an empty CSV or no B2C/B2B files:
    - inspect the site config and selectors
    - ask the user for a real home, PLP, search, or PDP URL when discovery is ambiguous
    - rerun `profile-site` with those URLs before retrying `scrape`
    - retry with category URLs or stronger selectors
    - only stop early if the site is blocked or the user explicitly tells you to stop

## Runtime Requirements

This skill does not bundle browser automation binaries by itself. In a new project, ensure the target repo has:

- Node.js 20 or newer
- the `playwright` package installed in the target project
- the Chromium runtime installed with `npx playwright install chromium`

If the target repo uses another package manager, adapt the install command, but keep Playwright as the runtime for scraping unless the user explicitly asks for a different approach.

## Implementation Rules

- Prefer Playwright over raw HTTP scraping unless the site is clearly static.
- When a packaged template is available, copy and adapt it instead of generating code from scratch.
- Merge duplicates by stable key: SKU first, then product id, then product URL.
- Preserve all discovered category paths for a product so assignments can be merged later.
- Save image URLs, not binary downloads, unless the user explicitly asks for binaries.
- Keep brand-aware naming in generated files and B2C ids.
- In a non-empty repo, isolate the tool in its own folder by default.
- If the user reports that categories import but products do not show in storefront, compare the generated XML against `references/b2c-defaults.md` before changing anything else.

## References

- Read `references/b2c-defaults.md` before implementing or modifying any B2C exporter.
- Read `references/project-layout.md` when porting this workflow into a new repo.
- Read `references/target-project-setup.md` when setting this up in a fresh repo or documenting prerequisites for users.

## Example Requests

- `Use $salesforce-commerce-catalog-builder to add a storefront scraper that exports B2C XML, B2B CSV, generic CSV, and a visual HTML preview.`
- `Use $salesforce-commerce-catalog-builder to scrape this ecommerce site and prepare a demo catalog for Salesforce B2C Commerce.`
- `Use $salesforce-commerce-catalog-builder to adapt the extractor to this store and make the B2C import work on first upload.`
- `Use $salesforce-commerce-catalog-builder to create a standalone scraper in ./catalog-scraper using the packaged template, install dependencies, run it, and leave the outputs inside that folder without touching the rest of the repo.`
