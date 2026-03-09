# Catalogo de productos

Motor para explorar una tienda ecommerce, detectar catalogo, extraer productos y exportarlos a:

- `generic-products.csv`
- `visual-catalog.html`
- Salesforce B2C Commerce XML
- Salesforce B2B Commerce CSV

La idea es ahorrar tiempo en demos: intentar `100% auto` primero y pedir ayuda minima al usuario solo cuando haga falta.

## Principio de uso: Never Assume

Este proyecto debe documentarse y usarse con una regla simple:

- no asumir que el usuario ya clono el repo
- no asumir que el usuario ya esta dentro de la carpeta correcta
- no asumir que `Node.js` ya esta instalado
- no asumir que `npm install` ya se ejecuto
- no asumir que Playwright ya tiene Chromium instalado
- no asumir que el sitio target tiene una PLP o una PDP facil de descubrir
- no asumir que el usuario sabe si debe usar el repo runnable o el skill

Por eso, abajo veras siempre pasos completos y comandos literales.

## Regla importante sobre `npm init -y`

No asumas que siempre hay que ejecutar `npm init -y`.

Depende del punto de partida:

- si clonas este repo, no ejecutes `npm init -y`
- si copias la plantilla standalone del skill, no ejecutes `npm init -y`
- si empiezas en una carpeta vacia y vas a crear un proyecto Node manualmente desde cero, entonces si: ejecuta `npm init -y`

Regla practica:

- si ya existe `package.json`, no hagas `npm init -y`
- si no existe `package.json`, crea el proyecto Node primero

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
2. entra en la carpeta del repo
3. instala dependencias
4. instala Chromium
5. ejecuta `profile-site`
6. ejecuta `scrape`
7. revisa `visual-catalog.html`
8. importa o enseña los outputs

El skill lo reservaria para estos casos:

- quieres llevar este mismo flujo a otro repo
- quieres que un agente te cree una version standalone en una carpeta vacia
- quieres distribuir la capacidad como receta reusable para otros equipos

## Instalacion local del repo

### 1. Clonar el repo

Si todavia no tienes este proyecto en local, ejecuta exactamente esto:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
```

Despues de hacer `git clone`, este repo ya trae `package.json`.

Eso significa:

- no necesitas `npm init -y`
- puedes pasar directamente a `npm install`

### 2. Comprobar prerequisitos

Antes de seguir, comprueba que tienes `Node.js` y `npm`:

```bash
node -v
npm -v
```

Requisitos minimos:

- Node.js `>= 20`
- Chromium de Playwright

Si `node -v` o `npm -v` fallan, primero instala Node.js y vuelve a este paso.

### 3. Instalar dependencias del proyecto

Desde la raiz del repo, ejecuta:

```bash
npm install
```

No ejecutes antes `npm init -y` aqui, porque este repo ya esta inicializado como proyecto Node.

### Error tipico: `npm install` falla con `ENOENT package.json`

Si ves algo como esto:

```text
npm error enoent Could not read package.json
```

significa una de estas dos cosas:

1. no estas dentro del repo clonado
2. estas en una carpeta vacia que todavia no es un proyecto Node

Ejemplo de caso incorrecto:

```bash
cd test-catalog
npm install
```

Eso falla si `test-catalog/` no contiene `package.json`.

La correccion depende del caso:

Caso A: quieres usar este repo

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
npm install
npx playwright install chromium
```

Caso B: quieres crear un proyecto Node vacio manualmente

```bash
mkdir test-catalog
cd test-catalog
npm init -y
```

Pero ojo: despues de `npm init -y`, tu proyecto sigue vacio. Aun no tiene `playwright` ni el scraper.

Si haces:

```bash
npm install
```

sin dependencias declaradas, `npm` no instalara nada util para este caso.

### Error tipico: `npx playwright install chromium` avisa que faltan dependencias

Si ves el warning de Playwright diciendo que primero debes instalar dependencias del proyecto, el significado es:

- tu `package.json` existe
- pero tu proyecto no tiene `playwright` instalado

Eso es exactamente lo que pasa si hiciste `npm init -y` en una carpeta vacia y luego `npm install` sin instalar ninguna dependencia.

Si estas creando un proyecto manual desde cero, el orden minimo seria:

```bash
npm init -y
npm install playwright
npx playwright install chromium
```

