import { NextResponse } from "next/server";
import { z } from "zod";
import {
  apiError,
  decimal,
  formatZodIssues,
  money,
  readJsonBody,
  toCents,
} from "@/lib/partspro-api";
import {
  applyAccountPriceToProduct,
  canDelegateCheckout,
  getCurrentAccountContext,
  hasOrderableEffectivePrice,
} from "@/lib/partspro-account-context";
import {
  getCustomerProfileById,
  getCurrentCustomerProfile,
  listCatalogProductsBySkus,
  listCompanies,
} from "@/lib/partspro-repository";
import { type CompanyProfile, type PartProduct } from "@/lib/partspro-data";
import { toPublicSku } from "@/lib/partspro-sku";

const previewItemSchema = z
  .object({
    sku: z.string().trim().min(3).max(64).regex(/^[A-Za-z0-9_+.-]+$/),
    quantity: z.coerce.number().int().min(1).max(999),
  })
  .strict();

const previewOrderSchema = z
  .object({
    companyId: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/),
    items: z.array(previewItemSchema).min(1).max(100),
  })
  .strict();

type RequestedPreviewItem = z.infer<typeof previewItemSchema>;
type PreviewIssue = {
  code: string;
  message: string;
  missingFields?: string[];
  moq?: number;
  sku: string;
  stock?: number;
};

type PreviewLine = {
  product: PartProduct;
  quantity: number;
  unitNetCents: number;
  lineNetCents: number;
  vatCents: number;
  lineGrossCents: number;
};

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await readJsonBody(request);

  if (!body.ok) {
    return apiError(400, "INVALID_JSON", "Request body must be valid JSON.");
  }

  const result = previewOrderSchema.safeParse(body.data);

  if (!result.success) {
    return apiError(400, "INVALID_ORDER_PREVIEW_PAYLOAD", "Order preview payload is invalid.", {
      issues: formatZodIssues(result.error),
    });
  }

  try {
    const account = await getCurrentAccountContext({ ensure: true });
    const delegatedCheckout = canDelegateCheckout(account);

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required before checkout preview.");
    }

    if (!delegatedCheckout && account.customer?.status === "active" && !account.canViewPrices) {
      return apiError(
        422,
        "PRICE_ACCESS_REQUIRED",
        "Customer price list must be enabled before checkout.",
        {
          assignmentStatus: account.customer.assignmentStatus,
          customerId: account.customer.id,
          customerType: account.customer.customerType,
        }
      );
    }

    if (!delegatedCheckout && !account.customer?.id) {
      return apiError(
        422,
        "CUSTOMER_PROFILE_INCOMPLETE",
        "Complete the required customer, tax, billing and shipping profile before checkout.",
        {
          accountType: account.accountType,
          customerId: null,
          customerType: null,
        }
      );
    }

    const requestedSkus = result.data.items.map((item) => item.sku);
    const [companies, customerProfile] = await Promise.all([
      listCompanies(),
      delegatedCheckout
        ? getCustomerProfileById(result.data.companyId)
        : getCurrentCustomerProfile(),
    ]);
    const company = resolveCompany(companies.data, result.data.companyId);

    if (!company) {
      return apiError(404, "COMPANY_NOT_FOUND", "Company profile was not found.");
    }

    if (!delegatedCheckout && account.customer?.id && company.id !== account.customer.id) {
      return apiError(403, "COMPANY_FORBIDDEN", "Orders can only be placed for the current customer profile.", {
        companyId: company.id,
        customerId: account.customer.id,
      });
    }

    if (delegatedCheckout && !customerProfile.data) {
      return apiError(404, "COMPANY_NOT_FOUND", "Selected customer profile was not found.");
    }

    const targetCanCheckout = delegatedCheckout
      ? isDelegatedCompanyOrderable(company, customerProfile.data)
      : account.canCheckout;
    const customerIssues = targetCanCheckout && company.status === "approved"
      ? []
      : customerReadinessIssues(company, customerProfile.data);

    if (!targetCanCheckout || company.status !== "approved") {
      return NextResponse.json({
        data: {
          canSubmit: false,
          company: {
            id: company.id,
            name: company.name,
            status: company.status,
          },
          issues: customerIssues,
          lines: [],
          totals: totalsDto(calculateTotals([])),
        },
        meta: {
          source: "checkout_preview",
          companiesSource: companies.source,
          profileSource: customerProfile.source,
          currency: "EUR",
          vatMode: "tax_included_shipping_only",
          ...warningsMeta(companies.warning, customerProfile.warning),
        },
      });
    }

    const catalog = await listCatalogProductsBySkus(requestedSkus, {
      buyerCustomerId: delegatedCheckout ? company.id : undefined,
      includeBuyerPrices: account.canViewPrices || delegatedCheckout,
    });
    const pricedCatalog = catalog.data.map((product) =>
      product.priceResolved || product.priceVersion
        ? product
        : applyAccountPriceToProduct(product, account)
    );
    const orderBuild = buildPreviewOrder(result.data.items, pricedCatalog);
    const totals = calculateTotals(orderBuild.lines);

    return NextResponse.json({
      data: {
        canSubmit:
          targetCanCheckout &&
          company.status === "approved" &&
          orderBuild.issues.length === 0,
        company: {
          id: company.id,
          name: company.name,
          status: company.status,
        },
        issues: orderBuild.issues,
        lines: orderBuild.lines.map(toPreviewLineDto),
        totals: totalsDto(totals),
      },
      meta: {
        source: "checkout_preview",
        catalogSource: catalog.source,
        companiesSource: companies.source,
        profileSource: customerProfile.source,
        currency: "EUR",
        vatMode: "tax_included_shipping_only",
        ...warningsMeta(companies.warning, catalog.warning, customerProfile.warning),
      },
    });
  } catch {
    return apiError(500, "ORDER_PREVIEW_FAILED", "Checkout preview is temporarily unavailable.");
  }
}

