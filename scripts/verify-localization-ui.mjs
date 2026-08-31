import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve, relative } from "node:path";
import ts from "typescript";
import baseline from "../tests/localization-jsx-baseline.json" with { type: "json" };

const root = resolve(import.meta.dirname, "..");
const visibleAttributes = new Set(["alt", "aria-label", "placeholder", "title"]);

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

function digest(value) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function literalValue(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  return null;
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
      hash: digest(value),
      text: value,
      file: relative(root, path).replaceAll("\\", "/"),
      line: position.line + 1,
    });
  };
  const visit = node => {
    if (ts.isJsxText(node)) record(node, node.text);
    if (ts.isJsxAttribute(node) && visibleAttributes.has(node.name.text)) {
      if (node.initializer && ts.isStringLiteral(node.initializer)) record(node, node.initializer.text);
      if (node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        const value = literalValue(node.initializer.expression);
        if (value !== null) record(node, value);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const bloomBytes = 2048;
const bloomIndexes = hash => [
  Number.parseInt(hash.slice(0, 4), 16) % (bloomBytes * 8),
  Number.parseInt(hash.slice(4, 8), 16) % (bloomBytes * 8),
  Number.parseInt(hash.slice(8, 12), 16) % (bloomBytes * 8),
];

if (process.argv.includes("--print-baseline")) {
  const bloom = Buffer.alloc(bloomBytes);
  for (const { hash } of occurrences)
    for (const index of bloomIndexes(hash)) bloom[index >> 3] |= 1 << (index & 7);
  process.stdout.write(`${JSON.stringify({ count: occurrences.length, bloom: bloom.toString("base64") }, null, 2)}\n`);
  process.exit(0);
}

const baselineBloom = Buffer.from(baseline.bloom, "base64");
const violations = occurrences.filter(item =>
  bloomIndexes(item.hash).some(index => !(baselineBloom[index >> 3] & (1 << (index & 7)))),
);
if (occurrences.length > baseline.count)
  violations.push({ file: "app", line: 1, text: `literal count increased from ${baseline.count} to ${occurrences.length}` });
if (violations.length) {
  console.error("New user-facing JSX literals must use a key from locales/*.json:");
  for (const item of violations) console.error(`  ${item.file}:${item.line}  ${item.text}`);
  process.exit(1);
}

console.log(`Localization JSX guard passed (${occurrences.length} legacy literals remaining; no new literals).`);
