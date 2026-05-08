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
const STRICT_PATTERNS_FLAG = "--strict-patterns";

const args = process.argv.slice(2);
const unknownArgs = args.filter((arg) => arg !== STRICT_PATTERNS_FLAG);

if (unknownArgs.length > 0) {
  console.error(`알 수 없는 옵션: ${unknownArgs.join(", ")}`);
  console.error(
    `사용법: node scripts/check-false-green.js [${STRICT_PATTERNS_FLAG}]`,
  );
  process.exit(2);
}

const shouldCheckStrictPatterns = args.includes(STRICT_PATTERNS_FLAG);

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

function isConsoleWarnCall(node) {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  return getPropertyChain(node.expression).join(".") === "console.warn";
}

function isConsoleWarnStatement(node) {
  return ts.isExpressionStatement(node) && isConsoleWarnCall(node.expression);
}

function isEmptyFunctionBody(node) {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
    return ts.isBlock(node.body) && node.body.statements.length === 0;
  }

  return false;
}

function isFalseReturningFunction(node) {
  if (!(ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
    return false;
  }

  if (node.body.kind === ts.SyntaxKind.FalseKeyword) {
    return true;
  }

  return (
    ts.isBlock(node.body) &&
    node.body.statements.length === 1 &&
    ts.isReturnStatement(node.body.statements[0]) &&
    node.body.statements[0].expression?.kind === ts.SyntaxKind.FalseKeyword
  );
}

function getCatchPattern(node) {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return null;
  }

  if (node.expression.name.text !== "catch") {
    return null;
  }

  const [handler] = node.arguments;

  if (!handler) {
    return null;
  }

  if (isEmptyFunctionBody(handler)) {
    return {
      reason: ".catch(() => {}) 사용 금지. 실패가 조용히 무시되어 테스트가 녹색 처리될 수 있습니다.",
    };
  }

  if (isFalseReturningFunction(handler)) {
    return {
      reason: ".catch(() => false) 사용 주의. 실패가 boolean fallback으로 흡수되어 필수 검증이 통과할 수 있습니다.",
    };
  }

  return null;
}

function isExpectTrueToBeTruthy(node) {
  if (!ts.isPropertyAccessExpression(node.expression)) {
    return false;
  }

  if (node.expression.name.text !== "toBeTruthy") {
    return false;
  }

  const expectCall = node.expression.expression;

  return (
    ts.isCallExpression(expectCall) &&
    ts.isIdentifier(expectCall.expression) &&
    expectCall.expression.text === "expect" &&
    expectCall.arguments.length === 1 &&
    isLiteralTrue(expectCall.arguments[0])
  );
}

function getLocation(sourceFile, node) {
  const position = sourceFile.getLineAndCharacterOfPosition(node.getStart());
  return `${path.relative(ROOT_DIR, sourceFile.fileName)}:${position.line + 1}:${position.character + 1}`;
}

function inspectFile(filePath, options = { strictPatterns: false }) {
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
    if (options.strictPatterns && ts.isBlock(node)) {
      const statements = node.statements;

      for (let index = 1; index < statements.length; index += 1) {
        if (
          ts.isReturnStatement(statements[index]) &&
          isConsoleWarnStatement(statements[index - 1])
        ) {
          violations.push({
            location: getLocation(sourceFile, statements[index]),
            reason:
              "console.warn 직후 return 사용 주의. 실패/미검증 상태를 경고만 남기고 통과시킬 수 있습니다.",
          });
        }
      }
    }

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

      if (options.strictPatterns) {
        const catchPattern = getCatchPattern(node);

        if (catchPattern) {
          violations.push({
            location: getLocation(sourceFile, node),
            reason: catchPattern.reason,
          });
        }

        if (isExpectTrueToBeTruthy(node)) {
          violations.push({
            location: getLocation(sourceFile, node),
            reason:
              "expect(true).toBeTruthy() 사용 금지. 상수 assertion은 실제 동작을 검증하지 않습니다.",
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

const scanDir = shouldCheckStrictPatterns ? ROOT_DIR : TEST_DIR;
const violations = collectSpecFiles(scanDir).flatMap((filePath) =>
  inspectFile(filePath, { strictPatterns: shouldCheckStrictPatterns }),
);

if (violations.length > 0) {
  const label = shouldCheckStrictPatterns
    ? "False-green strict 패턴 검사 실패"
    : "False-green 방지 검사 실패";
  console.error(`${label} (${violations.length}건)`);
  for (const violation of violations) {
    console.error(`- ${violation.location}: ${violation.reason}`);
  }
  process.exit(1);
}

console.log(
  shouldCheckStrictPatterns
    ? "False-green strict 패턴 검사 통과"
    : "False-green 방지 검사 통과",
);