function buildPreviewOrder(requestedItems: RequestedPreviewItem[], catalog: PartProduct[]) {
  const seen = new Set<string>();
  const issues: PreviewIssue[] = [];
  const lines: PreviewLine[] = [];
  const catalogBySku = new Map(
    catalog.map((entry) => [toPublicSku(entry.sku), entry])
  );

  for (const item of requestedItems) {
    const sku = toPublicSku(item.sku);

    if (seen.has(sku)) {
      issues.push({ sku, code: "duplicate", message: "Duplicate SKU in cart." });
      continue;
    }

    seen.add(sku);

    const product = catalogBySku.get(sku);

    if (!product) {
      issues.push({ sku, code: "unavailable", message: "SKU is not available in the catalog." });
      continue;
    }

    if (item.quantity < product.moq) {
      issues.push({
        sku,
        code: "moq",
        message: `Quantity must be at least the MOQ (${product.moq}).`,
        moq: product.moq,
      });
      continue;
    }

    if (product.status === "Out of Stock") {
      issues.push({ sku, code: "out_of_stock", message: "Product is currently out of stock." });
      continue;
    }

    if (!hasOrderableEffectivePrice(product)) {
      issues.push({ sku, code: "price_missing", message: "Effective price is not available for this SKU." });
      continue;
    }

    if (item.quantity > product.stock) {
      issues.push({
        sku,
        code: "stock_limit",
        message: `Only ${product.stock} units are currently available.`,
        stock: product.stock,
      });
      continue;
    }

    lines.push(buildPreviewLine(product, item.quantity));
  }

  return { lines, issues };
}

function buildPreviewLine(product: PartProduct, quantity: number): PreviewLine {
  const unitNetCents = toCents(product.price);
  const lineNetCents = unitNetCents * quantity;

  return {
    product,
    quantity,
    unitNetCents,
    lineNetCents,
    vatCents: 0,
    lineGrossCents: lineNetCents,
  };
}

