export function asAbsoluteUrl(value, baseUrl) {
  try {
    return cleanUrl(new URL(value, baseUrl).toString());
  } catch {
    return "";
  }
}

export function cleanUrl(value) {
  const url = new URL(value);
  url.hash = "";

  for (const param of [...url.searchParams.keys()]) {
    if (/^utm_|^gclid$|^fbclid$/i.test(param)) {
      url.searchParams.delete(param);
    }
  }

  return url.toString();
}

export function isSameDomain(left, right) {
  try {
    return new URL(left).hostname === new URL(right).hostname;
  } catch {
    return false;
  }
}

export function isHttpUrl(value) {
  return /^https?:\/\//i.test(value || "");
}

export function toOrigin(url) {
  return new URL(url).origin;
}

export function getDomainSlug(url) {
  const hostname = new URL(url).hostname.replace(/^www\./, "");
  return hostname.replace(/\./g, "-");
}
