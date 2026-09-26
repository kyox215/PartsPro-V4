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

export { translate } from "./translate";