Si quieres usar este scraper, no hagas ese camino. Haz este:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
npm install
npx playwright install chromium
```

### 4. Instalar Chromium para Playwright

Desde la raiz del repo, ejecuta:

```bash
npx playwright install chromium
```

### 5. Ver ayuda del CLI

Para comprobar que el proyecto esta listo:

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

Si no sabes aun esas URLs, puedes empezar solo con:

```bash
npm start -- profile-site --url https://example.com
```

Si el sistema no encuentra suficiente contexto y estas en una terminal interactiva, te pedira `PLP URL`, `PDP URL` o `Search URL` y reintentara.

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

### 4. Flujo literal de demo de extremo a extremo

Si quieres el flujo mas literal posible, sin asumir nada, seria este:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
node -v
npm -v
npm install
npx playwright install chromium
npm start -- profile-site --url https://example.com
npm start -- scrape --url https://example.com --formats generic,b2c,b2b
```

Despues revisas:

```bash
open output/example-com/visual-catalog.html
```

Si no quieres usar `open`, abre manualmente:

- `output/example-com/visual-catalog.html`

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

No asumas que el agente sabe si prefieres CLI o flujo asistido. Si quieres una de las dos cosas, dilo de forma explicita.

Prompt ejemplo para CLI:

```text
Usa el CLI de este repo. Primero ejecuta profile-site para https://example.com. Si falta contexto, pídeme una PLP y una PDP. Luego ejecuta scrape y valida el resultado.
```

Prompt ejemplo para trabajo totalmente asistido:

```text
Quiero una demo real con esta web. Haz todo el flujo de profile-site y scrape, y si te faltan PLPs o PDPs pídemelas antes de continuar.
```

## Usar el skill en otro workspace

Si quieres distribuir esta capacidad a otros equipos o llevarla a otro repo, entonces usas el skill.

### 1. Instalar el skill

No asumas que el skill ya esta instalado.

Desde cualquier terminal con acceso a `npx`, ejecuta:

```bash
npx skills add https://github.com/davidsiguenza/sf-cc-catalog-creator.git --skill salesforce-commerce-catalog-builder
```

### 2. Reiniciar Cursor/Codex si hace falta

Si el skill no aparece en la UI o no responde al invocarlo, reinicia la aplicacion y vuelve a abrir el workspace.

### 3. Abrir un workspace vacio o un repo destino

No asumas que el skill crea cosas fuera del workspace actual. Abre primero la carpeta donde quieres que el agente trabaje.

### 4. Pedir explicitamente el flujo que quieres

Luego, en un workspace vacio o en un repo destino, puedes pedir algo como:

```text
Use $salesforce-commerce-catalog-builder to create a standalone scraper project in this workspace, install dependencies, profile the target site, ask me for PLP/PDP URLs if discovery is ambiguous, run the scrape, and leave the outputs in output/.
```

Punto importante:

- el skill no sustituye este repo
- el skill ayuda a recrear o adaptar este repo
- si solo quieres ejecutar el scraper ya existente, no uses el skill: clona este repo y usa el CLI

### Caso especial: carpeta vacia sin proyecto Node

Si no estas clonando este repo y tampoco estas copiando la plantilla standalone, y quieres montar algo manualmente desde una carpeta vacia, el orden minimo seria:

```bash
mkdir mi-scraper
cd mi-scraper
npm init -y
npm install playwright
npx playwright install chromium
```

Pero para este proyecto en concreto, el camino recomendado sigue siendo:

```bash
git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git
cd sf-cc-catalog-creator
npm install
npx playwright install chromium
```

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

## Checklist minima para una persona de demo

Si alguien tiene que usar esto sin contexto previo, esta es la lista minima:

1. Ejecuta `git clone https://github.com/davidsiguenza/sf-cc-catalog-creator.git`
2. Ejecuta `cd sf-cc-catalog-creator`
3. Confirma que ya existe `package.json`
4. Ejecuta `node -v` y confirma `>= 20`
5. Ejecuta `npm install`
6. Ejecuta `npx playwright install chromium`
7. Ejecuta `npm start -- profile-site --url <HOME>`
8. Si el sistema lo pide, aporta `PLP URL` y `PDP URL`
9. Ejecuta `npm start -- scrape --url <HOME> --formats generic,b2c,b2b`
10. Revisa `output/<domain>/visual-catalog.html`
11. Usa `run-summary.json` para confirmar que los productos son válidos

## Decision final

Si alguien de negocio o preventa quiere usar esto para una demo:

- camino corto: clonar repo y ejecutar CLI
- camino reusable: instalar skill para que un agente lo despliegue en otro workspace

Si alguien pregunta "esto es un skill o es un scraper runnable?", la respuesta correcta es:

- este repo es el scraper runnable
- este repo tambien contiene un skill para replicar/adaptar esa capacidad en otros repos
