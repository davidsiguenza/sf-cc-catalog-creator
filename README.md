# Product Catalog Scraper

Runnable tooling to explore an ecommerce storefront, discover catalog structure, extract products, and export them to:

- `generic-products.csv`
- `visual-catalog.html`
- Salesforce B2C Commerce XML
- Salesforce B2B Commerce CSV

The goal is simple: save time during demos by trying `100% automatic` discovery first, then asking the user for the smallest amount of help only when needed.

## Operating principle: Never Assume

This project should always be documented and used with one rule:

- do not assume the user already cloned the repo
- do not assume the user is already in the correct folder
- do not assume `Node.js` is already installed
- do not assume `npm install` has already been run
- do not assume Playwright already has Chromium installed
- do not assume the target site has an easy-to-discover PLP or PDP
- do not assume the user knows whether they should use the runnable repo or the skill

Because of that, the setup below always uses complete, literal commands.

## Important rule about `npm init -y`

Do not assume `npm init -y` is always required.

It depends on your starting point:

- if you clone this repo, do not run `npm init -y`
- if you copy the standalone template from the skill, do not run `npm init -y`
- if you start from a completely empty folder and want to create a Node project manually, then yes: run `npm init -y`

Practical rule:

- if `package.json` already exists, do not run `npm init -y`
- if `package.json` does not exist, create the Node project first

## There are 2 different things here

### 1. This repo

This is the runnable product.

It includes:

- the runnable CLI
- the discovery and extraction engine
- the exporters
- the tests
- per-site profiles

If you want to produce catalogs today, this is the main option.

### 2. The skill

It lives here:

- [skills/salesforce-commerce-catalog-builder/SKILL.md](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/skills/salesforce-commerce-catalog-builder/SKILL.md)

The skill is not the scraper running by itself.

The skill is a reusable instruction set for an agent such as Codex/Cursor:

- to set up this workflow in another workspace
- to copy a standalone template
- to adapt the workflow to another repo without re-explaining the architecture

Short version:

- if you want to use the scraper now, clone this repo
- if you want an agent to reproduce or adapt this capability in another repo, use the skill

Important today:

- the main runtime lives in this repo
- the standalone template in the skill is a bootstrap that the agent can copy and adapt, not the canonical source of the maintained runtime

## Recommended path for demos

If you want the fastest demo path:

1. clone this repo
2. enter the repo folder
3. install dependencies
4. install Chromium
5. run `profile-site`
6. run `scrape`
7. review `visual-catalog.html`
8. import or present the outputs

Reserve the skill for these cases:

- you want to bring this workflow into another repo
- you want an agent to create a standalone version in an empty folder
- you want to distribute the capability as a reusable recipe across teams

## Local setup for this repo

### 1. Clone the repo

If you do not already have this project locally, run exactly this:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
```

After `git clone`, this repo already contains `package.json`.

That means:

- you do not need `npm init -y`
- you can go directly to `npm install`

### 2. Check prerequisites

Before going further, verify that `Node.js` and `npm` are available:

```bash
node -v
npm -v
```

Minimum requirements:

- Node.js `>= 20`
- Playwright Chromium runtime

If `node -v` or `npm -v` fail, install Node.js first and come back to this step.

### 3. Install project dependencies

From the repo root, run:

```bash
npm install
```

Do not run `npm init -y` here, because this repo is already a Node project.

### Common error: `npm install` fails with `ENOENT package.json`

If you see something like:

```text
npm error enoent Could not read package.json
```

it means one of these two things:

1. you are not inside the cloned repo
2. you are in an empty folder that is not yet a Node project

Example of the wrong situation:

```bash
cd test-catalog
npm install
```

That fails if `test-catalog/` does not contain `package.json`.

The fix depends on what you actually want to do.

Case A: you want to use this repo

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
npm install
npx playwright install chromium
```

Case B: you want to create a brand-new Node project manually

```bash
mkdir test-catalog
cd test-catalog
npm init -y
```

But note: after `npm init -y`, your project is still empty. It does not yet contain `playwright` or this scraper.

If you run:

```bash
npm install
```

with no dependencies declared, npm will not install anything useful for this use case.

### Common error: `npx playwright install chromium` warns that dependencies are missing

If Playwright warns that you should install project dependencies first, that means:

- your `package.json` exists
- but the project does not have `playwright` installed

That is exactly what happens if you run `npm init -y` in an empty folder and then run `npm install` without adding any dependencies.

If you are building a project manually from scratch, the minimum order is:

```bash
npm init -y
npm install playwright
npx playwright install chromium
```

