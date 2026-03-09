import { ensureDir, writeTextFile } from "../utils/fs.js";
import { buildCsv } from "../utils/csv.js";

const HEADERS = [
  "product_id",
  "name",
  "description",
  "sku",
  "price",
  "currency",
  "brand",
  "category",
  "subcategory",
  "category_path",
  "all_category_paths",
  "product_url",
  "image_1",
  "image_2",
  "image_3",
  "source_site",
];

export async function exportGenericCsv(products, filePath) {
  const rows = products.map((product) => ({
    product_id: product.productId,
    name: product.name,
    description: product.description,
    sku: product.sku,
    price: product.price,
    currency: product.currency,
    brand: product.brand,
    category: product.category,
    subcategory: product.subcategory,
    category_path: product.categoryPath,
    all_category_paths: product.allCategoryPaths.join(" | "),
    product_url: product.productUrl,
    image_1: product.imageUrls[0] || "",
    image_2: product.imageUrls[1] || "",
    image_3: product.imageUrls[2] || "",
    source_site: product.sourceSite,
  }));

  await ensureDir(filePath, true);
  await writeTextFile(filePath, buildCsv(HEADERS, rows));

  return { label: "CSV generico", path: filePath };
}
