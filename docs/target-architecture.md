# Arquitectura objetivo para catalog scraper

## Objetivo

Convertir este repo en un motor reusable para:

- explorar una web desconocida con `Playwright`
- detectar PLPs, PDPs, paginacion y fuentes de datos utiles
- extraer un modelo canonico de catalogo
- validar calidad minima del resultado
- exportar a CSV/HTML generico, Salesforce B2C y Salesforce B2B

La idea clave es separar tres cosas que ahora estan mezcladas:

1. exploracion de la web
2. extraccion y normalizacion
3. exportacion a formatos Salesforce

## Problema actual

Hoy el repo funciona bien cuando la web encaja con unas pocas heuristicas:

- categorias por patrones como `/category/`, `/collections/`, `cgid=`
- productos por patrones como `/p/`, `/product/`, `pid=`
- selectores DOM muy concretos

Eso hace que `Playwright` se use solo como navegador, no como motor real de reconocimiento. La parte mas fragil esta acoplada en:

- `src/config.js`
- `src/storefront.js`
- `src/scraper.js`

La consecuencia es que cada nueva tienda exige tocar regex, selectores o ramas condicionales.

## Principio de diseño

No intentar un "scraper universal" basado en regex fijas.

La arquitectura debe ser:

- `Playwright` para reconocimiento y obtencion
- modelo canonico intermedio para producto/categoria
- exportadores deterministas para B2C y B2B
- perfiles por sitio para persistir lo aprendido
- estrategias por plataforma cuando existan patrones repetibles
- ayuda progresiva al usuario cuando el modo automatico no llegue a una calidad minima

## Flujo objetivo

```text
URL inicial
  -> exploracion del sitio con Playwright
  -> clasificacion de paginas (home, PLP, PDP, search, cart)
  -> deteccion de fuente de datos (json-ld, DOM, API/XHR, hydration data)
  -> extraccion a modelo canonico
  -> validacion de calidad
  -> si falta contexto, solicitar una PLP/PDP al usuario
  -> guardado de site-profile
  -> exportadores (generic CSV, HTML, B2C XML, B2B CSV)
```

## Escalado de ayuda

El sistema debe intentar primero el modo `100% auto`.

Si no encuentra PLPs, no llega a PDPs o la calidad del resultado cae por debajo del umbral minimo, debe devolver una peticion de ayuda concreta en vez de fallar de forma opaca.

Ejemplos:

- si no encuentra PLPs, pedir una `PLP URL`
- si encuentra PLP pero no producto fiable, pedir una `PDP URL`
- si el perfil sigue siendo ambiguo, pedir opcionalmente una `Search URL`

La ayuda debe ser minima y util: solo pedir el contexto que desbloquea el siguiente intento.

## Estructura propuesta

```text
src/
  cli/
    commands/
      scrape.js
      profile-site.js
      validate-profile.js
  core/
    models/
      category.js
      product.js
      catalog.js
    normalize/
      product.js
      category.js
      price.js
      images.js
    validate/
      catalog.js
      product.js
  browser/
    session.js
    navigation.js
    snapshots.js
    network.js
  discovery/
    site-explorer.js
    page-classifier.js
    url-scoring.js
    pagination.js
    link-harvester.js
  extraction/
    pipeline.js
    plp-extractor.js
    pdp-extractor.js
    structured-data.js
    dom-extractor.js
    network-extractor.js
  platforms/
    detector.js
    generic/
      strategy.js
    shopify/
      strategy.js
    sfcc/
      strategy.js
    magento/
      strategy.js
    legacy-aspnet-store/
      strategy.js
  site-profiles/
    schema.js
    loader.js
    merger.js
    scorer.js
  exporters/
    generic-csv.js
    visual-html.js
    salesforce-b2c.js
    salesforce-b2b.js
  utils/
    csv.js
    fs.js
    html.js
    text.js
    url.js
    xml.js
profiles/
  eu.salesforcestore.com.json
  example.com.json
skills/
  salesforce-commerce-catalog-builder/
    SKILL.md
test/
  fixtures/
  discovery/
  extraction/
  exporters/
docs/
  target-architecture.md
```

## Responsabilidad de cada capa

