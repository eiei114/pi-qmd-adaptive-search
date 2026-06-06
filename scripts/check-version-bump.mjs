#!/usr/bin/env node
/**
 * PR guard: publishable paths changed => package.json semver must increase
 * and CHANGELOG.md must be updated in the same diff.
 *
 * Publishable paths: template defaults + package.json `files` + `pi.extensions`.
 *
 * Usage:
 *   node scripts/check-version-bump.mjs
 *   BASE_REF=origin/main node scripts/check-version-bump.mjs
 */
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const TEMPLATE_DEFAULT = [
  "extensions/",
  "lib/",
  "skills/",
  "prompts/",
  "themes/",
  "src/",
  "bin/",
  "README.md",
  "CHANGELOG.md",
  "SECURITY.md",
  "package.json",
];

function run(cmd) {
  return execSync(cmd, { encoding: "utf8" }).trim();
}

function parseSemver(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(String(v).trim());
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compareSemver(a, b) {
  const va = parseSemver(a);
  const vb = parseSemver(b);
  if (!va || !vb) return 0;
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

function readPackageVersion(ref) {
  const raw = run(`git show ${ref}:package.json`);
  return JSON.parse(raw).version;
}

function loadPublishablePaths() {
  const paths = new Set(TEMPLATE_DEFAULT);
  try {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    for (const entry of pkg.files ?? []) {
      paths.add(String(entry).replace(/^\.\//, ""));
    }
    for (const ext of pkg.pi?.extensions ?? []) {
      if (typeof ext === "string") {
        paths.add(ext.replace(/^\.\//, ""));
      }
    }
    if (existsSync("index.ts")) paths.add("index.ts");
  } catch {
    // keep template defaults
  }
  return [...paths];
}

function isPublishablePath(file, publishable) {
  return publishable.some(
    (p) => file === p || (p.endsWith("/") && file.startsWith(p)),
  );
}

const baseRef = process.env.BASE_REF ?? "origin/main";
const publishable = loadPublishablePaths();

let changed;
try {
  run(`git rev-parse --verify ${baseRef}`);
  changed = run(`git diff --name-only ${baseRef}...HEAD`).split("\n").filter(Boolean);
} catch {
  console.log("version:check skip — base ref not available (local run?)");
  process.exit(0);
}

const publishableChanged = changed.some((f) => isPublishablePath(f, publishable));
if (!publishableChanged) {
  console.log("version:check ok — no publishable paths changed");
  process.exit(0);
}

const baseVersion = readPackageVersion(baseRef);
const headVersion = JSON.parse(readFileSync("package.json", "utf8")).version;

if (compareSemver(headVersion, baseVersion) <= 0) {
  console.error(
    `version:check fail — publishable files changed but package.json version did not increase (${baseVersion} -> ${headVersion}). Bump patch/minor/major per issue metadata.`,
  );
  process.exit(1);
}

if (!changed.includes("CHANGELOG.md")) {
  console.error(
    "version:check fail — publishable files changed and version bumped, but CHANGELOG.md was not updated in this PR.",
  );
  process.exit(1);
}

console.log(
  `version:check ok — ${baseVersion} -> ${headVersion}, CHANGELOG.md updated`,
);
process.exit(0);
