export type AddressDraft = {
  city: string;
  extra: string;
  postalCode: string;
  province: string;
  street: string;
  streetNumber: string;
};

export type AddressDraftField = keyof AddressDraft;

export function emptyAddressDraft(): AddressDraft {
  return {
    city: "",
    extra: "",
    postalCode: "",
    province: "",
    street: "",
    streetNumber: "",
  };
}

export function parseAddressDraft(address: string | null | undefined): AddressDraft {
  const normalized = normalizeAddressText(address);

  if (!normalized) {
    return emptyAddressDraft();
  }

  const match = normalized.match(
    /^(.+)\s+([^,\s]+),\s*([0-9A-Za-z-]+)\s+(.+)\s+\(([^)]+)\)(?:\s+-\s*(.+))?$/
  );

  if (!match) {
    return {
      ...emptyAddressDraft(),
      street: normalized,
    };
  }

  return {
    city: match[4]?.trim() ?? "",
    extra: match[6]?.trim() ?? "",
    postalCode: normalizeItalianPostalCode(match[3]?.trim() ?? ""),
    province: match[5]?.trim() ?? "",
    street: match[1]?.trim() ?? "",
    streetNumber: match[2]?.trim() ?? "",
  };
}

export function formatAddressDraft(address: AddressDraft) {
  const street = address.street.trim();
  const streetNumber = address.streetNumber.trim();
  const postalCode = normalizeItalianPostalCode(address.postalCode);
  const city = address.city.trim();
  const province = address.province.trim();
  const extra = address.extra.trim();
  const base = `${street} ${streetNumber}, ${postalCode} ${city} (${province})`;

  return extra ? `${base} - ${extra}` : base;
}

export function isAddressDraftComplete(address: AddressDraft) {
  return Boolean(
    address.province.trim() &&
      address.city.trim() &&
      normalizeItalianPostalCode(address.postalCode).length === 5 &&
      address.street.trim() &&
      address.streetNumber.trim()
  );
}

export function normalizeAddressText(address: string | null | undefined) {
  return (address ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeItalianPostalCode(postalCode: string) {
  return postalCode.replace(/\D/g, "").slice(0, 5);
}
