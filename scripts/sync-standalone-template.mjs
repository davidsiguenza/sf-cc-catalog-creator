import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const templateRoot = path.join(
  repoRoot,
  "skills",
  "salesforce-commerce-catalog-builder",
  "assets",
  "standalone-template",
);

const DIRECTORY_SYNC = ["src", "test"];
const FILE_SYNC = [
  ".gitignore",
  "package.json",
  "package-lock.json",
  "site-config.example.json",
  "site-config.nnormal.es_ES.json",
];

await assertTemplateRoot(templateRoot);

for (const relativePath of DIRECTORY_SYNC) {
  await replaceDirectory(path.join(repoRoot, relativePath), path.join(templateRoot, relativePath));
}

for (const relativePath of FILE_SYNC) {
  await copyFile(path.join(repoRoot, relativePath), path.join(templateRoot, relativePath));
}

console.log(`Standalone template sincronizada en ${templateRoot}`);

async function replaceDirectory(sourceDir, destinationDir) {
  await fs.rm(destinationDir, { recursive: true, force: true });
  await fs.mkdir(path.dirname(destinationDir), { recursive: true });
  await copyDirectory(sourceDir, destinationDir);
}

async function copyDirectory(sourceDir, destinationDir) {
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  await fs.mkdir(destinationDir, { recursive: true });

  for (const entry of entries) {
    if (shouldSkipEntry(entry.name)) {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const destinationPath = path.join(destinationDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
}

async function copyFile(sourcePath, destinationPath) {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
}

async function assertTemplateRoot(target) {
  const stat = await fs.stat(target).catch(() => null);

  if (!stat?.isDirectory()) {
    throw new Error(`No existe la plantilla standalone en ${target}`);
  }
}

function shouldSkipEntry(name) {
  return name === ".DS_Store";
}
