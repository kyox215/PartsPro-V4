export type DeviceModelSeriesGroup = {
  series: string;
  models: string[];
};

const emptySeries = "";

export function shouldUseDeviceSeries(brand: string | null | undefined) {
  return normalizeToken(brand) !== "apple";
}

export function inferDeviceModelSeries(
  brand: string | null | undefined,
  model: string | null | undefined
) {
  const brandKey = normalizeToken(brand);
  const value = normalizeModelName(model);

  if (!brandKey || !value || brandKey === "apple") {
    return null;
  }

  switch (brandKey) {
    case "samsung":
      return inferSamsungSeries(value);
    case "xiaomi":
      return inferXiaomiSeries(value);
    case "honor":
      return inferHonorSeries(value);
    case "oppo":
      return inferOppoSeries(value);
    case "realme":
      return inferRealmeSeries(value);
    case "motorola":
      return inferMotorolaSeries(value);
    case "vivo":
      return inferVivoSeries();
    case "tcl":
      return inferTclSeries();
    default:
      return `${titleCaseBrand(brandKey)} Other`;
  }
}

export function normalizeDeviceModelSeries(
  brand: string | null | undefined,
  series: string | null | undefined,
  model?: string | null
) {
  const brandKey = normalizeToken(brand);
  const value = normalizeModelName(series);
  const inferred = inferDeviceModelSeries(brand, model) ?? null;

  if (value && shouldUseDeviceSeries(brand)) {
    return canonicalExplicitSeries(brandKey, value, inferred) ?? value;
  }

  return inferred;
}

export function deviceModelSeriesFilterValues(
  brand: string | null | undefined,
  series: string | null | undefined
) {
  const canonical = normalizeDeviceModelSeries(brand, series);
  const brandKey = normalizeToken(brand);
  const values = new Set<string>();

  if (canonical) {
    values.add(canonical);
  }

  const value = normalizeModelName(series);
  if (value) {
    values.add(value);
  }

  for (const alias of legacySeriesAliases(brandKey, canonical ?? value)) {
    values.add(alias);
  }

  return Array.from(values);
}

function inferSamsungSeries(model: string) {
  if (/\bgalaxy\s+(?:z|fold)\b/i.test(model)) {
    return "Galaxy Z";
  }

  if (/\bgalaxy\s+note\b/i.test(model)) {
    return "Galaxy Note";
  }

  if (/\bgalaxy\s+xcover\b/i.test(model)) {
    return "Galaxy Xcover";
  }

  const match = model.match(/\bgalaxy\s+([samj])\s*\d/i);
  if (match) {
    return `Galaxy ${match[1].toUpperCase()}`;
  }

  return "Galaxy Other";
}

function inferXiaomiSeries(model: string) {
  if (/^mix\b/i.test(model)) {
    return "Mi Mix / Max";
  }

  if (/^redmi\s+note\b/i.test(model)) {
    return "Redmi Note";
  }

  if (/^redmi\b/i.test(model)) {
    return "Redmi";
  }

  if (/^(poco|pocophone)\b/i.test(model) || /^black\s+shark\b/i.test(model)) {
    return "Poco/Shark";
  }

  if (/^mi\s+(mix|max)\b/i.test(model)) {
    return "Mi Mix / Max";
  }

  if (/^mi\b/i.test(model)) {
    return "Mi";
  }

  return "Xiaomi";
}

function inferHonorSeries(model: string) {
  if (matchesHonorNumberSeries(model, ["5", "6", "7", "8", "9"])) {
    return "Series 5/6/7/8/9";
  }

  if (matchesHonorNumberSeries(model, ["10", "20", "50"])) {
    return "Series 10/20/50";
  }

  if (matchesHonorNumberSeries(model, ["70", "90", "200", "300", "400", "600"])) {
    return "Series 70/90/200/300/400";
  }

  if (/\b(magic|view)\b/i.test(model) || /^(?:honor\s+)?play$/i.test(model)) {
    return "Series Magic / Play / View";
  }

  if (/\bplay\b/i.test(model)) {
    return "Series Play";
  }

  if (/\bx\s*\d/i.test(model)) {
    return "Series X";
  }

  return "Honor Other";
}

