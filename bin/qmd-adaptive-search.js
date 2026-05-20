#!/usr/bin/env node
'use strict';

const { runCli } = require('../src/cli');

runCli(process.argv.slice(2)).catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
