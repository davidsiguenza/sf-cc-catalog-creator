import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(target, isFilePath = false) {
  const directory = isFilePath ? path.dirname(target) : target;
  await fs.mkdir(directory, { recursive: true });
}

export async function writeTextFile(filePath, content) {
  await ensureDir(filePath, true);
  await fs.writeFile(filePath, content, "utf8");
}

export async function writeJsonFile(filePath, value) {
  await writeTextFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

export async function readJsonFile(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}