If you want to use this scraper, do not take that path. Use this instead:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
npm install
npx playwright install chromium
```

### 4. Install Chromium for Playwright

From the repo root, run:

```bash
npx playwright install chromium
```

### 5. Check the CLI

To confirm the project is ready:

```bash
npm start -- help
```

## Recommended workflow

### 1. Profile a new site

If the site is new or likely does not fit generic heuristics well, start here:

```bash
npm start -- profile-site \
  --url https://example.com \
  --home-url https://example.com \
  --plp-url https://example.com/category/shoes \
  --pdp-url https://example.com/p/red-shoe
```

`profile-site`:

- detects the platform when possible
- learns category and product patterns
- generates `profiles/<domain>.json`
- writes a summary to `output/<domain>/profile-summary.json`

The helper URLs are optional, but very useful:

- `--home-url`
- `--plp-url`
- `--search-url`
- `--pdp-url`

For `profile-site`, each of those flags accepts a single sample URL. If you need to broaden the catalog with several PLPs, that happens later in the assisted `scrape` flow, not by passing multiple `--plp-url` values in the same command.

If you do not know those URLs yet, you can start with:

```bash
npm start -- profile-site --url https://example.com
```

If the system cannot find enough context and you are in an interactive terminal, it can ask for `PLP URL`, `PDP URL`, or `Search URL` and retry automatically.

In `scrape`, when it asks for a `PLP URL`, you can now provide one or several PLPs. If the extraction works but still covers too few categories, the assistant can ask for an extra PLP and retry with all of them combined.

If `profile-site` finishes with a known platform and enough confidence to continue, the CLI can also offer to launch `scrape` immediately. It reuses the profiled store URL, asks you to confirm it, asks how many categories and products per category you want, and then runs the automatic scrape for you.

### 2. Run the scrape

Automatic mode:

```bash
npm start -- scrape \
  --url https://example.com \
  --max-categories 4 \
  --products-per-category 8 \
  --formats generic,b2c,b2b
```

Single category mode:

```bash
npm start -- scrape \
  --url https://example.com \
  --category-url https://example.com/category/shoes \
  --products-per-category 12 \
  --formats generic,b2c,b2b
```

JSON config mode:

```bash
npm start -- scrape \
  --config ./site-config.example.json \
  --formats generic,b2c,b2b
