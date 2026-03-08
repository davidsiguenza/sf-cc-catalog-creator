# Target Project Setup

Use this checklist when applying the skill to a new repository.

## Required Runtime

The skill is only procedural knowledge. It does not embed the Playwright package or browser binaries into the destination repo automatically unless the agent installs them there.

Minimum assumptions:

- Node.js 20+
- a package manager available in the target repo
- Playwright installed in the target repo
- Chromium browser runtime installed

## Commands

For npm-based repos:

```bash
npm install playwright
npx playwright install chromium
```

If the repo uses `pnpm` or `yarn`, install the dependency with that package manager, but keep the browser install step:

```bash
npx playwright install chromium
```

## Expected Outcome

After setup, the target repo should be able to:

- launch Chromium from Playwright
- navigate dynamic storefront pages
- extract categories and product details
- export B2C, B2B, CSV, and visual HTML outputs

## Documentation Guidance

When porting this workflow into another repo, document these prerequisites explicitly in that repo's README:

1. how to install project dependencies
2. how to install Playwright
3. how to install Chromium
4. how to run the scraper
5. where the generated files will appear
