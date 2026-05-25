import type { Locale } from "./config";
import itDictionary from "./dictionaries/it-IT";
import zhDictionary from "./dictionaries/zh-CN";

export type Dictionary = typeof itDictionary;
export type DictionaryKey = keyof Dictionary;

const dictionaries: Record<Locale, Dictionary> = {
  "it-IT": itDictionary,
  "zh-CN": zhDictionary,
};

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export function translate(
  dictionary: Dictionary,
  key: DictionaryKey | string,
  params?: Record<string, string | number>
) {
  const template = dictionary[key as DictionaryKey] ?? key;

  if (!params) {
    return template;
  }

  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}