```

### 3. Review the result

Main output files:

- `output/<domain>/generic-products.csv`
- `output/<domain>/visual-catalog.html`
- `output/<domain>/run-summary.json`
- `output/<domain>/salesforce-b2c/*`
- `output/<domain>/salesforce-b2b/*`

### 4. Literal end-to-end demo flow

If you want the most literal flow possible, with no hidden assumptions, use this:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
node -v
npm -v
npm install
npx playwright install chromium
npm start -- profile-site --url https://example.com
npm start -- scrape --url https://example.com --formats generic,b2c,b2b
```

Then review:

```bash
open output/example-com/visual-catalog.html
```

If you do not want to use `open`, manually open:

- `output/example-com/visual-catalog.html`

## How the system works

### Automatic first

The default flow is always:

1. discover categories / PLPs
2. discover PDPs
3. extract product data
4. validate quality
5. export outputs

### Assisted only when needed

If the system cannot find enough context, it generates a structured assistance request.

Examples:

- if it cannot find PLPs, it asks for a `PLP URL`
- if it finds a PLP but not a reliable PDP, it asks for a `PDP URL`
- if the profile is still ambiguous, it may optionally ask for a `Search URL`
- if the scrape only covers one category after using a PLP, it can ask for another `PLP URL` to broaden the catalog

If you run the CLI in an interactive terminal, the command can ask for those URLs and retry automatically.

If you run it in a non-interactive environment, the summaries store:

- `assistance` in `run-summary.json`
- `assistance` in `profile-summary.json`

You can disable interactive retry with:

```bash
--interactive-assistance false
```

### Per-site profiles

Persistent learning is stored in:

- `profiles/<domain>.json`

That means the second run for the same site does not need to start from zero.

### Platforms

The engine currently tries to identify storefront families such as:

- Shopify
- SFCC
- Magento
- legacy ASP.NET store
- generic

If nothing matches cleanly, it falls back to `generic` and can ask the user for real sample URLs.

## Use the repo directly with an agent

If you are already inside this repo with Codex/Cursor, you can ask for things like:

```text
Run profile-site for https://example.com. If context is missing, ask me for a PLP and a PDP, then retry.
```

```text
Run a scrape for https://example.com, generate CSV/HTML/B2C/B2B outputs, and tell me whether the extraction is valid.
```

The agent can use:

- the CLI
- the summaries
- the saved profiles
- the `assistance` section to know what to ask for

Do not assume the agent knows whether you prefer strict CLI usage or an assisted flow. If you care, say so explicitly.

Prompt example for CLI-first usage:

```text
Use the CLI in this repo. First run profile-site for https://example.com. If context is missing, ask me for a PLP and a PDP. Then run scrape and validate the result.
```

Prompt example for a fully assisted flow:

```text
I want a real demo with this site. Run the full profile-site and scrape flow, and if PLPs or PDPs are missing ask me before continuing.
```

## Use the skill in another workspace

If you want to distribute this capability across teams or bring it into another repo, then use the skill.

### 1. Install the skill

Do not assume the skill is already installed.

From any terminal with access to `npx`, run:

```bash
npx skills add https://github.com/davidsiguenza/sf-cc-catalog-creator.git --skill salesforce-commerce-catalog-builder
```

### 2. Restart Cursor/Codex if needed

If the skill does not appear in the UI or does not respond when invoked, restart the app and reopen the workspace.

### 3. Open an empty workspace or target repo

Do not assume the skill creates files outside the current workspace. First open the folder where you want the agent to work.

### 4. Explicitly request the flow you want

Then, in an empty workspace or target repo, you can ask for something like:

```text
Use $salesforce-commerce-catalog-builder to create a standalone scraper project in this workspace, install dependencies, profile the target site, ask me for PLP/PDP URLs if discovery is ambiguous, run the scrape, and leave the outputs in output/.
```

Important:

- the skill does not replace this repo
- the skill helps recreate or adapt this repo
- if you just want to run the existing scraper, do not use the skill: clone this repo and use the CLI

### Special case: empty folder with no Node project

If you are not cloning this repo and you are not copying the standalone template, and you want to start manually from an empty folder, the minimum order is:

```bash
mkdir my-scraper
cd my-scraper
npm init -y
npm install playwright
npx playwright install chromium
```

But for this project specifically, the recommended path is still:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
npm install
npx playwright install chromium
```

## Generated outputs

### Generic outputs

- `generic-products.csv`
- `visual-catalog.html`

### Salesforce B2C Commerce

- `brand-catalog.xml`
- `brand-pricebooks.xml`
- `brand-inventory.xml`

### Salesforce B2B Commerce

- `commerce-import.csv`

### Summaries

- `run-summary.json`
- `profile-summary.json`

## Useful project structure

- [src/cli.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/cli.js): command entry point
- [src/profiler.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/profiler.js): site profiling
- [src/scraper.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/scraper.js): scrape orchestration
- [src/fetch-storefront.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/fetch-storefront.js): HTTP transport for sites where Playwright is not viable
- [src/site-profiles/](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/site-profiles): profile system
- [profiles/](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/profiles): generated profiles
- [docs/target-architecture.md](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/docs/target-architecture.md): target architecture

## Quick examples

### New site, user helps from the beginning

```bash
npm start -- profile-site \
  --url https://example.com \
  --plp-url https://example.com/category/shoes \
  --search-url https://example.com/search?q=shoe \
  --pdp-url https://example.com/p/red-shoe
```

```bash
npm start -- scrape \
  --url https://example.com \
  --category-url https://example.com/category/shoes \
  --formats generic,b2c,b2b
```

### New site, almost fully automatic

```bash
npm start -- profile-site --url https://example.com
npm start -- scrape --url https://example.com --formats generic,b2c,b2b
```

If the system needs help and you are in an interactive terminal, it can ask for URLs and retry.

## Development and validation

Run tests:

```bash
npm test
```

Synchronize the standalone skill template with the main runtime:

```bash
npm run sync:standalone-template
```

If a specific site fails:

1. run `profile-site`
2. inspect `profile-summary.json`
3. review `assistance`
4. provide `PLP/PDP/Search URL` if needed
5. rerun `scrape`

## Minimum checklist for a demo user

If someone needs to use this without prior context, this is the minimum checklist:

1. Run `git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git`
2. Run `cd sf-cc-catalog-creator`
3. Confirm that `package.json` already exists
4. Run `node -v` and confirm `>= 20`
5. Run `npm install`
6. Run `npx playwright install chromium`
7. Run `npm start -- profile-site --url <HOME>`
8. If the system asks for them, provide `PLP URL` and `PDP URL`
9. Run `npm start -- scrape --url <HOME> --formats generic,b2c,b2b`
10. Review `output/<domain>/visual-catalog.html`
11. Use `run-summary.json` to confirm the products are valid

## Final decision rule

If a sales engineer or demo owner asks, “Is this a skill or a runnable scraper?”, the correct answer is:

- this repo is the runnable scraper
- this repo also contains a skill that helps replicate or adapt that capability in other repos
