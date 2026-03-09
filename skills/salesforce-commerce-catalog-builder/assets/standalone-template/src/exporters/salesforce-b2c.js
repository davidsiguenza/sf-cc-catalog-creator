import path from "node:path";

import { ensureDir, writeTextFile } from "../utils/fs.js";
import { buildCategoryTree } from "../utils/products.js";
import { normalizeLookupValue, slugify } from "../utils/text.js";
import { xmlAttr, xmlEscape } from "../utils/xml.js";

export async function exportB2CCommerceXml(products, options, outputDir) {
  await ensureDir(outputDir);

  const context = buildB2CContext(products, options);
  const catalogPath = path.join(outputDir, `${context.brandSlug}-catalog.xml`);
  const pricebookPath = path.join(outputDir, `${context.brandSlug}-pricebooks.xml`);
  const inventoryPath = path.join(outputDir, `${context.brandSlug}-inventory.xml`);

  await writeTextFile(catalogPath, buildCatalogXml(products, context));
  await writeTextFile(pricebookPath, buildPricebooksXml(products, context));
  await writeTextFile(inventoryPath, buildInventoryXml(products, context));

  return [
    { label: "B2C catalog.xml", path: catalogPath },
    { label: "B2C pricebooks.xml", path: pricebookPath },
    { label: "B2C inventory.xml", path: inventoryPath },
  ];
}

function buildCatalogXml(products, context) {
  const categoryTree = buildCategoryTree(products);
  const categoryNodes = [...buildSyntheticCategories(), ...Array.from(categoryTree.values())]
    .sort((left, right) => left.depth - right.depth || left.id.localeCompare(right.id))
    .map((category) => renderCategory(category, context))
    .join("\n");

  const productNodes = products.map((product) => renderProduct(product)).join("\n");
  const categoryAssignments = products.flatMap((product) => renderCategoryAssignments(product, categoryTree)).join("\n");
  const header = renderHeader(context);

  return `<?xml version="1.0" encoding="UTF-8"?>
<catalog xmlns="http://www.demandware.com/xml/impex/catalog/2006-10-31" catalog-id="${xmlAttr(
    context.catalogId,
  )}">
${indent(header, 2)}
${indent(categoryNodes, 2)}
${indent(productNodes, 2)}
${indent(categoryAssignments, 2)}
</catalog>
`;
}

