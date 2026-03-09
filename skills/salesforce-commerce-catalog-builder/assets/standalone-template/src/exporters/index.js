import path from "node:path";

import { exportB2BCommerceCsv } from "./salesforce-b2b.js";
import { exportB2CCommerceXml } from "./salesforce-b2c.js";
import { exportGenericCsv } from "./generic-csv.js";
import { exportVisualHtml } from "./visual-html.js";

export async function exportAll(scrapeResult, options, outputDir) {
  const files = [await exportVisualHtml(scrapeResult.products, scrapeResult, options, outputDir)];

  if (options.formats.includes("generic")) {
    files.push(await exportGenericCsv(scrapeResult.products, path.join(outputDir, "generic-products.csv")));
  }

  if (options.formats.includes("b2c")) {
    files.push(...(await exportB2CCommerceXml(scrapeResult.products, options, path.join(outputDir, "salesforce-b2c"))));
  }

  if (options.formats.includes("b2b")) {
    files.push(await exportB2BCommerceCsv(scrapeResult.products, options, path.join(outputDir, "salesforce-b2b")));
  }

  return files;
}
