import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  formatZodIssues,
  readJsonBody,
} from "@/lib/partspro-api";
import {
  clearCurrentCustomerCart,
  readCurrentCustomerCart,
  replaceCurrentCustomerCart,
  RepositoryWriteError,
} from "@/lib/partspro-repository";
import { toPublicSku } from "@/lib/partspro-sku";
import { isSupabaseConfigured } from "@/lib/supabase/env";

const cartItemSchema = z
  .object({
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    quantity: z.coerce.number().int().min(1).max(999),
  })
  .strict();

const replaceCartSchema = z
  .object({
    items: z.array(cartItemSchema).max(100),
  })
  .strict();

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = remoteCartUnavailableResponse();

  if (unavailable) {
    return unavailable;
  }

  try {
    const result = await readCurrentCustomerCart();

    return NextResponse.json({
      data: {
        items: result.data.map(toCartItemDto),
      },
      meta: {
        source: result.source,
        persistence: "supabase_cart",
      },
    });
  } catch (error) {
    if (
      error instanceof RepositoryWriteError &&
      (error.status === 401 || error.status === 404)
    ) {
      return apiError(
        error.status,
        error.status === 401 ? "LOGIN_REQUIRED" : "CUSTOMER_REQUIRED",
        error.status === 401
          ? "Login is required before using the remote cart."
          : "A customer account is required before using the remote cart."
      );
    }

    return cartRouteError(error, "CUSTOMER_CART_UNAVAILABLE");
  }
}

export async function PUT(request: Request) {
  const unavailable = remoteCartUnavailableResponse();

  if (unavailable) {
    return unavailable;
  }

  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = replaceCartSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_CART_PAYLOAD", "Cart payload is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const cart = await replaceCurrentCustomerCart(
      result.data.items.map((item) => ({
        quantity: item.quantity,
        sku: toPublicSku(item.sku),
      }))
    );

    return NextResponse.json({
      data: {
        items: cart.data.map(toCartItemDto),
      },
      meta: {
        source: cart.source,
        persistence: "supabase_cart",
      },
    });
  } catch (error) {
    return cartRouteError(error, "CUSTOMER_CART_SAVE_FAILED");
  }
}

export async function DELETE() {
  const unavailable = remoteCartUnavailableResponse();

  if (unavailable) {
    return unavailable;
  }

  try {
    const result = await clearCurrentCustomerCart();

    return NextResponse.json({
      data: {
        items: [],
      },
      meta: {
        source: result.source,
        persistence: "supabase_cart",
      },
    });
  } catch (error) {
    return cartRouteError(error, "CUSTOMER_CART_CLEAR_FAILED");
  }
}

function remoteCartUnavailableResponse() {
  if (isSupabaseConfigured()) {
    return null;
  }

  return apiError(
    503,
    "SUPABASE_NOT_CONFIGURED",
    "Supabase must be configured before remote cart can be used."
  );
}

function cartRouteError(error: unknown, fallbackCode: string) {
  if (error instanceof RepositoryWriteError) {
    if (error.status === 401) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required before using the remote cart.");
    }

    return apiError(error.status, error.code, error.message, error.details);
  }

  return apiError(500, fallbackCode, "Customer cart is temporarily unavailable.");
}

function toCartItemDto(item: {
  quantity: number;
  sku: string;
}) {
  return {
    quantity: item.quantity,
    sku: item.sku,
  };
}
