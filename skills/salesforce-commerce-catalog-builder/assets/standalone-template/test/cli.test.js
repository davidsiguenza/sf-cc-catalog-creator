import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs } from "../src/cli.js";

test("parseArgs rechaza argumentos sueltos para evitar URLs ignoradas", () => {
  assert.throws(
    () =>
      parseArgs([
        "profile-site",
        "--url",
        "https://shop.example.com",
        "--plp-url",
        "https://shop.example.com/teen/,",
        "https://shop.example.com/kids/",
      ]),
    /Argumento inesperado: https:\/\/shop\.example\.com\/kids\//,
  );
});
