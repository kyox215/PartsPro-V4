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
      return inferVivoSeries(value);
    case "tcl":
      return inferTclSeries(value);
    default:
      return `${titleCaseBrand(brandKey)} Other`;
  }
}

export function normalizeDeviceModelSeries(
  brand: string | null | undefined,
  series: string | null | undefined,
  model?: string | null
) {
  const value = normalizeModelName(series);

  if (value && shouldUseDeviceSeries(brand)) {
    return value;
  }

  return inferDeviceModelSeries(brand, model) ?? null;
}

function inferSamsungSeries(model: string) {
  if (/\bgalaxy\s+z\b/i.test(model)) {
    return "Galaxy Z";
  }

  if (/\bgalaxy\s+note\b/i.test(model)) {
    return "Galaxy Note";
  }

  if (/\bgalaxy\s+xcover\b/i.test(model)) {
    return "Galaxy XCover";
  }

  const match = model.match(/\bgalaxy\s+([samj])\s*\d/i);
  if (match) {
    return `Galaxy ${match[1].toUpperCase()}`;
  }

  return "Galaxy Other";
}

function inferXiaomiSeries(model: string) {
  if (/^redmi\s+note\b/i.test(model)) {
    return "Redmi Note";
  }

  if (/^redmi\b/i.test(model)) {
    return "Redmi";
  }

  if (/^(poco|pocophone)\b/i.test(model)) {
    return "POCO";
  }

  if (/^black\s+shark\b/i.test(model)) {
    return "Black Shark";
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
  if (/\bmagic\b/i.test(model)) {
    return "Honor Magic";
  }

  if (/\bplay\b/i.test(model)) {
    return "Honor Play";
  }

  if (/\bview\b/i.test(model)) {
    return "Honor View";
  }

  if (/\bx\s*\d/i.test(model)) {
    return "Honor X";
  }

  if (/\b\d/.test(model)) {
    return "Honor Number";
  }

  return "Honor Other";
}

function inferOppoSeries(model: string) {
  if (/\bfind\b/i.test(model)) {
    return "Find";
  }

  if (/\breno\b/i.test(model)) {
    return "Reno";
  }

  const match = model.match(/\b(a|f|rx)\s*\d/i);
  if (match) {
    return match[1].toUpperCase();
  }

  return "OPPO Other";
}

function inferRealmeSeries(model: string) {
  if (/\bnarzo\b/i.test(model)) {
    return "Narzo";
  }

  if (/\bnote\b/i.test(model)) {
    return "Note";
  }

  if (/\bgt\b/i.test(model)) {
    return "GT";
  }

  const match = model.match(/\b(c|x|p)\s*\d/i);
  if (match) {
    return match[1].toUpperCase();
  }

  if (/\b\d/.test(model)) {
    return "Realme Number";
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

  if (/\bmoto\s+g\b/i.test(model)) {
    return "Moto G";
  }

  if (/\bmoto\s+e\b/i.test(model)) {
    return "Moto E";
  }

  if (/\bmoto\s+[xz]\b/i.test(model)) {
    return "Moto X/Z";
  }

  if (/\b(one|defy|moto\s+c)\b/i.test(model)) {
    return "One/C/Defy";
  }

  return "Motorola Other";
}

function inferVivoSeries(model: string) {
  const match = model.match(/\b([vxyts])\s*\d/i);
  if (match) {
    return `Vivo ${match[1].toUpperCase()}`;
  }

  if (/\biqoo\b/i.test(model)) {
    return "iQOO";
  }

  return "Vivo";
}

function inferTclSeries(model: string) {
  if (/\bnxtpaper\b/i.test(model)) {
    return "TCL NXTPAPER";
  }

  return "TCL";
}

function normalizeModelName(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeToken(value: string | null | undefined) {
  return normalizeModelName(value).toLowerCase();
}

function titleCaseBrand(value: string) {
  if (!value) {
    return emptySeries;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}
