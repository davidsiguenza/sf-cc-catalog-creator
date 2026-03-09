# Catalogo de productos

Motor para explorar una tienda ecommerce, detectar catalogo, extraer productos y exportarlos a:

- `generic-products.csv`
- `visual-catalog.html`
- Salesforce B2C Commerce XML
- Salesforce B2B Commerce CSV

La idea es ahorrar tiempo en demos: intentar `100% auto` primero y pedir ayuda minima al usuario solo cuando haga falta.

## Lo importante: hay 2 piezas distintas

### 1. Este repo

Es el producto ejecutable.

Incluye:

- el CLI runnable
- el motor de discovery y extraction
- los exporters
- los tests
- los perfiles por sitio

Si quieres sacar catalogos hoy, esta es la opcion principal.

### 2. El skill

Esta en:

- [skills/salesforce-commerce-catalog-builder/SKILL.md](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/skills/salesforce-commerce-catalog-builder/SKILL.md)

El skill no es el scraper ejecutandose por si solo.

El skill es una instruccion reusable para un agente tipo Codex/Cursor:

- para montar este flujo en otro workspace
- para copiar una plantilla standalone
- para adaptar el proceso a otro repo sin reexplicar toda la arquitectura

Resumen corto:

- si quieres usar el scraper ya: clona este repo
- si quieres que un agente lo replique o lo adapte en otro repo: usa el skill

Importante hoy:

- el runtime de referencia y mas actualizado es este repo
- la plantilla standalone del skill es un bootstrap para que el agente la copie y la adapte, no la fuente de verdad del runtime mantenido

## Recomendacion para demos

Para demos con poco tiempo:

1. clona este repo
2. ejecuta `profile-site`
3. ejecuta `scrape`
4. revisa `visual-catalog.html`
5. importa o enseña los outputs

El skill lo reservaria para estos casos:

- quieres llevar este mismo flujo a otro repo
- quieres que un agente te cree una version standalone en una carpeta vacia
- quieres distribuir la capacidad como receta reusable para otros equipos

## Instalacion local del repo

Requisitos:

- Node.js `>= 20`
- Chromium de Playwright

Instalacion:

```bash
npm install
npx playwright install chromium
```

Ayuda del CLI:

```bash
npm start -- help
```

## Flujo recomendado

### 1. Perfilar una web nueva

Si la web es nueva o sospechas que no encaja en heuristicas genericas, arranca por aqui:

```bash
npm start -- profile-site \
  --url https://example.com \
  --home-url https://example.com \
  --plp-url https://example.com/category/shoes \
  --pdp-url https://example.com/p/red-shoe
```

`profile-site`:

- detecta plataforma si puede
- aprende patrones de categoria y producto
- genera `profiles/<domain>.json`
- deja un resumen en `output/<domain>/profile-summary.json`

Las URLs auxiliares son opcionales, pero muy utiles:

- `--home-url`
- `--plp-url`
- `--search-url`
- `--pdp-url`

### 2. Ejecutar el scrape

Modo automatico:

```bash
npm start -- scrape \
  --url https://example.com \
  --max-categories 4 \
  --products-per-category 8 \
  --formats generic,b2c,b2b
```

Modo con categoria concreta:

```bash
npm start -- scrape \
  --url https://example.com \
  --category-url https://example.com/category/shoes \
  --products-per-category 12 \
  --formats generic,b2c,b2b
```

Modo con config JSON:

```bash
npm start -- scrape \
  --config ./site-config.example.json \
  --formats generic,b2c,b2b
```

### 3. Revisar el resultado

Archivos principales:

- `output/<domain>/generic-products.csv`
- `output/<domain>/visual-catalog.html`
- `output/<domain>/run-summary.json`
- `output/<domain>/salesforce-b2c/*`
- `output/<domain>/salesforce-b2b/*`

## Como funciona el sistema

### Auto primero

El flujo intenta siempre:

1. descubrir categorias/PLPs
2. descubrir PDPs
3. extraer producto
4. validar calidad
5. exportar

### Asistido cuando hace falta

Si no encuentra contexto suficiente, el sistema genera una peticion de ayuda estructurada.

Ejemplos:

- no encuentra PLPs: pide `PLP URL`
- encuentra PLP pero no PDP fiable: pide `PDP URL`
- el perfil sigue ambiguo: pide opcionalmente `Search URL`

Si ejecutas el CLI en una terminal interactiva, el propio comando puede pedirte esas URLs y reintentar automaticamente.