### `cli/`

Comandos publicos del proyecto.

- `scrape`: ejecuta extraccion completa usando perfil existente o modo generico
- `profile-site`: explora una web nueva y propone/genera un perfil
- `validate-profile`: comprueba si un perfil sigue siendo valido

`profile-site` deberia aceptar URLs de apoyo opcionales cuando el usuario las tenga:

- `--home-url`
- `--plp-url`
- `--search-url`
- `--pdp-url`

Esto tiene mucho sentido porque reduce exploracion ciega y mejora la deteccion inicial de patrones.

### `browser/`

Encapsula `Playwright`.

- creacion de navegador/contexto/paginas
- navegacion robusta
- captura de requests/responses
- snapshots utiles para depuracion

Esta capa no decide si una pagina es PLP o PDP. Solo da primitives estables.

### `discovery/`

Reconocimiento del sitio.

- encontrar links relevantes
- clasificar paginas
- puntuar URLs candidatas
- detectar paginacion
- elegir muestras de PLP/PDP para analisis

Aqui debe vivir la logica de "esto parece una categoria" o "esto parece un producto", pero basada en score, no en un `if` binario.

### `extraction/`

Construye el modelo canonico.

Orden recomendado de fuentes:

1. JSON-LD / microdata
2. datos de red o hydration data
3. DOM visible

Cada extractor devuelve estructura parcial y una confianza. El pipeline fusiona resultados.

### `platforms/`

Estrategias especiales para plataformas conocidas.

Ejemplos:

- Shopify
- SFCC
- Magento
- ASP.NET legacy tipo `-C2.aspx` y `-P1532.aspx`

No deben reescribir todo el motor. Solo ajustar discovery y extraction cuando una plataforma tiene señales claras.

### `site-profiles/`

Memoria persistente por dominio.

Aqui se guarda lo aprendido en la primera exploracion de una web.

Ejemplos de contenido:

- patrones de URLs de categoria y producto
- selectores PLP/PDP
- estrategia preferida para precio, imagenes y descripcion
- hints de paginacion
- plataforma detectada
- nivel de confianza

### `core/`

Contrato interno del sistema.

Este es el centro estable del repo. Todo lo extraido debe terminar aqui antes de exportarse.

## Modelo canonico minimo

```js
{
  productId: "",
  sku: "",
  name: "",
  description: "",
  brand: "",
  price: "",
  currency: "",
  imageUrls: [],
  productUrl: "",
  categoryTrail: [],
  categoryPath: "",
  sourceSite: "",
  sourceType: "",
  sourceConfidence: 0,
  rawSignals: {
    jsonld: false,
    dom: false,
    network: false
  }
}
```

Campos opcionales que conviene preparar aunque B2B/B2C no los usen siempre:

- `variants`
- `inventory`
- `gtin`
- `mpn`
- `attributes`
- `breadcrumbs`

## Formato de `site-profile`

Ejemplo:

```json
{
  "domain": "eu.salesforcestore.com",
  "platformHint": "legacy-aspnet-store",
  "entryUrl": "https://eu.salesforcestore.com/",
  "urlPatterns": {
    "category": ["-C\\d+\\.aspx$"],
    "product": ["-P\\d+\\.aspx$"]
  },
  "selectors": {
    "plpProductLinks": [
      ".productItemDisplay a[href]"
    ],
    "pdpName": [
      "h1",
      ".itemName"
    ],
    "pdpPrice": [
      ".price",
      "[itemprop='price']"
    ],
    "pdpDescription": [
      ".product-description",
      "[itemprop='description']"
    ]
  },
  "pagination": {
    "nextSelectors": [
      "a[rel='next']",
      ".next a[href]"
    ]
  },
  "preferredSources": [
    "dom"
  ],
  "confidence": 0.82
}
```

Este perfil no reemplaza el motor. Solo le evita volver a descubrir lo mismo cada vez.

## Que debe hacer el skill

El skill no debe contener toda la inteligencia del scraper. Debe orquestar.

Responsabilidades del skill:

- crear o actualizar el proyecto scraper en otro workspace
- ejecutar `profile-site` contra una web nueva
- revisar resultados y validaciones
- persistir o corregir el `site-profile`
- lanzar `scrape`
- dejar outputs listos en `output/`

