# Standalone Catalog Scraper Template

This template is the runnable project that the skill should copy into a new workspace or subfolder.

## Install

```bash
npm install
npx playwright install chromium
```

## Run

Automatic discovery:

```bash
npm start -- scrape \
  --url https://example.com \
  --max-categories 4 \
  --products-per-category 8 \
  --formats generic,b2c,b2b
```

Site config mode:

```bash
npm start -- scrape \
  --config ./site-config.example.json \
  --formats generic,b2c,b2b
```

## Output

Generated files appear in `output/<domain>/`.

- `generic-products.csv`
- `visual-catalog.html`
- `salesforce-b2c/<brand>-catalog.xml`
- `salesforce-b2c/<brand>-pricebooks.xml`
- `salesforce-b2c/<brand>-inventory.xml`
- `salesforce-b2b/commerce-import.csv`
- `run-summary.json`