function calculateTotals(lines: PreviewLine[]) {
  const subtotalCents = lines.reduce((total, line) => total + line.lineNetCents, 0);
  const shippingCents = subtotalCents > 25000 ? 0 : subtotalCents > 0 ? 1290 : 0;
  const totalCents = subtotalCents + shippingCents;

  return {
    subtotalCents,
    shippingCents,
    vatCents: 0,
    totalCents,
  };
}

function toPreviewLineDto(line: PreviewLine) {
  return {
    sku: line.product.sku,
    name: line.product.name,
    quantity: line.quantity,
    moq: line.product.moq,
    stock: line.product.stock,
    unitPrice: money(line.unitNetCents),
    lineNet: money(line.lineNetCents),
    vatRate: decimal(line.product.vatRate),
    vat: money(line.vatCents),
    lineGross: money(line.lineGrossCents),
    priceVersion: line.product.priceVersion ?? null,
  };
}

function totalsDto(totals: ReturnType<typeof calculateTotals>) {
  return {
    subtotal: money(totals.subtotalCents),
    shipping: money(totals.shippingCents),
    vat: money(totals.vatCents),
    total: money(totals.totalCents),
    freeShippingThreshold: money(25000),
    vatMode: "tax_included_shipping_only",
  };
}

function resolveCompany(companies: CompanyProfile[], companyId: string) {
  return companies.find((company) => company.id === companyId) ?? null;
}

function customerReadinessIssues(
  company: CompanyProfile,
  profile: Awaited<ReturnType<typeof getCurrentCustomerProfile>>["data"]
) {
  const issues: PreviewIssue[] = [];

  if (company.status !== "approved") {
    issues.push({
      sku: "customer",
      code: "customer_not_orderable",
      message: "Customer must be active before checkout.",
    });
  }

  if (company.customerType !== "wholesale") {
    issues.push({
      sku: "customer",
      code: "customer_not_orderable",
      message: "Delegated checkout requires a wholesale customer.",
    });
  }

  if (company.assignmentStatus !== "assigned") {
    issues.push({
      sku: "customer",
      code: "customer_not_orderable",
      message: "Customer must be assigned before checkout.",
    });
  }

  return [...issues, ...profileReadinessIssues(profile)];
}

function profileReadinessIssues(profile: Awaited<ReturnType<typeof getCurrentCustomerProfile>>["data"]) {
  if (!profile) {
    return [{ sku: "customer", code: "profile_missing", message: "Customer profile is not available." }];
  }

  const missing = [
    profile.companyName ? null : "company",
    profile.contactName ? null : "contact",
    profile.email ? null : "email",
    profile.phone ? null : "phone",
    profile.billingAddress ? null : "billing_address",
    profile.shippingAddress ? null : "shipping_address",
    profile.customerType === "retail" && !(profile.fiscalCode || profile.vatNumber) ? "fiscal_code" : null,
    profile.customerType === "wholesale" && !profile.vatNumber ? "vat_number" : null,
    profile.customerType === "wholesale" && !profile.fiscalCode ? "fiscal_code" : null,
    profile.customerType === "wholesale" && !(profile.pec || profile.sdi) ? "electronic_invoice" : null,
  ].filter((item): item is string => Boolean(item));

  return missing.length > 0
    ? [{
        sku: "customer",
        code: "profile_incomplete",
        missingFields: missing,
        message: `Customer profile is missing: ${missing.join(", ")}.`,
      }]
    : [];
}

function isDelegatedCompanyOrderable(
  company: CompanyProfile,
  profile: Awaited<ReturnType<typeof getCurrentCustomerProfile>>["data"]
) {
  return Boolean(
    company.status === "approved" &&
      company.customerType === "wholesale" &&
      company.assignmentStatus === "assigned" &&
      profile &&
      profileReadinessIssues(profile).length === 0
  );
}

function warningsMeta(...warnings: Array<string | undefined>) {
  const values = warnings.filter((warning): warning is string => Boolean(warning));
  return values.length > 0 ? { warnings: values } : {};
}
