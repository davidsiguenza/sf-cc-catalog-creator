# Standalone Catalog Scraper Template

This template is a runnable bootstrap that the skill can copy into a new workspace or an isolated subdirectory.

Important:

- the most up-to-date maintained runtime lives in the main repo
- this template is a starting point that the agent can copy and adapt
- if you need the latest capabilities, the agent should synchronize the template with the main runtime

## Principle: Never Assume

Do not assume:

- you are already inside the correct folder
- `npm install` has already been run
- Chromium is already installed
- the target site has an easy-to-discover PLP or PDP

Use complete commands and verify each step.

## Rule for `npm init -y`

Do not run `npm init -y` if this template has already been copied into your workspace, because it already includes `package.json`.

Only run `npm init -y` if you are starting from a completely empty folder and have not yet copied any Node project.

## Install

First, make sure you are in the root of this standalone project.

Check whether `package.json` exists.

If it exists:

- do not run `npm init -y`
- go directly to dependency installation

Then run:

```bash
npm install
npx playwright install chromium
```

Verify that the CLI responds:

```bash
npm start -- help
```

## Common errors

### `npm install` fails with `ENOENT package.json`

That means you are not in a folder with an initialized Node project.

If this template has already been copied, you should be inside the folder that contains its `package.json`.

### `npx playwright install chromium` warns that dependencies are missing

That means the project does not yet have `playwright` installed.

If this template was copied correctly, first run:

```bash
npm install
```

and then:

```bash
npx playwright install chromium
```

## Run

Automatic scrape:

```bash
npm start -- scrape \
  --url https://example.com \
  --max-categories 4 \
  --products-per-category 8 \
  --formats generic,b2c,b2b
```

JSON config:

```bash
npm start -- scrape \
  --config ./site-config.example.json \
  --formats generic,b2c,b2b
```

## Output

Generated files appear in `output/<domain>/`.

- `generic-products.csv`
- `visual-catalog.html`
- `run-summary.json`
- `salesforce-b2c/<brand>-catalog.xml`
- `salesforce-b2c/<brand>-pricebooks.xml`
- `salesforce-b2c/<brand>-inventory.xml`
- `salesforce-b2b/commerce-import.csv`
