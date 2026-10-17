import type { Locale } from "./config";
import itDictionary from "./dictionaries/it-IT";
import enDictionary from "./dictionaries/en-US";
import { registrationClosureCopy } from "./dictionaries/registration-closure";
import zhDictionary from "./dictionaries/zh-CN";

export type Dictionary = typeof itDictionary & typeof registrationClosureCopy["it-IT"];
export type DictionaryKey = keyof Dictionary;

const dictionaries: Record<Locale, Dictionary> = {
  "en-US": { ...enDictionary, ...registrationClosureCopy["en-US"] },
  "it-IT": { ...itDictionary, ...registrationClosureCopy["it-IT"] },
  "zh-CN": { ...zhDictionary, ...registrationClosureCopy["zh-CN"] },
};

export function getDictionary(locale: Locale) {
  return dictionaries[locale];
}

export { translate } from "./translate";
