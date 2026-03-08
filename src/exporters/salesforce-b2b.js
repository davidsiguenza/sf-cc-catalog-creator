import path from "node:path";

import { buildCsv } from "../utils/csv.js";
import { ensureDir, writeTextFile } from "../utils/fs.js";

const HEADERS = [
  "Product Name",
  "Product SKU",
  "Product Description",
  "Category Name Path",
  "Price Book Name",
  "Price Book Entry Name",
  "List Price",
  "Currency ISO Code",
  "Product Status",
  "Primary Image URL",
  "Secondary Image URL",
  "Tertiary Image URL",
  "External ID",
  "Product URL",
];

export async function exportB2BCommerceCsv(products, options, outputDir) {
  await ensureDir(outputDir);
  const filePath = path.join(outputDir, "commerce-import.csv");

  const rows = products.map((product) => ({
    "Product Name": product.name,
    "Product SKU": product.sku || product.productId,
    "Product Description": product.description,
    "Category Name Path": product.categoryPath,
    "Price Book Name": options.pricebookName,
    "Price Book Entry Name": product.name,
    "List Price": product.price,
    "Currency ISO Code": product.currency || options.currency,
    "Product Status": "Active",
    "Primary Image URL": product.imageUrls[0] || "",
    "Secondary Image URL": product.imageUrls[1] || "",
    "Tertiary Image URL": product.imageUrls[2] || "",
    "External ID": product.productId,
    "Product URL": product.productUrl,
  }));

  await writeTextFile(filePath, buildCsv(HEADERS, rows));
  return { label: "B2B commerce CSV", path: filePath };
}
