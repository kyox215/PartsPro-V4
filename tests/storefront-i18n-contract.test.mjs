import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storefrontDictionaryPath = path.join(
  repoRoot,
  "src/i18n/dictionaries/storefront.ts"
);
const italianBaseDictionaryPath = path.join(
  repoRoot,
  "src/i18n/dictionaries/it-IT.ts"
);
const localeContractFiles = [
  "src/components/partspro/cart-page.tsx",
  "src/components/partspro/checkout-client.tsx",
  "src/components/partspro/checkout-page.tsx",
  "src/components/partspro/checkout-submit-button.tsx",
  "src/components/partspro/order-summary-card.tsx",
  "src/components/partspro/storefront-commerce-status.tsx",
];

const storefrontDictionarySource = fs.readFileSync(
  storefrontDictionaryPath,
  "utf8"
);
const italianStart = storefrontDictionarySource.indexOf(
  "export const storefrontItIT"
);
const chineseStart = storefrontDictionarySource.indexOf(
  "export const storefrontZhCN"
);

assert.notEqual(italianStart, -1, "storefrontItIT export was not found");
assert.notEqual(chineseStart, -1, "storefrontZhCN export was not found");

const italianStorefront = parseStringDictionary(
  storefrontDictionarySource.slice(italianStart, chineseStart)
);
const chineseStorefront = parseStringDictionary(
  storefrontDictionarySource.slice(chineseStart)
);
const italianBase = parseStringDictionary(
  fs.readFileSync(italianBaseDictionaryPath, "utf8")
);

test("storefront Italian and Chinese dictionaries expose the same keys", () => {
  const italianKeys = new Set(sortedKeys(italianStorefront));
  const chineseKeys = new Set(sortedKeys(chineseStorefront));
  const missingItalian = [...chineseKeys].filter((key) => !italianKeys.has(key));
  const missingChinese = [...italianKeys].filter((key) => !chineseKeys.has(key));

  assert.deepEqual(
    missingItalian,
    [],
    `Keys missing from storefrontItIT:\n${missingItalian.join("\n")}`
  );
  assert.deepEqual(
    missingChinese,
    [],
    `Keys missing from storefrontZhCN:\n${missingChinese.join("\n")}`
  );
});

test("every literal storefront tx/txFormat key exists in both locale dictionaries", () => {
  const references = collectStorefrontTranslationReferences(
    localeContractFiles.map((relativePath) => path.join(repoRoot, relativePath))
  );
  const missingItalian = [];
  const missingChinese = [];

  for (const reference of references) {
    if (!(reference.key in italianStorefront)) {
      missingItalian.push(formatReference(reference));
    }

    if (!(reference.key in chineseStorefront)) {
      missingChinese.push(formatReference(reference));
    }
  }

  assert.deepEqual(
    missingItalian,
    [],
    `Missing storefrontItIT keys:\n${missingItalian.join("\n")}`
  );
  assert.deepEqual(
    missingChinese,
    [],
    `Missing storefrontZhCN keys:\n${missingChinese.join("\n")}`
  );
});

test("Italian customer-facing dictionary values do not leak Han characters", () => {
  const allowedHanKeys = new Set([
    // The language picker intentionally displays the native Chinese label.
    "language.zh-CN",
  ]);
  const italianDictionary = { ...italianBase, ...italianStorefront };
  const leakingEntries = Object.entries(italianDictionary)
    .filter(([key, value]) =>
      !allowedHanKeys.has(key) && /\p{Script=Han}/u.test(value)
    )
    .map(([key, value]) => `${key}: ${JSON.stringify(value)}`);

  assert.deepEqual(
    leakingEntries,
    [],
    `Italian dictionary values must not contain Han characters:\n${leakingEntries.join("\n")}`
  );
});

function collectStorefrontTranslationReferences(filePaths) {
  const references = [];

  for (const filePath of filePaths) {
    const source = fs.readFileSync(filePath, "utf8");
    const matcher = /\btx(?:Format)?\(\s*t\s*,\s*["'](storefront\.[^"']+)["']/g;

    for (const match of source.matchAll(matcher)) {
      references.push({
        filePath,
        key: match[1],
        line: source.slice(0, match.index).split("\n").length,
      });
    }
  }

  return references.sort((left, right) =>
    left.key.localeCompare(right.key) ||
    left.filePath.localeCompare(right.filePath) ||
    left.line - right.line
  );
}

function parseStringDictionary(source) {
  const dictionary = {};
  const propertyMatcher = /^\s*"([^"]+)"\s*:\s*"((?:\\.|[^"\\])*)"/gm;

  for (const match of source.matchAll(propertyMatcher)) {
    dictionary[match[1]] = JSON.parse(`"${match[2]}"`);
  }

  return dictionary;
}

function sortedKeys(dictionary) {
  return Object.keys(dictionary).sort();
}

function formatReference({ filePath, key, line }) {
  return `${path.relative(repoRoot, filePath)}:${line} ${key}`;
}
