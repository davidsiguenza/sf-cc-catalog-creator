import { asAbsoluteUrl } from "../utils/url.js";

export async function gotoPage(page, url, options) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: options.timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: Math.min(options.timeoutMs, 5000) }).catch(() => {});
}

export async function collectLinks(page, selectors) {
  return page.evaluate((candidateSelectors) => {
    const links = [];
    const used = new Set();

    for (const selector of candidateSelectors) {
      for (const element of document.querySelectorAll(selector)) {
        const href = element.getAttribute("href");
        const text = (element.textContent || element.getAttribute("aria-label") || "").trim();
        const key = `${href}|${text}`;

        if (!href || used.has(key)) {
          continue;
        }

        used.add(key);
        links.push({ href, text });
      }
    }

    if (links.length) {
      return links;
    }

    return Array.from(document.querySelectorAll("a[href]")).map((element) => ({
      href: element.getAttribute("href"),
      text: (element.textContent || element.getAttribute("aria-label") || "").trim(),
    }));
  }, selectors);
}

export async function extractNextPageUrl(page, currentUrl, selectors) {
  const nextLink = await page.evaluate((candidateSelectors) => {
    for (const selector of candidateSelectors) {
      const element = document.querySelector(selector);

      if (element?.getAttribute("href")) {
        return element.getAttribute("href");
      }
    }

    return "";
  }, selectors);

  return nextLink ? asAbsoluteUrl(nextLink, currentUrl) : "";
}
