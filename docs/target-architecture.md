# Target Architecture For The Catalog Scraper

## Goal

Turn this repo into a reusable engine that can:

- explore an unknown site with `Playwright`
- detect PLPs, PDPs, pagination, and useful data sources
- extract a canonical catalog model
- validate minimum output quality
- export to generic CSV/HTML, Salesforce B2C, and Salesforce B2B

The key idea is to separate three concerns that were previously mixed together:

1. site exploration
2. extraction and normalization
3. export into Salesforce formats

## Current problem

Today the repo works well when the site fits a small set of heuristics:

- categories using patterns such as `/category/`, `/collections/`, `cgid=`
- products using patterns such as `/p/`, `/product/`, `pid=`
- very specific DOM selectors

That means `Playwright` is mostly used as a browser, not as a recognition engine. The most fragile logic used to be coupled inside:

- `src/config.js`
- `src/storefront.js`
- `src/scraper.js`

The result is that each new site can force new regexes, selectors, or special-case branches.

## Design principle

Do not try to build a “universal scraper” by endlessly adding more fixed regexes.

The architecture should instead be:

- `Playwright` for recognition and acquisition
- a canonical intermediate model for product/category data
- deterministic exporters for B2C and B2B
- per-site profiles that persist what the system learned
- platform strategies when repeatable patterns exist
- progressive user help when fully automatic discovery does not reach minimum quality

## Target flow

```text
Entry URL
  -> site exploration with Playwright
  -> page classification (home, PLP, PDP, search, cart)
  -> data source detection (JSON-LD, DOM, API/XHR, hydration data)
  -> extraction into canonical model
  -> quality validation
  -> if context is missing, ask the user for a PLP/PDP
  -> persist a site profile
  -> exporters (generic CSV, HTML, B2C XML, B2B CSV)
```

## Progressive assistance

The system should always try `100% automatic` mode first.

If it cannot find PLPs, cannot reach PDPs, or the output quality drops below the minimum threshold, it should return a concrete request for help instead of failing opaquely.

Examples:

- if it cannot find PLPs, request a `PLP URL`
- if it finds a PLP but not reliable product data, request a `PDP URL`
- if the profile is still ambiguous, optionally request a `Search URL`

The help should be minimal and useful: ask only for the input that unlocks the next attempt.

## Proposed structure

```text
src/
  cli/
    commands/
      scrape.js
      profile-site.js
      validate-profile.js
  core/
    models/
      category.js
      product.js
      catalog.js
    normalize/
      product.js
      category.js
      price.js
      images.js
    validate/
      catalog.js
      product.js
  browser/
    session.js
    navigation.js
    snapshots.js
    network.js
  discovery/
    site-explorer.js
    page-classifier.js
    url-scoring.js
    pagination.js
    link-harvester.js
  extraction/
    pipeline.js
    plp-extractor.js
    pdp-extractor.js
    structured-data.js
    dom-extractor.js
    network-extractor.js
  platforms/
    detector.js
    generic/
      strategy.js
    shopify/
      strategy.js
    sfcc/
      strategy.js
    magento/
      strategy.js
    legacy-aspnet-store/
      strategy.js
  site-profiles/
    schema.js
    loader.js
    merger.js
    scorer.js
  exporters/
    generic-csv.js
    visual-html.js
    salesforce-b2c.js
    salesforce-b2b.js
  utils/
    csv.js
    fs.js
    html.js
    text.js
    url.js
    xml.js
profiles/
  eu.salesforcestore.com.json
  example.com.json
skills/
  salesforce-commerce-catalog-builder/
    SKILL.md
test/
  fixtures/
  discovery/
  extraction/
  exporters/
docs/
  target-architecture.md
```

## Layer responsibilities

### `cli/`

Public commands for the project.

- `scrape`: run a full extraction using an existing profile or generic mode
- `profile-site`: explore a new site and propose or generate a profile
- `validate-profile`: check whether an existing profile is still valid

`profile-site` should accept optional helper URLs when the user has them:

- `--home-url`
- `--plp-url`
- `--search-url`
- `--pdp-url`

That matters because it reduces blind exploration and improves first-pass pattern detection.

### `browser/`

Encapsulates `Playwright`.

- browser/context/page creation
- robust navigation
- request/response capture
- useful snapshots for debugging

This layer should not decide whether a page is a PLP or PDP. It should only expose stable primitives.

### `discovery/`

Site recognition.

- find relevant links
- classify pages
- score candidate URLs
- detect pagination
- choose PLP/PDP samples for analysis

This is where logic like “this looks like a category” or “this looks like a product” should live, but based on scoring rather than binary `if` statements.

### `extraction/`

Builds the canonical model.

Recommended source order:

1. JSON-LD / microdata
2. network or hydration data
3. visible DOM

Each extractor should return a partial structure plus a confidence score. The pipeline merges them.

### `platforms/`

Special handling for known storefront families.

Examples:

- Shopify
- SFCC
- Magento
- legacy ASP.NET stores such as `-C2.aspx` and `-P1532.aspx`

These strategies should not rewrite the whole engine. They should only adjust discovery and extraction when the platform has clear signals.

### `site-profiles/`

Persistent memory per domain.

This is where the system stores what it learned during the first exploration of a site.

Examples of stored content:

- category and product URL patterns
- PLP/PDP selectors
- preferred strategies for price, images, and description
- pagination hints
- detected platform
- confidence level

### `core/`

Internal contract of the system.

This is the stable center of the repo. Everything extracted should flow through this layer before export.

## Minimum canonical model

```js
{
  productId: "",
  sku: "",
  name: "",
  description: "",
  brand: "",
  price: "",
  currency: "",
  imageUrls: [],
  productUrl: "",
  categoryPath: "",
  categoryTrail: [],
  allCategoryPaths: [],
  sourceSite: "",
  sourceType: "",
  sourceConfidence: 0,
  rawSignals: {
    jsonld: false,
    dom: false,
    network: false
  }
}
```

This model is the source of truth. B2C and B2B exports should be generated from here, not directly from raw scraping output.

## What belongs in the skill vs the repo

This distinction matters.

### The repo should contain

- the runtime CLI
- extraction and normalization logic
- exporters
- tests
- profiles and profile loaders
- validation

### The skill should contain

- the workflow for how an agent should apply the system to a new repo
- guidance on when to ask for helper URLs
- guidance on how to bootstrap a standalone version
- references to the maintained runtime or template

The skill should orchestrate the process. The stable logic should live in code.

## Migration direction

The current refactor path is:

1. move normalization and validation into `core/`
2. separate browser/discovery/extraction concerns
3. add persistent `profiles/`
4. add `profile-site`
5. add platform-specific strategies
6. keep the skill template synchronized with the main runtime

## Success criteria

The architecture is working when:

- most sites succeed with no manual input
- ambiguous sites ask for a PLP/PDP instead of failing silently
- a successful run creates reusable site memory
- B2C and B2B exports are generated from a stable canonical model
- the skill can reproduce the workflow in another workspace without inventing a different system
