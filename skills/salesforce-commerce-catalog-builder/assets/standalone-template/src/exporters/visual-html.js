import path from "node:path";

import { ensureDir, writeTextFile } from "../utils/fs.js";
import { escapeHtml } from "../utils/html.js";

export async function exportVisualHtml(products, scrapeResult, options, outputDir) {
  await ensureDir(outputDir);
  const filePath = path.join(outputDir, "visual-catalog.html");

  const categories = Array.from(
    new Set(products.map((product) => product.categoryPath).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));

  const html = `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Catalogo visual - ${escapeHtml(options.storeSlug || "store")}</title>
    <style>
      :root {
        --bg: #f3f1eb;
        --panel: #fffdf8;
        --ink: #16130f;
        --muted: #6a6258;
        --line: #ddd6cb;
        --accent: #111111;
        --accent-2: #d7ec7f;
        --chip: #ece7df;
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        background:
          radial-gradient(circle at top left, rgba(215, 236, 127, 0.35), transparent 30%),
          linear-gradient(180deg, #f6f4ee 0%, #ece7de 100%);
        color: var(--ink);
      }

      .shell {
        width: min(1400px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 24px 0 48px;
      }

      .hero {
        background: linear-gradient(135deg, rgba(17,17,17,0.98), rgba(39,34,28,0.95));
        color: #f7f4ef;
        border-radius: 28px;
        padding: 28px;
        box-shadow: 0 24px 60px rgba(34, 24, 12, 0.18);
      }

      .hero h1 {
        margin: 0;
        font-size: clamp(2rem, 4vw, 4rem);
        line-height: 0.95;
        letter-spacing: -0.04em;
      }

      .hero p {
        margin: 14px 0 0;
        max-width: 800px;
        color: rgba(247, 244, 239, 0.78);
        font-size: 1rem;
      }

      .stats {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
        margin-top: 20px;
      }

      .stat {
        min-width: 120px;
        padding: 14px 16px;
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
      }

      .stat strong {
        display: block;
        font-size: 1.4rem;
      }

      .controls {
        margin: 22px 0 18px;
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 12px;
      }

      .input, .select {
        width: 100%;
        border: 1px solid var(--line);
        background: rgba(255,255,255,0.82);
        color: var(--ink);
        border-radius: 16px;
        padding: 14px 16px;
        font-size: 0.95rem;
        outline: none;
      }

      .input:focus, .select:focus {
        border-color: #8f9e42;
        box-shadow: 0 0 0 4px rgba(215, 236, 127, 0.35);
      }

      .meta {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        margin: 8px 2px 18px;
        color: var(--muted);
        font-size: 0.92rem;
      }

      .grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
        gap: 18px;
      }

      .card {
        background: var(--panel);
        border: 1px solid rgba(0,0,0,0.08);
        border-radius: 22px;
        overflow: hidden;
        box-shadow: 0 14px 36px rgba(49, 38, 26, 0.08);
      }

      .image-wrap {
        aspect-ratio: 1 / 1;
        background: linear-gradient(180deg, #faf7f0, #ede6dc);
        overflow: hidden;
      }

      .image-wrap img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .body {
        padding: 16px;
      }

      .topline {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: flex-start;
      }

      .title {
        margin: 0;
        font-size: 1.1rem;
        line-height: 1.1;
      }

      .price {
        white-space: nowrap;
        font-size: 1.15rem;
        font-weight: bold;
      }

      .chips {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 12px 0;
      }

      .chip {
        background: var(--chip);
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 0.76rem;
        color: var(--muted);
      }

      .desc {
        font-size: 0.92rem;
        line-height: 1.45;
        color: #3d352d;
        margin: 0 0 14px;
      }

      .thumbs {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
        margin-bottom: 14px;
      }

      .thumbs img {
        width: 100%;
        aspect-ratio: 1 / 1;
        object-fit: cover;
        border-radius: 12px;
        border: 1px solid rgba(0,0,0,0.08);
        background: #f6f1e8;
      }

      .actions {
        display: flex;
        gap: 8px;
      }

      .actions a {
        flex: 1;
        text-align: center;
        text-decoration: none;
        border-radius: 12px;
        padding: 10px 12px;
        font-size: 0.84rem;
      }

      .primary {
        background: var(--accent);
        color: white;
      }

      .secondary {
        background: transparent;
        color: var(--ink);
        border: 1px solid var(--line);
      }

      .empty {
        display: none;
        padding: 28px;
        text-align: center;
        border: 1px dashed var(--line);
        border-radius: 20px;
        background: rgba(255,255,255,0.5);
      }

      @media (max-width: 780px) {
        .controls { grid-template-columns: 1fr; }
        .shell { width: min(100vw - 20px, 1400px); }
        .hero { padding: 22px; border-radius: 22px; }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <section class="hero">
        <h1>Catalogo visual</h1>
        <p>${escapeHtml(options.entryUrl)}. Revisión rápida del contenido extraído para validar nombre, SKU, precio, categoría e imágenes antes de transformar el catálogo.</p>
        <div class="stats">
          <div class="stat"><strong>${products.length}</strong><span>productos</span></div>
          <div class="stat"><strong>${scrapeResult.summary.categoriesProcessed}</strong><span>categorías</span></div>
          <div class="stat"><strong>${categories.length}</strong><span>rutas de categoría</span></div>
          <div class="stat"><strong>${scrapeResult.warnings.length}</strong><span>advertencias</span></div>
        </div>
      </section>

      <section class="controls">
        <input id="search" class="input" type="search" placeholder="Buscar por nombre, SKU o descripción" />
        <select id="category" class="select">
          <option value="">Todas las categorías</option>
          ${categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("")}
        </select>
      </section>

      <div class="meta">
        <div id="counter">${products.length} productos visibles</div>
        <div>Actualizado: ${escapeHtml(new Date().toLocaleString("es-ES"))}</div>
      </div>

      <div id="grid" class="grid">
        ${products.map((product, index) => renderCard(product, index)).join("\n")}
      </div>

      <div id="empty" class="empty">No hay productos que coincidan con el filtro actual.</div>
    </div>

    <script>
      const searchInput = document.getElementById("search");
      const categorySelect = document.getElementById("category");
      const cards = Array.from(document.querySelectorAll(".card"));
      const counter = document.getElementById("counter");
      const empty = document.getElementById("empty");

      const applyFilters = () => {
        const query = searchInput.value.trim().toLowerCase();
        const category = categorySelect.value;
        let visible = 0;

        for (const card of cards) {
          const haystack = card.dataset.search;
          const cardCategory = card.dataset.category;
          const matchesQuery = !query || haystack.includes(query);
          const matchesCategory = !category || cardCategory === category;
          const show = matchesQuery && matchesCategory;
          card.style.display = show ? "" : "none";
          if (show) visible += 1;
        }

        counter.textContent = visible + " productos visibles";
        empty.style.display = visible ? "none" : "block";
      };

      searchInput.addEventListener("input", applyFilters);
      categorySelect.addEventListener("change", applyFilters);
    </script>
  </body>
</html>
`;

  await writeTextFile(filePath, html);
  return { label: "HTML visual", path: filePath };
}

