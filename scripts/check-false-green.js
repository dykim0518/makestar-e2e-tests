#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const testsDir = path.join(rootDir, "tests");

const RULES = [
  {
    name: "silent-return",
    description: "spec 내부의 단독 return",
    matches: (line) => /^\s*return;\s*$/.test(line),
  },
  {
    name: "inline-silent-return",
    description: "spec 내부의 조건부 조기 return",
    matches: (line) => /\bif\s*\([^)]*\)\s*return;\s*$/.test(line),
  },
  {
    name: "runtime-skip",
    description: "spec 내부의 test.skip / test.fixme / describe.skip / describe.fixme",
    matches: (line) => /\b(?:test|describe)\.(?:skip|fixme)\b/.test(line),
  },
  {
    name: "placeholder-pass",
    description: "의미 없는 placeholder pass assertion",
    matches: (line) =>
      /expect\((?:true|false)\)\.(?:toBeTruthy|toBeFalsy|toBe)\b/.test(line),
  },
];

const ALLOWLIST = {};

function walkSpecFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkSpecFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function isAllowed(relativePath, ruleName, lineNumber) {
  return ALLOWLIST[relativePath]?.[ruleName]?.has(lineNumber) ?? false;
}

const failures = [];
const scannedFiles = walkSpecFiles(testsDir);

for (const filePath of scannedFiles) {
  const relativePath = path.relative(rootDir, filePath).replace(/\\/g, "/");
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  lines.forEach((line, index) => {
    const lineNumber = index + 1;

    for (const rule of RULES) {
      if (!rule.matches(line)) {
        continue;
      }

      if (isAllowed(relativePath, rule.name, lineNumber)) {
        continue;
      }

      failures.push({
        relativePath,
        lineNumber,
        line: line.trim(),
        ruleName: rule.name,
        description: rule.description,
      });
    }
  });
}

if (failures.length > 0) {
  console.error("❌ false-green guard failed:");
  for (const failure of failures) {
    console.error(
      `- [${failure.ruleName}] ${failure.relativePath}:${failure.lineNumber} ${failure.line}`,
    );
  }
  process.exit(1);
}

const allowlistedCount = Object.values(ALLOWLIST).reduce((count, ruleMap) => {
  return (
    count +
    Object.values(ruleMap).reduce((innerCount, lines) => innerCount + lines.size, 0)
  );
}, 0);

console.log(
  `✅ false-green guard passed (${scannedFiles.length} spec files scanned, allowlist ${allowlistedCount}건)`,
);