function buildPricebooksXml(products, context) {
  const originalCurrencies = Array.from(
    new Set(products.map((product) => product.currency || context.currency).filter(Boolean)),
  );
  const pricebookCurrencies = Array.from(new Set([...originalCurrencies, ...context.mirrorCurrencies]));
  const pricebooks = pricebookCurrencies
    .map((currency) => {
      const items =
        originalCurrencies.includes(currency) && currency !== "USD"
          ? products.filter((product) => (product.currency || context.currency) === currency)
          : products;
      const priceTables = items
        .filter((product) => product.price)
        .map(
          (product) => `      <price-table product-id="${xmlAttr(product.productId)}">
        <amount quantity="1">${xmlEscape(product.price)}</amount>
      </price-table>`,
        )
        .join("\n");

      return `  <pricebook>
    <header pricebook-id="${xmlAttr(`${context.pricebookId}-${currency.toLowerCase()}`)}">
      <currency>${xmlEscape(currency)}</currency>
      <display-name xml:lang="${xmlAttr(context.lang)}">${xmlEscape(
        `${context.pricebookName} ${currency}`,
      )}</display-name>
      <description xml:lang="${xmlAttr(context.lang)}">${xmlEscape(
        `Pricebook generado desde ${context.entryUrl}`,
      )}</description>
      <online-flag>true</online-flag>
      <feed-based>false</feed-based>
    </header>
    <price-tables>
${priceTables}
    </price-tables>
  </pricebook>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<pricebooks xmlns="http://www.demandware.com/xml/impex/pricebook/2006-10-31">
${pricebooks}
</pricebooks>
`;
}

function buildInventoryXml(products, context) {
  const records = products
    .map(
      (product) => `      <record product-id="${xmlAttr(product.productId)}">
        <perpetual>true</perpetual>
      </record>`,
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<inventory xmlns="http://www.demandware.com/xml/impex/inventory/2007-05-31">
  <inventory-list>
    <header list-id="${xmlAttr(context.inventoryListId)}">
      <default-instock>true</default-instock>
      <description>${xmlEscape(`Inventario perpetuo generado para ${context.brandName}`)}</description>
      <use-bundle-inventory-only>false</use-bundle-inventory-only>
      <on-order>false</on-order>
    </header>
    <records>
${records}
    </records>
  </inventory-list>
</inventory>
`;
}

function renderCategory(category) {
  const effectiveParentId = category.parentId || (category.id !== "root" ? "root" : "");
  const parent = effectiveParentId ? `\n    <parent>${xmlEscape(effectiveParentId)}</parent>` : "";
  const showInMenu = `\n    <custom-attributes>\n      <custom-attribute attribute-id="showInMenu">true</custom-attribute>\n    </custom-attributes>`;
  const template = "\n    <template />";
  const pageAttributes = "\n    <page-attributes />";

  return `<category category-id="${xmlAttr(category.id)}">
    <display-name xml:lang="x-default">${xmlEscape(category.name)}</display-name>
    <description xml:lang="x-default">${xmlEscape(category.path.join(" > "))}</description>
    <online-flag>true</online-flag>${parent}${template}${pageAttributes}${showInMenu}
  </category>`;
}

function renderProduct(product) {
  const images = product.imageUrls.length
    ? `\n    <images>\n${renderImageGroups(product)}\n    </images>`
    : "";

  const brand = product.brand ? `\n    <brand>${xmlEscape(product.brand)}</brand>` : "";

  return `<product product-id="${xmlAttr(product.productId)}">
    <display-name xml:lang="x-default">${xmlEscape(product.name)}</display-name>
    <short-description xml:lang="x-default">${xmlEscape(product.description || product.name)}</short-description>
    <long-description xml:lang="x-default">${xmlEscape(product.description || product.name)}</long-description>
    <online-flag>true</online-flag>
    <available-flag>true</available-flag>
    <searchable-flag>true</searchable-flag>${images}${brand}
    <page-attributes />
    <pinterest-enabled-flag>false</pinterest-enabled-flag>
    <facebook-enabled-flag>false</facebook-enabled-flag>
    <store-attributes>
      <force-price-flag>false</force-price-flag>
      <non-inventory-flag>false</non-inventory-flag>
      <non-revenue-flag>false</non-revenue-flag>
      <non-discountable-flag>false</non-discountable-flag>
    </store-attributes>
  </product>`;
}

function renderCategoryAssignments(product, categoryTree) {
  const primaryLeafPath =
    product.categoryPath && product.allCategoryPaths.includes(product.categoryPath)
      ? product.categoryPath
      : product.allCategoryPaths[0];
  const leafPaths = Array.from(
    new Set([primaryLeafPath, ...product.allCategoryPaths].filter(Boolean)),
  );
  const assignmentPaths = [];

  for (const leafPath of leafPaths) {
    assignmentPaths.push(leafPath);

    const segments = leafPath
      .split(">")
      .map((segment) => segment.trim())
      .filter(Boolean);

    for (let index = 1; index < segments.length; index += 1) {
      assignmentPaths.push(segments.slice(0, index).join(" > "));
    }
  }

  const uniqueAssignments = Array.from(new Set(["All Products", ...assignmentPaths]));

  return uniqueAssignments
    .map((pathValue) => ({ pathValue, category: resolveAssignmentCategory(pathValue, categoryTree) }))
    .filter(({ category }) => Boolean(category))
    .map(
      ({ pathValue, category }) => `<category-assignment category-id="${xmlAttr(category.id)}" product-id="${xmlAttr(
        product.productId,
      )}">
    <primary-flag>${pathValue === primaryLeafPath || (pathValue === "All Products" && !primaryLeafPath) ? "true" : "false"}</primary-flag>
  </category-assignment>`,
    );
}

function resolveAssignmentCategory(pathValue, categoryTree) {
  if (pathValue === "All Products") {
    return { id: "all" };
  }

  return categoryTree.get(pathValue);
}

function indent(value, spaces) {
  if (!value) {
    return "";
  }

  const prefix = " ".repeat(spaces);
  return value
    .split("\n")
    .map((line) => `${prefix}${line}`)
    .join("\n");
}

function buildB2CContext(products, options) {
  const brandName = resolveBrandName(products) || "Brand";
  const brandSlug = slugify(brandName) || "brand";
  const imageSettings = resolveImageSettings(products);
  const originalCurrencies = Array.from(
    new Set(products.map((product) => product.currency || options.currency).filter(Boolean)),
  );

  return {
    ...options,
    brandName,
    brandSlug,
    catalogId: ensureIdContainsBrand(options.catalogId || "catalog", brandSlug),
    pricebookId: ensureIdContainsBrand(options.pricebookId || "pricebook", brandSlug),
    inventoryListId: ensureIdContainsBrand(options.inventoryListId || "inventory-list", brandSlug),
    pricebookName: ensureNameContainsBrand(options.pricebookName || "Price Book", brandName),
    mirrorCurrencies: originalCurrencies.includes("USD") ? [] : ["USD"],
    imageSettings,
  };
}

function buildSyntheticCategories() {
  return [
    {
      id: "root",
      name: "Root",
      path: ["Root"],
      depth: 0,
      parentId: "",
    },
    {
      id: "all",
      name: "All Products",
      path: ["All Products"],
      depth: 1,
      parentId: "root",
    },
  ];
}

function renderHeader(context) {
  if (!context.imageSettings) {
    return "<header />";
  }

  return `<header>
    <image-settings>
      <external-location>
        <http-url>${xmlEscape(context.imageSettings.httpUrl)}</http-url>
        <https-url>${xmlEscape(context.imageSettings.httpsUrl)}</https-url>
      </external-location>
      <view-types>
        <view-type>hi-res</view-type>
        <view-type>large</view-type>
        <view-type>medium</view-type>
        <view-type>small</view-type>
      </view-types>
      <alt-pattern>${xmlEscape("${productname}")}</alt-pattern>
      <title-pattern>${xmlEscape("${productname}")}</title-pattern>
    </image-settings>
  </header>`;
}

function resolveBrandName(products) {
  return products.map((product) => product.brand).find(Boolean) || "";
}

function ensureIdContainsBrand(value, brandSlug) {
  const normalized = slugify(value) || "catalog";

  if (!brandSlug || normalized.includes(brandSlug)) {
    return normalized;
  }

  return `${brandSlug}-${normalized}`;
}

function ensureNameContainsBrand(value, brandName) {
  if (!brandName) {
    return value;
  }

  if (normalizeLookupValue(value).includes(normalizeLookupValue(brandName))) {
    return value;
  }

  return `${brandName} ${value}`.trim();
}

function resolveImageSettings(products) {
  const imageUrl = products.flatMap((product) => product.imageUrls || []).find(Boolean);

  if (!imageUrl) {
    return null;
  }

  const parsed = new URL(imageUrl);
  const sharedPath = parsed.pathname.includes("/is/image/")
    ? "/is/image/"
    : ensureTrailingSlash(getSharedImageDirectory(products, parsed.origin));

  const httpsUrl = `${parsed.origin}${sharedPath}`;
  const httpUrl = `http://${parsed.host}${sharedPath}`;

  return {
    httpUrl,
    httpsUrl,
  };
}

function getSharedImageDirectory(products, origin) {
  const pathnames = products
    .flatMap((product) => product.imageUrls || [])
    .filter(Boolean)
    .map((imageUrl) => {
      const parsed = new URL(imageUrl);
      return parsed.origin === origin ? parsed.pathname : null;
    })
    .filter(Boolean);

  if (!pathnames.length) {
    return "/";
  }

  const commonPrefix = pathnames.reduce((prefix, pathname) => longestCommonPrefix(prefix, pathname));
  const lastSlashIndex = commonPrefix.lastIndexOf("/");

  if (lastSlashIndex <= 0) {
    return "/";
  }

  return commonPrefix.slice(0, lastSlashIndex + 1);
}

function longestCommonPrefix(left, right) {
  let index = 0;

  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }

  return left.slice(0, index);
}

function ensureTrailingSlash(value) {
  return value.endsWith("/") ? value : `${value}/`;
}

function resolveImagePath(imageUrl) {
  const parsed = new URL(imageUrl);

  if (parsed.pathname.includes("/is/image/")) {
    return `${parsed.pathname.split("/is/image/")[1] || ""}${parsed.search}`;
  }

  return `${parsed.pathname.replace(/^\/+/, "")}${parsed.search}`;
}

function renderImageGroups(product) {
  const imageNodes = product.imageUrls
    .map(
      (imageUrl) => `        <image path="${xmlAttr(resolveImagePath(imageUrl))}">
          <alt xml:lang="x-default">${xmlEscape(product.name)}</alt>
          <title xml:lang="x-default">${xmlEscape(product.name)}</title>
        </image>`,
    )
    .join("\n");

  return ["hi-res", "large"]
    .map(
      (viewType) => `      <image-group view-type="${viewType}">
${imageNodes}
      </image-group>`,
    )
    .join("\n");
}
