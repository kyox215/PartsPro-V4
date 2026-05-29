import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { apiError, formatZodIssues, readJsonBody } from "@/lib/partspro-api";
import { RepositoryWriteError, saveB2BApplication } from "@/lib/partspro-repository";

const optionalTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value && value.length > 0 ? value : undefined));

const b2bApplicationSchema = z
  .object({
    companyName: z.string().trim().min(2).max(120),
    partitaIva: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^(IT)?[0-9]{11}$/),
    codiceFiscale: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{11,16}$/),
    pec: z.string().trim().email().max(160).optional(),
    codiceDestinatario: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{7}$/)
      .optional(),
    contactName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(160),
    phone: optionalTrimmedString(40),
    city: z.string().trim().min(2).max(80),
    province: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/),
    address: optionalTrimmedString(160),
    website: z.string().trim().url().max(200).optional(),
    notes: optionalTrimmedString(1000),
    acceptsTerms: z.literal(true),
    acceptsPrivacy: z.literal(true),
  })
  .strict();

export async function GET() {
  return NextResponse.json({
    data: [],
    meta: {
      source: "empty",
      total: 0,
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = b2bApplicationSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_B2B_APPLICATION_PAYLOAD", "B2B application payload is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const { acceptsPrivacy, acceptsTerms, ...applicationInput } = result.data;

    if (!acceptsPrivacy || !acceptsTerms) {
      return apiError(400, "CONSENT_REQUIRED", "Application consent is required.");
    }

    const saved = await saveB2BApplication(applicationInput);

    return NextResponse.json(
      {
        data: saved.data,
        meta: {
          source: saved.source,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RepositoryWriteError) {
      return apiError(error.status, error.code, error.message);
    }

    return apiError(
      500,
      "B2B_APPLICATION_CREATE_FAILED",
      "B2B application could not be created at this time."
    );
  }
}