function inferOppoSeries(model: string) {
  if (/\bfind\b/i.test(model)) {
    return "Find";
  }

  if (/\breno(?:\b|\s*\d)/i.test(model)) {
    return "Reno";
  }

  const match = model.match(/\b(a|f|rx)\s*\d/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return "OPPO Other";
}

function inferRealmeSeries(model: string) {
  if (matchesRealmeNumberSeries(model, ["5", "6", "7"])) {
    return "Series 5/6/7";
  }

  if (matchesRealmeNumberSeries(model, ["8", "9", "10"])) {
    return "Series 8/9/10";
  }

  if (matchesRealmeNumberSeries(model, ["11", "12", "14", "16"])) {
    return "Series 11/12/14/16";
  }

  if (/\b(narzo|note)\b/i.test(model)) {
    return "Series narzo / Note";
  }

  if (/\b(?:c\s*\d|gt(?:\s*\d|\b)|x\s*\d|p\s*\d)/i.test(model)) {
    return "Series C/GT/X/P";
  }

  return "Realme Other";
}

function inferMotorolaSeries(model: string) {
  if (/\bedge\b/i.test(model)) {
    return "Edge";
  }

  if (/\brazr\b/i.test(model)) {
    return "Razr";
  }

  if (/\bmoto\s+g(?:\b|\d)/i.test(model) || /^g\s*\d/i.test(model)) {
    return "Moto G";
  }

  if (/\bmoto\s+e(?:\b|\d)/i.test(model) || /^e\s*\d/i.test(model)) {
    return "Moto E";
  }

  if (/\bmoto\s+[xz](?:\b|\d)/i.test(model) || /^[xz]\s*\d/i.test(model)) {
    return "Moto X/Z";
  }

  if (
    /\b(one|defy|thinkphone|moto\s+c(?:\b|\d))\b/i.test(model) ||
    /^c\s*\d/i.test(model)
  ) {
    return "Series One/C/Defy";
  }

  return "Motorola Other";
}

function inferVivoSeries() {
  return "Vivo";
}

function canonicalExplicitSeries(
  brandKey: string,
  series: string,
  inferred: string | null
) {
  const key = normalizeSeriesKey(series);

  if (brandKey === "xiaomi") {
    if (["poco", "pocophone", "black shark", "poco/shark", "poco shark", "poco/shark series", "poco shark series"].includes(key)) {
      return "Poco/Shark";
    }
  }

  if (brandKey === "honor") {
    if (["honor magic", "honor view", "series magic play view", "series magic/play/view"].includes(key)) {
      return "Series Magic / Play / View";
    }

    if (["honor play", "series play"].includes(key)) {
      return inferred?.startsWith("Series ") ? inferred : "Series Play";
    }

    if (["honor x", "series x"].includes(key)) {
      return "Series X";
    }

    if (key === "honor number") {
      return inferred?.startsWith("Series ") ? inferred : null;
    }
  }

  if (brandKey === "realme") {
    if (["narzo", "note", "series narzo note", "series narzo/note"].includes(key)) {
      return "Series narzo / Note";
    }

    if (["c", "gt", "x", "p", "series c gt x p", "series c/gt/x/p"].includes(key)) {
      return "Series C/GT/X/P";
    }

    if (key === "realme number") {
      return inferred?.startsWith("Series ") ? inferred : null;
    }
  }

  if (brandKey === "samsung" && key === "galaxy xcover") {
    return "Galaxy Xcover";
  }

  if (brandKey === "vivo") {
    if (["iqoo", "vivo v", "vivo x", "vivo y", "vivo t", "vivo s"].includes(key)) {
      return "Vivo";
    }
  }

  if (brandKey === "tcl" && key === "tcl nxtpaper") {
    return "TCL";
  }

  if (brandKey === "motorola") {
    if (key === "one/c/defy" || key === "series one/c/defy") {
      return "Series One/C/Defy";
    }
  }

  return null;
}

function legacySeriesAliases(brandKey: string, series: string) {
  const key = normalizeSeriesKey(series);

  if (brandKey === "xiaomi" && key === "poco/shark") {
    return ["POCO", "Black Shark"];
  }

  if (brandKey === "samsung" && key === "galaxy xcover") {
    return ["Galaxy XCover"];
  }

  if (brandKey === "honor") {
    switch (key) {
      case "series magic/play/view":
        return ["Honor Magic", "Honor View"];
      case "series play":
        return ["Honor Play"];
      case "series x":
        return ["Honor X"];
      case "series 5/6/7/8/9":
      case "series 10/20/50":
      case "series 70/90/200/300/400":
        return ["Honor Number"];
      default:
        return [];
    }
  }

  if (brandKey === "realme") {
    switch (key) {
      case "series narzo/note":
        return ["Narzo", "Note"];
      case "series c/gt/x/p":
        return ["C", "GT", "X", "P"];
      case "series 5/6/7":
      case "series 8/9/10":
      case "series 11/12/14/16":
        return ["Realme Number"];
      default:
        return [];
    }
  }

  if (brandKey === "vivo" && key === "vivo") {
    return ["iQOO", "Vivo V", "Vivo X", "Vivo Y", "Vivo T", "Vivo S"];
  }

  if (brandKey === "tcl" && key === "tcl") {
    return ["TCL NXTPAPER"];
  }

  if (brandKey === "motorola" && key === "series one/c/defy") {
    return ["One/C/Defy"];
  }

  return [];
}

function matchesHonorNumberSeries(model: string, prefixes: string[]) {
  return matchesNumberSeries(model, /^(?:honor\s+)?/i, prefixes);
}

function matchesRealmeNumberSeries(model: string, prefixes: string[]) {
  return matchesNumberSeries(model, /^(?:realme\s+)?/i, prefixes);
}

function matchesNumberSeries(model: string, brandPrefix: RegExp, prefixes: string[]) {
  const value = model.replace(brandPrefix, "");
  return prefixes.some((prefix) => new RegExp(`^${prefix}(?:\\b|[a-z])`, "i").test(value));
}

function inferTclSeries() {
  return "TCL";
}

function normalizeModelName(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string | null | undefined) {
  return normalizeModelName(value).toLowerCase();
}

function normalizeSeriesKey(value: string) {
  return normalizeToken(value)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ");
}

function titleCaseBrand(value: string) {
  if (!value) {
    return emptySeries;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
