#!/usr/bin/env node

/**
 * False-green 방지 검사.
 *
 * 목적:
 * - 실수로 커밋된 test.only / describe.only 차단
 * - 실패를 숨기는 무조건 skip/fixme 차단
 * - 환경 보호 목적의 조건부 skip은 명시 사유가 있을 때만 허용
 */

const fs = require("fs");
const path = require("path");
const ts = require("typescript");

const ROOT_DIR = path.resolve(__dirname, "..");
const TEST_DIR = path.join(ROOT_DIR, "tests");

function collectSpecFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === "backup" || entry.name === "node_modules") {
        continue;
      }
      files.push(...collectSpecFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".spec.ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

function getPropertyChain(node) {
  if (ts.isIdentifier(node)) {
    return [node.text];
  }

  if (ts.isPropertyAccessExpression(node)) {
    return [...getPropertyChain(node.expression), node.name.text];
  }

  return [];
}

function isLiteralTrue(node) {
  return node.kind === ts.SyntaxKind.TrueKeyword;
}

function isStringLike(node) {
  return (
    ts.isStringLiteral(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isTemplateExpression(node)
  );
}

function hasMeaningfulReason(node) {
  if (!node || !isStringLike(node)) {
    return false;
  }

  const text = node.getText().replace(/^`|`$/g, "").replace(/^"|"$/g, "");
  return text.trim().length >= 10;
}

function isAllowedConditionalSkip(node) {
  const [condition, reason] = node.arguments;

  if (!condition || !reason) {
    return false;
  }

  if (isStringLike(condition) || isLiteralTrue(condition)) {
    return false;
  }

  return hasMeaningfulReason(reason);
}

function getLocation(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${path.relative(ROOT_DIR, sourceFile.fileName)}:${position.line + 1}:${position.character + 1}`;
}

function inspectFile(filePath) {
  const source = fs.readFileSync(filePath, "utf-8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const violations = [];

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const chain = getPropertyChain(node.expression);
      const joined = chain.join(".");

      if (joined.endsWith(".only")) {
        violations.push({
          location: getLocation(sourceFile, node),
          reason: `${joined} 사용 금지`,
        });
      }

      if (joined.endsWith(".fixme")) {
        violations.push({
          location: getLocation(sourceFile, node),
          reason: `${joined} 사용 금지`,
        });
      }

      if (joined.endsWith(".skip") && !isAllowedConditionalSkip(node)) {
        violations.push({
          location: getLocation(sourceFile, node),
          reason:
            "무조건 skip 금지. 환경 보호용 조건부 skip은 조건과 10자 이상의 사유를 함께 남겨야 합니다.",
        });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

const violations = collectSpecFiles(TEST_DIR).flatMap(inspectFile);

if (violations.length > 0) {
  console.error("False-green 방지 검사 실패");
  for (const violation of violations) {
    console.error(`- ${violation.location}: ${violation.reason}`);
  }
  process.exit(1);
}

console.log("False-green 방지 검사 통과");
