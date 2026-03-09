export const DEFAULT_CATEGORY_DISCOVERY = {
  selectors: [
    "header nav a[href]",
    "nav a[href]",
    "[role='navigation'] a[href]",
    ".menu a[href]",
    ".navigation a[href]",
  ],
  includePatterns: ["/c/", "cgid=", "/collections/", "/category/", "/departments/", "/shop/"],
  excludePatterns: ["/account", "/login", "/cart", "/checkout", "/wishlist", "/search", "/blog"],
};

export const DEFAULT_PRODUCT_DISCOVERY = {
  selectors: [
    "a[href*='/p/']",
    "a[href*='/product/']",
    "a[href*='/products/']",
    "a[href*='pid=']",
    "[data-product-id] a[href]",
    ".product a[href]",
    ".product-card a[href]",
  ],
};

export const DEFAULT_PAGINATION = {
  selectors: [
    "a[rel='next']",
    ".pagination-next a[href]",
    ".next a[href]",
    ".pagination a.next[href]",
  ],
};
