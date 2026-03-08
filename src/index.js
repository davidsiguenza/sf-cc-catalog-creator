#!/usr/bin/env node

import { runCli } from "./cli.js";

runCli(process.argv.slice(2)).catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