Si ejecutas en un entorno no interactivo, el resumen guarda esta seccion:

- `assistance` en `run-summary.json`
- `assistance` en `profile-summary.json`

Puedes desactivar el reintento interactivo con:

```bash
--interactive-assistance false
```

### Perfiles por sitio

Los aprendizajes persistentes van en:

- `profiles/<domain>.json`

Eso permite que la segunda ejecucion sobre la misma tienda no empiece desde cero.

### Plataformas

Hoy el motor intenta detectar familias de tienda como:

- Shopify
- SFCC
- Magento
- legacy ASP.NET store
- generic

Cuando no encaja con ninguna, el sistema cae a `generic` y puede pedir muestras reales al usuario.

## Usar el repo directamente con un agente

Si ya estas en este repo con Codex/Cursor, puedes pedir cosas como:

```text
Ejecuta profile-site para https://example.com. Si falta contexto, pídeme una PLP y una PDP y reintenta.
```

```text
Haz un scrape para https://example.com, genera CSV/HTML/B2C/B2B y dime si la extracción es válida.
```

El agente puede usar:

- el CLI
- los summaries
- los perfiles guardados
- la seccion `assistance` para saber que pedirte

## Usar el skill en otro workspace

Si quieres distribuir esta capacidad a otros equipos o llevarla a otro repo, entonces usas el skill.

Instalacion del skill en Cursor/Codex, segun el flujo que ya estabas usando:

```bash
npx skills add https://github.com/davidsiguenza/sf-cc-catalog-creator.git --skill salesforce-commerce-catalog-builder
```

Luego, en un workspace vacio o en un repo destino, puedes pedir algo como:

```text
Use $salesforce-commerce-catalog-builder to create a standalone scraper project in this workspace, install dependencies, profile the target site, ask me for PLP/PDP URLs if discovery is ambiguous, run the scrape, and leave the outputs in output/.
```

Punto importante:

- el skill no sustituye este repo
- el skill ayuda a recrear o adaptar este repo

## Que outputs genera

### Genericos

- `generic-products.csv`
- `visual-catalog.html`

### Salesforce B2C Commerce

- `brand-catalog.xml`
- `brand-pricebooks.xml`
- `brand-inventory.xml`

### Salesforce B2B Commerce

- `commerce-import.csv`

### Resumenes

- `run-summary.json`
- `profile-summary.json`

## Estructura util del proyecto

- [src/cli.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/cli.js): entrada de comandos
- [src/profiler.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/profiler.js): perfilado de sitios
- [src/scraper.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/scraper.js): orquestacion de scrape
- [src/fetch-storefront.js](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/fetch-storefront.js): transporte HTTP para tiendas donde Playwright no sea viable
- [src/site-profiles/](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/src/site-profiles): perfiles por dominio
- [profiles/](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/profiles): perfiles generados
- [docs/target-architecture.md](/Users/dsiguenza/Documents/B2C_CC/catalogo%20de%20productos/docs/target-architecture.md): arquitectura objetivo

## Ejemplos rapidos

### Web nueva, con ayuda del usuario desde el principio

```bash
npm start -- profile-site \
  --url https://example.com \
  --plp-url https://example.com/category/shoes \
  --search-url https://example.com/search?q=shoe \
  --pdp-url https://example.com/p/red-shoe
```

```bash
npm start -- scrape \
  --url https://example.com \
  --category-url https://example.com/category/shoes \
  --formats generic,b2c,b2b
```

### Web nueva, modo casi automatico

```bash
npm start -- profile-site --url https://example.com
npm start -- scrape --url https://example.com --formats generic,b2c,b2b
```

Si el sistema necesita ayuda y estas en terminal interactiva, te pedira las URLs y reintentara.

## Desarrollo y validacion

Tests:

```bash
npm test
```

Sincronizar la plantilla standalone del skill con el runtime principal:

```bash
npm run sync:standalone-template
```

Si una tienda concreta falla:

1. ejecuta `profile-site`
2. mira `profile-summary.json`
3. revisa `assistance`
4. aporta `PLP/PDP/Search URL` si hace falta
5. relanza `scrape`

## Decision final

Si alguien de negocio o preventa quiere usar esto para una demo:

- camino corto: clonar repo y ejecutar CLI
- camino reusable: instalar skill para que un agente lo despliegue en otro workspace

Si alguien pregunta "esto es un skill o es un scraper runnable?", la respuesta correcta es:

- este repo es el scraper runnable
- este repo tambien contiene un skill para replicar/adaptar esa capacidad en otros repos
