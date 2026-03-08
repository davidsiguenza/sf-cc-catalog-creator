# Catalogo de productos

CLI para rastrear una tienda online, descubrir categorias/subcategorias, extraer productos y generar:

- un CSV generico para staging o demo
- un HTML visual para revisar la extraccion
- un `brand-catalog.xml`, un `brand-pricebooks.xml` y un `brand-inventory.xml` para Salesforce B2C Commerce
- un CSV de arranque para Salesforce B2B Commerce

## Que hace

- acepta una URL de tienda o un fichero de configuracion por sitio
- puede descubrir categorias automaticamente o trabajar sobre categorias concretas
- limita el numero de productos por categoria
- intenta sacar siempre nombre, descripcion, SKU, precio, categoria, subcategoria e imagenes
- usa `Playwright`, asi que funciona mejor en tiendas con renderizado dinamico
- por defecto construye un catalogo base de 4 categorias, hasta 2 subcategorias por categoria y 10 productos por categoria procesada

## Instalacion local

```bash
npm install
npx playwright install chromium
```

## Skill reutilizable para Cursor

Este repo ya incluye un skill reusable en:

- `skills/salesforce-commerce-catalog-builder/SKILL.md`

La referencia publica actual para este tipo de skills es [skills.sh](https://skills.sh/). Si llegaste aqui buscando `skill.sh`, usa `skills.sh`, que es donde esta la documentacion y el flujo de instalacion vigentes.

### Como instalarlo en Cursor

La via documentada y estable hoy es instalar el skill desde un repositorio Git. El flujo recomendado es:

1. Comprueba que tienes `node` disponible en tu maquina, porque la instalacion se hace con `npx`.
2. Instala el skill en Cursor con:

```bash
npx skills add https://github.com/davidsiguenza/sf-cc-catalog-creator.git --skill salesforce-commerce-catalog-builder
```

3. Reinicia Cursor para que recargue los skills instalados.
4. Abre el proyecto en el que quieras reutilizar el proceso.
5. Invoca el skill en el prompt con algo como:

```text
Use $salesforce-commerce-catalog-builder to add a storefront scraper that exports validated Salesforce B2C XML, B2B CSV, generic CSV, and a visual HTML preview.
```

### Requisitos del proyecto destino

El skill no "embebe" Playwright dentro de Cursor ni dentro del propio skill. Lo que hace es darle al agente la receta para montar el proceso en otro repo. Por eso, en el proyecto destino tienen que existir estos requisitos:

- `Node.js >= 20`
- dependencia `playwright` en el proyecto destino
- runtime de Chromium instalado

Comandos recomendados en un proyecto nuevo con npm:

```bash
npm install playwright
npx playwright install chromium
```

Si el repo usa `pnpm` o `yarn`, instala `playwright` con ese gestor y mantén igualmente:

```bash
npx playwright install chromium
```

### Que hace el skill

El skill le indica al agente que, cuando tenga que montar este proceso en otro repo, preserve este contrato:

- extractor por `Playwright`
- configuracion por sitio con selectores
- CSV generico y HTML visual
- export B2C con `root` y `all`
- productos online/searchable/available
- `showInMenu=true` en categorias
- `image-settings` external
- imagenes en `hi-res` y `large`
- pricebook espejo en USD
- inventario perpetuo

La idea es que el primer import en B2C salga bien sin tener que retocar XML a mano.

### Flujo recomendado en un proyecto nuevo

1. Instala el skill en Cursor con `npx skills add`.
2. Reinicia Cursor.
3. Abre el repo nuevo donde quieras montar el scraper.
4. Asegura `Node.js`, `playwright` y `Chromium`.
5. Invoca el skill en el prompt.
6. Deja que el agente cree o adapte:
   - la CLI
   - la configuracion por tienda
   - los exportadores CSV, HTML, B2C y B2B
   - las pruebas
7. Ejecuta una pasada real contra una tienda.
8. Revisa `visual-catalog.html`.
9. Importa los XML en B2C Commerce.

## Uso rapido

Modo automatico:

```bash
npm start -- scrape \
  --url https://example.com \
  --max-categories 4 \
  --products-per-category 8 \
  --formats generic,b2c,b2b
```

Categorias concretas por nombre:

```bash
npm start -- scrape \
  --url https://example.com \
  --category "Men" \
  --category "Women" \
  --products-per-category 6
```

Categorias concretas por URL:

```bash
npm start -- scrape \
  --url https://example.com \
  --category-url https://example.com/men \
  --category-url https://example.com/women
```

Con configuracion por tienda:

```bash
npm start -- scrape \
  --config ./site-config.example.json \
  --products-per-category 10 \
  --formats generic,b2c,b2b
```

Ejemplo ya preparado para NNormal:

```bash
npm start -- scrape \
  --config ./site-config.nnormal.es_ES.json \
  --formats generic,b2c,b2b
```

## Flujo completo de uso

### 1. Preparar una tienda

Si la tienda es sencilla, puedes lanzar directamente por URL. Si es una tienda con HTML particular, crea primero un JSON basado en `site-config.example.json`.

El ejemplo real de este repo es:

- `site-config.nnormal.es_ES.json`

### 2. Lanzar la extraccion

Puedes hacerlo de tres formas:

- descubrimiento automatico
- pasando nombres de categorias con `--category`
- pasando URLs concretas con `--category-url`

Si no das mas instrucciones, el comportamiento por defecto esta pensado para una demo base:

- 4 categorias
- hasta 2 subcategorias por categoria
- 10 productos por categoria procesada

### 3. Revisar el resultado visual

Antes de importar nada en Commerce, abre:

- `output/<dominio>/visual-catalog.html`

Esto permite comprobar si nombre, SKU, precio, descripcion, categorias e imagenes se han extraido bien.

### 4. Revisar los ficheros generados

Por defecto escribe en `output/<dominio>/`.

- `generic-products.csv`
- `visual-catalog.html`
- `salesforce-b2c/<marca>-catalog.xml`
- `salesforce-b2c/<marca>-pricebooks.xml`
- `salesforce-b2c/<marca>-inventory.xml`
- `salesforce-b2b/commerce-import.csv`
- `run-summary.json`

### 5. Importar en B2C Commerce

El flujo recomendado es:

1. importar `salesforce-b2c/<marca>-catalog.xml`
2. importar `salesforce-b2c/<marca>-pricebooks.xml`
3. importar `salesforce-b2c/<marca>-inventory.xml`
4. reconstruir el indice de busqueda del site
5. revisar categorias, PDPs y galerias

## Notas sobre Salesforce

### B2C Commerce

El export genera un `brand-catalog.xml` con categorias, productos y asignaciones de categoria, un `brand-pricebooks.xml` separado para precios, y un `brand-inventory.xml` con inventario perpetuo para todos los productos.

El formato B2C queda fijado por defecto con esta estructura:

- categorias sinteticas `root` y `all`
- asignacion de todos los productos a `all` y a sus categorias reales y padre
- productos con `online-flag`, `available-flag` y `searchable-flag`
- `showInMenu=true` en categorias
- `image-settings` external
- imagenes repetidas en `hi-res` y `large`
- pricebooks en moneda original y espejo en USD con los mismos importes
- inventario perpetuo para todos los productos
- nombres de archivo con la marca para identificarlos al subirlos

### B2B Commerce

El CSV se genera como plantilla de importacion inicial con columnas de producto, categoria, precio e imagenes. Es un buen punto de partida para una demo, pero la carga final puede requerir ajustar cabeceras o mapping segun el import concreto de tu org.

## Limitaciones

- no hay un extractor universal perfecto: cada tienda marca HTML distinto
- para tiendas complejas conviene pasar un fichero `--config` con selectores
- no descarga binarios de imagen; guarda URLs
- no intenta autenticar ni saltar protecciones anti-bot

## Configuracion por tienda

Mira `site-config.example.json`. El objetivo es que el motor use heuristicas por defecto, pero puedas endurecerlo con selectores propios cuando una tienda lo necesite.

Tambien dejo una configuracion real para `https://www.nnormal.com/es_ES` en `site-config.nnormal.es_ES.json`.
Esa configuracion ya va orientada a un catalogo base de 4 categorias principales, 2 subcategorias y al menos 40 productos sin tener que pasar mas parametros.
