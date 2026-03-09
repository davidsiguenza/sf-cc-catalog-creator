import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { exportB2BCommerceCsv } from "../src/exporters/salesforce-b2b.js";
import { exportB2CCommerceXml } from "../src/exporters/salesforce-b2c.js";
import { exportGenericCsv } from "../src/exporters/generic-csv.js";
import { exportVisualHtml } from "../src/exporters/visual-html.js";

const sampleProducts = [
  {
    productId: "sku-red-shoe",
    name: "Red Shoe",
    description: "Comfortable red running shoe",
    sku: "SKU-RED-SHOE",
    price: "129.99",
    currency: "EUR",
    brand: "Acme",
    productUrl: "https://shop.example.com/p/red-shoe",
    category: "Men",
    subcategory: "Shoes",
    categoryPath: "Men > Shoes",
    categoryTrail: ["Men", "Shoes"],
    allCategoryPaths: ["Men > Shoes", "Sale > Shoes"],
    imageUrls: [
      "https://cdn.example.com/is/image/red-shoe-1.jpg",
      "https://cdn.example.com/is/image/red-shoe-2.jpg",
    ],
    sourceSite: "https://shop.example.com",
  },
];

const options = {
  entryUrl: "https://shop.example.com",
  pricebookId: "demo-pricebook",
  pricebookName: "Demo Price Book",
  catalogId: "demo-catalog",
  currency: "USD",
  lang: "x-default",
};

test("exporta CSV generico con columnas clave", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-generic-"));
  const file = path.join(directory, "generic-products.csv");

  await exportGenericCsv(sampleProducts, file);

  const content = await fs.readFile(file, "utf8");
  assert.match(content, /product_id,name,description,sku,price/);
  assert.match(content, /Red Shoe/);
  assert.match(content, /SKU-RED-SHOE/);
  assert.match(content, /https:\/\/cdn\.example\.com\/is\/image\/red-shoe-1\.jpg/);
});

test("exporta XML B2C bien formado", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-b2c-"));
  const files = await exportB2CCommerceXml(sampleProducts, options, directory);

  const catalogFile = files.find((file) => file.path.endsWith("catalog.xml")).path;
  const pricebookFile = files.find((file) => file.path.endsWith("pricebooks.xml")).path;
  const inventoryFile = files.find((file) => file.path.endsWith("inventory.xml")).path;

  const catalogValidation = spawnSync("xmllint", ["--noout", catalogFile], { encoding: "utf8" });
  const pricebookValidation = spawnSync("xmllint", ["--noout", pricebookFile], { encoding: "utf8" });
  const inventoryValidation = spawnSync("xmllint", ["--noout", inventoryFile], { encoding: "utf8" });

  assert.equal(catalogValidation.status, 0, catalogValidation.stderr);
  assert.equal(pricebookValidation.status, 0, pricebookValidation.stderr);
  assert.equal(inventoryValidation.status, 0, inventoryValidation.stderr);
  assert.match(catalogFile, /acme-catalog\.xml$/);
  assert.match(pricebookFile, /acme-pricebooks\.xml$/);
  assert.match(inventoryFile, /acme-inventory\.xml$/);

  const catalogContent = await fs.readFile(catalogFile, "utf8");
  const pricebookContent = await fs.readFile(pricebookFile, "utf8");
  const inventoryContent = await fs.readFile(inventoryFile, "utf8");

  assert.match(catalogContent, /catalog-id="acme-demo-catalog"/);
  assert.match(catalogContent, /<category category-id="root">/);
  assert.match(catalogContent, /<category category-id="all">/);
  assert.match(catalogContent, /<category category-id="men"/);
  assert.match(catalogContent, /<parent>root<\/parent>/);
  assert.match(catalogContent, /<category-assignment category-id="men-shoes" product-id="sku-red-shoe">/);
  assert.match(catalogContent, /<category-assignment category-id="men" product-id="sku-red-shoe">/);
  assert.match(catalogContent, /<category-assignment category-id="all" product-id="sku-red-shoe">/);
  assert.match(catalogContent, /<custom-attribute attribute-id="showInMenu">true<\/custom-attribute>/);
  assert.match(catalogContent, /<https-url>https:\/\/cdn\.example\.com\/is\/image\/<\/https-url>/);
  assert.match(catalogContent, /<view-type>hi-res<\/view-type>/);
  assert.match(catalogContent, /<available-flag>true<\/available-flag>/);
  assert.match(catalogContent, /<online-flag>true<\/online-flag>/);
  assert.match(catalogContent, /<searchable-flag>true<\/searchable-flag>/);
  assert.match(catalogContent, /<page-attributes \/>/);
  assert.match(catalogContent, /<store-attributes>/);
  assert.match(catalogContent, /<image-group view-type="hi-res">/);
  assert.match(catalogContent, /<image-group view-type="large">/);
  assert.match(catalogContent, /<image-group view-type="hi-res">[\s\S]*<image path="red-shoe-1\.jpg">/);
  assert.match(catalogContent, /<image-group view-type="large">[\s\S]*<image path="red-shoe-1\.jpg">/);
  assert.match(pricebookContent, /<pricebooks /);
  assert.match(pricebookContent, /pricebook-id="acme-demo-pricebook-eur"/);
  assert.match(pricebookContent, /pricebook-id="acme-demo-pricebook-usd"/);
  assert.match(pricebookContent, /<display-name xml:lang="x-default">Acme Demo Price Book EUR<\/display-name>/);
  assert.match(pricebookContent, /<display-name xml:lang="x-default">Acme Demo Price Book USD<\/display-name>/);
  assert.match(pricebookContent, /<currency>USD<\/currency>/);
  assert.match(inventoryContent, /<inventory /);
  assert.match(inventoryContent, /list-id="acme-inventory-list"/);
  assert.match(inventoryContent, /<default-instock>true<\/default-instock>/);
  assert.match(inventoryContent, /<record product-id="sku-red-shoe">/);
  assert.match(inventoryContent, /<perpetual>true<\/perpetual>/);

  assert.ok(catalogContent.indexOf("<images>") < catalogContent.indexOf("<brand>"));
});

test("exporta CSV B2B con campos de producto, categoria y precio", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-b2b-"));
  const output = await exportB2BCommerceCsv(sampleProducts, options, directory);
  const content = await fs.readFile(output.path, "utf8");

  assert.match(content, /Product Name,Product SKU,Product Description,Category Name Path/);
  assert.match(content, /Red Shoe/);
  assert.match(content, /Men > Shoes/);
  assert.match(content, /129\.99/);
});

test("exporta HTML visual con tarjetas de producto", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "catalog-html-"));
  const output = await exportVisualHtml(
    sampleProducts,
    { summary: { categoriesProcessed: 2 }, warnings: [] },
    options,
    directory,
  );
  const content = await fs.readFile(output.path, "utf8");

  assert.match(content, /Catalogo visual/);
  assert.match(content, /Red Shoe/);
  assert.match(content, /SKU-RED-SHOE/);
  assert.match(content, /Men &gt; Shoes|Men > Shoes/);
});
