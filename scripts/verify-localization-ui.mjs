import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import ts from "typescript";

const root = resolve(import.meta.dirname, "..");
const visibleAttributes = new Set(["alt", "aria-label", "placeholder", "title"]);
const visibleComponentAttributes = new Set(["label", "hint", "detail", "requirementsLabel"]);

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.tsx$/.test(entry.name)) files.push(path);
  }
  return files;
}

function normalize(value) {
  return value.replace(/\s+/g, " ").trim();
}

function hasWords(value) {
  return /[A-Za-zÀ-ÿ]{2}/.test(value);
}

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  return null;
}

function displayLiterals(node) {
  const direct = literalValue(node);
  if (direct !== null) return [{ node, value: direct }];
  if (ts.isTemplateExpression(node)) {
    return [
      { node, value: node.head.text },
      ...node.templateSpans.map(span => ({ node: span.literal, value: span.literal.text })),
    ];
  }
  if (ts.isConditionalExpression(node))
    return [...displayLiterals(node.whenTrue), ...displayLiterals(node.whenFalse)];
  if (ts.isParenthesizedExpression(node)) return displayLiterals(node.expression);
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken)
    return [...displayLiterals(node.left), ...displayLiterals(node.right)];
  return [];
}

const occurrences = [];
for (const path of await sourceFiles(resolve(root, "app"))) {
  const sourceText = await readFile(path, "utf8");
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const record = (node, value) => {
    value = normalize(value);
    if (!value || !hasWords(value)) return;
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    occurrences.push({
      text: value,
      file: relative(root, path).replaceAll("\\", "/"),
      line: position.line + 1,
    });
  };
  const visit = node => {
    if (ts.isJsxText(node)) record(node, node.text);
    if (
      ts.isJsxExpression(node) &&
      node.expression &&
      (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))
    ) {
      for (const item of displayLiterals(node.expression)) record(item.node, item.value);
    }
    if (ts.isJsxAttribute(node)) {
      const opening = node.parent?.parent;
      const tagName = opening && ts.isJsxOpeningLikeElement(opening)
        ? opening.tagName.getText(source)
        : "";
      const customVisible = /^[A-Z]/.test(tagName) && visibleComponentAttributes.has(node.name.text);
      if (!visibleAttributes.has(node.name.text) && !customVisible) {
        ts.forEachChild(node, visit);
        return;
      }
      if (node.initializer && ts.isStringLiteral(node.initializer)) record(node, node.initializer.text);
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        for (const item of displayLiterals(node.initializer.expression)) record(item.node, item.value);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const desktopVisibleProperties = new Set(["title", "message", "detail", "buttons"]);
for (const path of [
  resolve(root, "desktop", "main.mjs"),
  resolve(root, "desktop", "setup.js"),
  resolve(root, "desktop", "loading.js"),
]) {
  const sourceText = await readFile(path, "utf8");
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const record = (node, value) => {
    value = normalize(value);
    if (!value || !hasWords(value) || /^Maglucen(?: Companion| Stardew)/.test(value)) return;
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    occurrences.push({
      text: value,
      file: relative(root, path).replaceAll("\\", "/"),
      line: position.line + 1,
    });
  };
  const recordExpression = expression => {
    for (const item of displayLiterals(expression)) record(item.node, item.value);
  };
  const visit = node => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "progress" &&
      node.arguments[0]
    ) recordExpression(node.arguments[0]);
    if (
      ts.isNewExpression(node) &&
      node.expression.getText(source) === "Error" &&
      node.arguments?.[0]
    ) recordExpression(node.arguments[0]);
    if (ts.isPropertyAssignment(node)) {
      const name = node.name.getText(source).replace(/["']/g, "");
      if (desktopVisibleProperties.has(name)) recordExpression(node.initializer);
    }
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      /(?:textContent|document\.title)$/.test(node.left.getText(source))
    ) recordExpression(node.right);
    ts.forEachChild(node, visit);
  };
  visit(source);
}

if (process.argv.includes("--list")) {
  for (const item of occurrences)
    console.log(`${item.file}:${item.line}\t${item.text}`);
  process.exit(0);
}

if (occurrences.length) {
  console.error("User-facing interface literals must use a key from locales/*.json:");
  for (const item of occurrences) console.error(`  ${item.file}:${item.line}  ${item.text}`);
  process.exit(1);
}

console.log("Localization UI guard passed (React and desktop sources have zero user-facing literals).\n");