Responsabilidades del repo:

- reconocimiento
- extraccion
- normalizacion
- validacion
- exportadores

En otras palabras:

- el skill define el flujo de trabajo
- el repo implementa la logica estable

## Contrato entre skill y motor

El skill deberia poder hacer siempre algo como esto:

```bash
npm start -- profile-site --url https://example.com
npm start -- scrape --url https://example.com --formats generic,b2c,b2b
```

Si el `profile-site` encuentra un perfil valido, lo guarda en `profiles/<dominio>.json`.

Si `scrape` ve un perfil, lo usa.

Si no hay perfil, hace extraccion generica y, si la confianza es baja, devuelve una recomendacion de perfilar primero.

Cuando el usuario pueda aportar ejemplos, el contrato ideal seria:

```bash
npm start -- profile-site \
  --url https://example.com \
  --plp-url https://example.com/category/shoes \
  --search-url "https://example.com/search?q=shoe" \
  --pdp-url https://example.com/product/trail-shoe
```

La home seguiria siendo util, pero PLP, search y PDP aceleran mucho el reconocimiento correcto.

## Migracion incremental desde el estado actual

### Fase 1

Mantener exportadores y crear el centro canonico.

Cambios:

- mover normalizacion de producto a `src/core/normalize/`
- crear validadores de producto/catalogo
- hacer que exportadores dependan solo del modelo canonico

Resultado:

- B2C y B2B quedan desacoplados del scraping

### Fase 2

Separar discovery de extraction.

Cambios:

- trocear `src/storefront.js` en `discovery/` y `extraction/`
- cambiar `looksLikeProductUrl` por `url-scoring`
- cambiar `isCategoryCandidate` por puntuacion y señales

Resultado:

- deja de haber una sola regex como cuello de botella

### Fase 3

Introducir perfiles por sitio.

Cambios:

- crear `profiles/`
- loader/merger/schema para perfiles
- permitir fusionar defaults + perfil + CLI

Resultado:

- una web nueva se adapta sin tocar codigo

### Fase 4

Crear `profile-site`.

Cambios:

- exploracion guiada con `Playwright`
- toma de muestras de home, 1-2 PLPs y 1-2 PDPs
- deteccion automatica de patrones de URL, selectores y fuentes
- escritura de perfil sugerido

Resultado:

- primera ejecucion agentic, siguientes ejecuciones deterministas

### Fase 5

Introducir estrategias de plataforma.

Cambios:

- detector de plataforma
- estrategias especializadas
- fallback generico si no se detecta plataforma

Resultado:

- mejor precision en plataformas conocidas

## Primer reparto recomendado de archivos actuales

Estado actual:

- `src/scraper.js`: orquestacion general
- `src/storefront.js`: discovery + extraction + heuristicas
- `src/config.js`: defaults de scraping
- `src/exporters/*`: ya estan bastante bien separados

Movimiento recomendado:

- `src/scraper.js` -> `src/cli/commands/scrape.js` + `src/extraction/pipeline.js`
- `src/storefront.js` -> `src/discovery/*` + `src/extraction/*`
- `src/config.js` -> `src/site-profiles/merger.js` + defaults iniciales
- `src/exporters/*` se mantiene y pasa a depender del modelo canonico

## Criterio operativo

Para una web desconocida, el sistema debe intentar en este orden:

1. plataforma conocida
2. perfil del dominio
3. datos estructurados
4. trafico de red
5. DOM generico

Y debe fallar con diagnostico, no con silencio.

Ejemplos de diagnostico util:

- "se encontraron PDPs, pero no precio"
- "se detectaron categorias, pero no links de producto con confianza suficiente"
- "la web parece ASP.NET legacy; perfil sugerido generado"

## Siguiente paso recomendado

La mejor evolucion inmediata, sin reescribir todo, es esta:

1. extraer el modelo canonico y validadores
2. introducir `profiles/`
3. añadir `profile-site`
4. refactorizar `storefront.js` por capas

Ese orden protege lo que ya funciona hoy y abre la puerta al modelo `skill + motor + perfiles`.
