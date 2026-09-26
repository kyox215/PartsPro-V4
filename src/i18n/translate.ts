import type { Dictionary, DictionaryKey } from "./get-dictionary";

// Pure translation: importing this in a client component must not load the
// server's complete dictionaries for every locale.
export function translate(
  dictionary: Dictionary,
  key: DictionaryKey | string,
  params?: Record<string, string | number>
) {
  const template = dictionary[key as DictionaryKey] ?? key;
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template
  );
}
