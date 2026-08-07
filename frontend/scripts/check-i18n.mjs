import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { fileURLToPath } from "node:url";
import { languages, namespaces } from "./i18n-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const localeRoot = path.join(root, "src", "i18n", "locales");
const sourceRoot = path.join(root, "src");
const interpolationPattern = /{{\s*([A-Za-z_$][\w$]*)\s*(?:,[^}]*)?}}/g;
const errors = [];

function flatten(value, prefix = "", result = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof child === "string") result.set(next, child);
    else if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, next, result);
    } else {
      errors.push(`Locale value ${next} must be a string or object`);
    }
  }
  return result;
}

function params(message) {
  return [...new Set([...message.matchAll(interpolationPattern)].map((m) => m[1]))]
    .sort()
    .join(",");
}

const resources = {};
for (const language of languages) {
  resources[language] = {};
  for (const namespace of namespaces) {
    const filename = path.join(localeRoot, language, `${namespace}.json`);
    resources[language][namespace] = flatten(
      JSON.parse(await readFile(filename, "utf8")),
    );
  }
}

for (const namespace of namespaces) {
  const english = resources.en[namespace];
  const englishKeys = [...english.keys()].sort();
  for (const language of languages.filter((value) => value !== "en")) {
    const translated = resources[language][namespace];
    const translatedKeys = [...translated.keys()].sort();
    for (const key of englishKeys.filter((value) => !translated.has(value))) {
      errors.push(`${language}/${namespace} is missing ${key}`);
    }
    for (const key of translatedKeys.filter((value) => !english.has(value))) {
      errors.push(`${language}/${namespace} has extra key ${key}`);
    }
    for (const key of englishKeys.filter((value) => translated.has(value))) {
      if (params(english.get(key)) !== params(translated.get(key))) {
        errors.push(`${language}/${namespace}:${key} has different interpolation parameters`);
      }
    }
  }
}

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(fullPath)));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function verifyKey(file, source, rawKey, defaultNamespace, node) {
  const separator = rawKey.indexOf(":");
  const namespace = separator >= 0 ? rawKey.slice(0, separator) : defaultNamespace;
  const key = separator >= 0 ? rawKey.slice(separator + 1) : rawKey;
  if (!namespace || !namespaces.includes(namespace)) return;
  if (!resources.en[namespace].has(key)) {
    const position = source.getLineAndCharacterOfPosition(node.getStart(source));
    errors.push(
      `${path.relative(root, file)}:${position.line + 1}:${position.character + 1} references missing ${namespace}:${key}`,
    );
  }
}

for (const file of await sourceFiles(sourceRoot)) {
  const text = await readFile(file, "utf8");
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const fileNamespaces = new Set();
  function collect(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useTranslation" &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      fileNamespaces.add(node.arguments[0].text);
    }
    ts.forEachChild(node, collect);
  }
  collect(source);
  const defaultNamespace = fileNamespaces.size === 1 ? [...fileNamespaces][0] : undefined;
  function inspect(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "t" &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      verifyKey(file, source, node.arguments[0].text, defaultNamespace, node);
    }
    if (ts.isJsxOpeningLikeElement(node) && node.tagName.getText(source) === "Trans") {
      let key;
      let namespace = defaultNamespace;
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || !attribute.initializer) continue;
        if (ts.isStringLiteral(attribute.initializer)) {
          if (attribute.name.getText(source) === "i18nKey") key = attribute.initializer.text;
          if (attribute.name.getText(source) === "ns") namespace = attribute.initializer.text;
        }
      }
      if (key) verifyKey(file, source, key, namespace, node);
    }
    ts.forEachChild(node, inspect);
  }
  inspect(source);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`i18n check passed for ${languages.length} languages and ${namespaces.length} namespaces.`);
