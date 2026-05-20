#!/usr/bin/env node
import { runCli } from '../dist/src/cli.js';

runCli(process.argv.slice(2)).catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
