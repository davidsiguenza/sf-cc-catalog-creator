# B2C Export Contract

Keep this contract stable unless the user explicitly asks for a different import shape.

## Required Files

Generate these files inside `salesforce-b2c/`:

- `<brand>-catalog.xml`
- `<brand>-pricebooks.xml`
- `<brand>-inventory.xml`

`<brand>` should be a slug from the detected brand name when possible.

## Catalog Requirements

### Ids and Naming

- `catalog-id` must contain the brand slug.
- `pricebook-id` must contain the brand slug.
- `inventory-list-id` must contain the brand slug.
- Human-readable catalog and pricebook names should also contain the brand.

### Synthetic Categories

Always generate:

- `root`
- `all`

Rules:

- `all` must be a child of `root`.
- Top-level business categories should be children of `root`.
- Every product must be assigned to `all`.

### Category Defaults

For every category:

- `online-flag` = `true`
- `template` element present
- `page-attributes` element present
- custom attribute `showInMenu` = `true`

If a product belongs to a subcategory, also assign it to the parent categories.

### Product Defaults

For every product:

- `online-flag` = `true`
- `available-flag` = `true`
- `searchable-flag` = `true`
- `page-attributes` element present
- `pinterest-enabled-flag` = `false`
- `facebook-enabled-flag` = `false`
- `store-attributes` present with all flags `false`

If categories import but products do not appear in storefront, verify these flags first.

### Product Element Order

Respect the B2C XSD ordering. In particular:

- `<images>` must appear before `<brand>`

If the import complains about `images`, check element ordering before changing the payload.

## Image Settings

Use external image settings when the source storefront already hosts the images.

Rules:

- add `image-settings` to the catalog header
- set the external HTTP and HTTPS base URLs
- include `hi-res` and `large` in view types
- strip the domain from each product image path in the product XML
- emit every image in both `hi-res` and `large` groups

This is required so PDP galleries can render correctly.

## Pricebooks

Generate:

- one pricebook for each original currency found in the scrape
- one mirror USD pricebook unless USD already exists

Rules:

- the USD mirror uses the same numeric values as the original price
- `online-flag` = `true`
- keep pricebook ids brand-aware

## Inventory

Generate a B2C inventory XML with:

- one inventory list
- `default-instock` = `true`
- one record per product
- `<perpetual>true</perpetual>` for every product

## Validation Checklist

Before finishing:

1. Run unit tests.
2. Validate the catalog, pricebook, and inventory XML against the official XSDs when available.
3. Inspect the visual HTML preview to confirm extraction quality.
4. If the import succeeds but the storefront still looks empty, rebuild the search index after import.
