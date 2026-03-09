# Standalone Catalog Scraper Template

Este template es un bootstrap runnable que el skill puede copiar en un workspace nuevo o en un subdirectorio aislado.

Importante:

- el runtime mas actualizado y mantenido vive en el repo principal
- esta plantilla sirve como punto de arranque para que el agente la adapte
- si necesitas las capacidades mas recientes, el agente debe sincronizar la plantilla con el runtime principal

## Principio: Never Assume

No asumas:

- que ya estas dentro de la carpeta correcta
- que `npm install` ya se ejecuto
- que Chromium ya esta instalado
- que la web target tiene una PLP o una PDP faciles de descubrir

Usa siempre comandos completos y valida cada paso.

## Instalar

Primero, asegúrate de estar en la raiz de este proyecto standalone.

Luego ejecuta:

```bash
npm install
npx playwright install chromium
```

Comprueba que el CLI responde:

```bash
npm start -- help
```

## Run

Scrape automatico:

```bash
npm start -- scrape \
  --url https://example.com \
  --max-categories 4 \
  --products-per-category 8 \
  --formats generic,b2c,b2b
```

Config JSON:

```bash
npm start -- scrape \
  --config ./site-config.example.json \
  --formats generic,b2c,b2b
```

## Output

Los archivos aparecen en `output/<domain>/`.

- `generic-products.csv`
- `visual-catalog.html`
- `run-summary.json`
- `salesforce-b2c/<brand>-catalog.xml`
- `salesforce-b2c/<brand>-pricebooks.xml`
- `salesforce-b2c/<brand>-inventory.xml`
- `salesforce-b2b/commerce-import.csv`
