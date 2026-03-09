import path from "node:path";

import { readJsonFile } from "../utils/fs.js";

export function resolveSiteProfilePath(entryUrl, profilesDir = "profiles") {
  const domain = new URL(entryUrl).hostname.replace(/^www\./, "");
  return path.resolve(profilesDir, `${domain}.json`);
}

export async function loadSiteProfile(entryUrl, profilesDir = "profiles") {
  const profilePath = resolveSiteProfilePath(entryUrl, profilesDir);

  try {
    return await readJsonFile(profilePath);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}