function renderCard(product, index) {
  const search = [
    product.name,
    product.sku,
    product.description,
    product.categoryPath,
    product.brand,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const thumbs = product.imageUrls
    .slice(0, 3)
    .map(
      (imageUrl, thumbIndex) =>
        `<img loading="lazy" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(`${product.name} imagen ${thumbIndex + 1}`)}" />`,
    )
    .join("");

  return `<article class="card" data-search="${escapeHtml(search)}" data-category="${escapeHtml(
    product.categoryPath,
  )}">
    <div class="image-wrap">
      <img loading="${index < 4 ? "eager" : "lazy"}" src="${escapeHtml(product.imageUrls[0] || "")}" alt="${escapeHtml(product.name)}" />
    </div>
    <div class="body">
      <div class="topline">
        <h2 class="title">${escapeHtml(product.name || product.productId)}</h2>
        <div class="price">${escapeHtml(renderPrice(product))}</div>
      </div>
      <div class="chips">
        <span class="chip">${escapeHtml(product.sku || product.productId)}</span>
        <span class="chip">${escapeHtml(product.categoryPath || "Sin categoría")}</span>
        <span class="chip">${escapeHtml(product.brand || "Sin marca")}</span>
      </div>
      <p class="desc">${escapeHtml(shorten(product.description || "Sin descripción", 220))}</p>
      <div class="thumbs">${thumbs}</div>
      <div class="actions">
        <a class="primary" href="${escapeHtml(product.productUrl)}" target="_blank" rel="noreferrer">Abrir producto</a>
        <a class="secondary" href="${escapeHtml(product.imageUrls[0] || product.productUrl)}" target="_blank" rel="noreferrer">Abrir imagen</a>
      </div>
    </div>
  </article>`;
}

function renderPrice(product) {
  if (!product.price) {
    return "Sin precio";
  }

  return `${product.price} ${product.currency || ""}`.trim();
}

function shorten(value, maxLength) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trim()}…`;
}
