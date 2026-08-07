import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/i18n/locales/zh-CN");
const files = ["common", "overview", "history", "benchmarks", "settings", "welcome", "errors"];
const violations = [];

function walk(value, keyPath, file) {
  if (typeof value === "string") {
    if (value.includes("...") || value.includes("—")) {
      violations.push(`${file}:${keyPath}: use Chinese ellipsis/punctuation`);
    }
    if (/[\u3400-\u9fff][,:;!?]|[,:;!?][\u3400-\u9fff]/.test(value)) {
      violations.push(`${file}:${keyPath}: ASCII punctuation adjacent to Chinese text`);
    }
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) walk(child, `${keyPath}.${key}`, file);
}

for (const name of files) {
  const file = `${name}.json`;
  walk(JSON.parse(await readFile(path.join(root, file), "utf8")), "", file);
}

if (violations.length) {
  console.error(violations.join("\n"));
  process.exit(1);
}
console.log("zh-CN typography check passed");
