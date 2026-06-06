"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  type AddressDraft,
  type AddressDraftField,
  normalizeItalianPostalCode,
} from "@/lib/partspro-address-draft";
import type { ItalyCapLookupResult } from "@/lib/italy-cap-lookup";

type AddressDraftFieldsProps<AddressKey extends string> = {
  addressKey: AddressKey;
  idPrefix?: string;
  onChange: (addressKey: AddressKey, field: AddressDraftField, value: string) => void;
  title: string;
  value: AddressDraft;
};

export function AddressDraftFields<AddressKey extends string>({
  addressKey,
  idPrefix = "account-profile",
  onChange,
  title,
  value,
}: AddressDraftFieldsProps<AddressKey>) {
  const [capMatches, setCapMatches] = React.useState<ItalyCapLookupResult[]>([]);
  const candidateSelectId = `${idPrefix}-${addressKey}-cap-candidate`;
  const postalCode = normalizeItalianPostalCode(value.postalCode);
  const visibleCapMatches = postalCode.length === 5 ? capMatches : [];
  const selectedCapMatchValue = getSelectedCapMatchValue(visibleCapMatches, value);

  const applyCapMatch = React.useCallback(
    (match: ItalyCapLookupResult) => {
      onChange(addressKey, "province", match.provinceCode);
      onChange(addressKey, "city", match.city);
    },
    [addressKey, onChange]
  );

  React.useEffect(() => {
    let active = true;

    if (postalCode.length !== 5) {
      return () => {
        active = false;
      };
    }

    import("@/lib/italy-cap-lookup")
      .then(({ lookupItalyCap }) => {
        if (!active) {
          return;
        }

        const matches = lookupItalyCap(postalCode);
        setCapMatches(matches);

        if (matches.length === 1) {
          applyCapMatch(matches[0]);
        }
      })
      .catch(() => {
        if (active) {
          setCapMatches([]);
        }
      });

    return () => {
      active = false;
    };
  }, [applyCapMatch, postalCode]);

  function updateField(field: AddressDraftField, nextValue: string) {
    onChange(
      addressKey,
      field,
      field === "postalCode" ? normalizeItalianPostalCode(nextValue) : nextValue
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="mb-3 text-sm font-black text-slate-700">{title}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        <AddressInput
          id={`${idPrefix}-${addressKey}-postalCode`}
          field="postalCode"
          label="CAP"
          inputMode="numeric"
          maxLength={5}
          required
          value={value.postalCode}
          onChange={updateField}
        />
        <AddressInput
          id={`${idPrefix}-${addressKey}-province`}
          field="province"
          label="省 / Provincia"
          required
          value={value.province}
          onChange={updateField}
        />
        <AddressInput
          id={`${idPrefix}-${addressKey}-city`}
          field="city"
          label="城市 / Citta"
          required
          value={value.city}
          onChange={updateField}
        />
        {visibleCapMatches.length > 1 ? (
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor={candidateSelectId} className="text-xs font-black text-slate-500">
              CAP 匹配城市
            </Label>
            <Select
              value={selectedCapMatchValue}
              onValueChange={(matchValue) => {
                const nextMatch = visibleCapMatches.find(
                  (match) => getCapMatchValue(match) === matchValue
                );

                if (nextMatch) {
                  applyCapMatch(nextMatch);
                }
              }}
            >
              <SelectTrigger id={candidateSelectId} className="w-full bg-white">
                <SelectValue placeholder="请选择城市 / Provincia" />
              </SelectTrigger>
              <SelectContent>
                {visibleCapMatches.map((match) => (
                  <SelectItem key={getCapMatchValue(match)} value={getCapMatchValue(match)}>
                    {match.city} ({match.provinceCode})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
        <AddressInput
          id={`${idPrefix}-${addressKey}-street`}
          field="street"
          label="街道 / Via"
          required
          value={value.street}
          onChange={updateField}
        />
        <AddressInput
          id={`${idPrefix}-${addressKey}-streetNumber`}
          field="streetNumber"
          label="门牌 / Numero"
          required
          value={value.streetNumber}
          onChange={updateField}
        />
        <AddressInput
          id={`${idPrefix}-${addressKey}-extra`}
          field="extra"
          label="补充信息"
          value={value.extra}
          onChange={updateField}
        />
      </div>
    </section>
  );
}

type AddressInputProps = {
  field: AddressDraftField;
  id: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  label: string;
  maxLength?: number;
  onChange: (field: AddressDraftField, value: string) => void;
  required?: boolean;
  value: string;
};

function AddressInput({
  field,
  id,
  inputMode,
  label,
  maxLength,
  onChange,
  required,
  value,
}: AddressInputProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Input
        id={id}
        inputMode={inputMode}
        maxLength={maxLength}
        required={required}
        value={value}
        onChange={(event) => onChange(field, event.currentTarget.value)}
      />
    </div>
  );
}

function getCapMatchValue(match: ItalyCapLookupResult) {
  return `${match.cap}:${match.provinceCode}:${match.city}`;
}

function getSelectedCapMatchValue(
  matches: ItalyCapLookupResult[],
  address: AddressDraft
) {
  const city = address.city.trim();
  const province = address.province.trim().toUpperCase();
  const selectedMatch = matches.find(
    (match) => match.city === city && match.provinceCode === province
  );

  return selectedMatch ? getCapMatchValue(selectedMatch) : "";
}
