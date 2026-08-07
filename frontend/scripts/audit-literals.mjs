import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = path.join(root, "src");
const allowlistPath = path.join(root, "scripts", "literal-allowlist.json");
const allowlist = JSON.parse(await readFile(allowlistPath, "utf8"));
for (const [index, entry] of allowlist.entries()) {
  if (!entry.reason || !entry.owner) {
    throw new Error(`literal allowlist entry ${index + 1} needs reason and owner`);
  }
}
const findings = [];
const userVisibleProperties = new Set([
  "ariaLabel",
  "category",
  "description",
  "emptyText",
  "label",
  "message",
  "placeholder",
  "title",
]);

function propertyName(node) {
  if (ts.isIdentifier(node) || ts.isStringLiteral(node)) return node.text;
  return "";
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts") && !entry.name.endsWith(".test.tsx")) files.push(fullPath);
  }
  return files;
}

function isAllowed(file, line, value) {
  return allowlist.some((entry) => {
    if (entry.file && entry.file !== file) return false;
    if (entry.owner && !file.startsWith(entry.owner)) return false;
    if (entry.line && entry.line !== line) return false;
    return new RegExp(entry.pattern).test(value);
  });
}

for (const file of await sourceFiles(sourceRoot)) {
  const text = await readFile(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const relative = path.relative(root, file).replaceAll("\\", "/");
  const inspect = (node) => {
    const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
    if (ts.isJsxText(node)) {
      const value = node.text.replace(/\s+/g, " ").trim();
      if (/[A-Za-z]{2,}/.test(value) && !isAllowed(relative, line, value)) findings.push(`${relative}:${line}: ${value}`);
    }
    if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && /^(aria-label|title|placeholder|alt|label)$/.test(node.name.text)) {
      const value = node.initializer.text;
      if (/[A-Za-z]{2,}/.test(value) && !isAllowed(relative, line, value)) findings.push(`${relative}:${line}: ${value}`);
    }
    if (
      ts.isPropertyAssignment(node) &&
      userVisibleProperties.has(propertyName(node.name)) &&
      (ts.isStringLiteral(node.initializer) || ts.isNoSubstitutionTemplateLiteral(node.initializer))
    ) {
      const value = node.initializer.text.trim();
      if (/[A-Za-z]{2,}/.test(value) && !isAllowed(relative, line, value)) findings.push(`${relative}:${line}: ${value}`);
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^alert$|^set\w*Error$/.test(node.expression.text) && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      const value = node.arguments[0].text;
      if (value && !isAllowed(relative, line, value)) findings.push(`${relative}:${line}: ${value}`);
    }
    ts.forEachChild(node, inspect);
  };
  inspect(source);
}

if (findings.length) {
  console.error(findings.join("\n"));
  process.exit(1);
}
console.log("literal audit passed");
