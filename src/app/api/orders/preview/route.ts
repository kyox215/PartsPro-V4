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
  getCustomerWalletById,
  getCurrentCustomerProfile,
  getCurrentEmployeeSelfCompany,
  getCurrentEmployeeSelfProfile,
  listCatalogProductsBySkus,
  listCompanies,
  listCurrentCustomerCompanies,
} from "@/lib/partspro-repository";
import { type CompanyProfile, type PartProduct } from "@/lib/partspro-data";
import {
  checkoutProfileMissingFields,
  customerCheckoutReadiness,
} from "@/lib/partspro-customer-readiness";
import {
  calculateShippingCents,
  deliveryMethodInputValues,
  freeShippingThresholdCents,
  normalizeDeliveryMethod,
  shippingMethodForDeliveryMethod,
  type DeliveryMethod,
} from "@/lib/partspro-shipping";
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
    checkoutMode: z.enum(["customer_self", "employee_self", "delegated_customer"]).optional(),
    deliveryMethod: z.enum(deliveryMethodInputValues).optional(),
    items: z.array(previewItemSchema).min(1).max(100),
    useWallet: z.boolean().optional(),
  })
  .strict();

type CheckoutMode = "customer_self" | "employee_self" | "delegated_customer";

type RequestedPreviewItem = z.infer<typeof previewItemSchema>;
type PreviewIssue = {
  code: string;
  message: string;
  missingFields?: string[];
  moq?: number;
  sku: string;
  stock?: number;
};
type PreviewCatalogRejection = {
  reason: string;
  sku: string;
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
    const deliveryMethod = normalizeDeliveryMethod(result.data.deliveryMethod);
    const delegatedCheckout = canDelegateCheckout(account);
    const checkoutMode = resolveCheckoutMode(
      account,
      result.data.checkoutMode,
      result.data.companyId,
      delegatedCheckout
    );

    if (!account.authenticated) {
      return apiError(401, "LOGIN_REQUIRED", "Login is required before checkout preview.");
    }

    if (checkoutMode === "forbidden") {
      return apiError(403, "CHECKOUT_MODE_FORBIDDEN", "This checkout mode is not available for the current account.");
    }

    if (checkoutMode === "customer_self" && account.customer?.status === "active" && !account.canViewPrices) {
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

    if (checkoutMode === "customer_self" && !account.customer?.id) {
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
      checkoutMode === "delegated_customer"
        ? listCompanies()
        : checkoutMode === "employee_self"
          ? getCurrentEmployeeSelfCompany().then(singleCompanyResult)
          : listCurrentCustomerCompanies(),
      checkoutMode === "delegated_customer"
        ? getCustomerProfileById(result.data.companyId)
        : checkoutMode === "employee_self"
          ? getCurrentEmployeeSelfProfile()
          : getCurrentCustomerProfile(),
    ]);
    const company = resolveCompany(companies.data, result.data.companyId);

    if (!company) {
      return apiError(404, "COMPANY_NOT_FOUND", "Company profile was not found.");
    }

    if (checkoutMode === "customer_self" && account.customer?.id && company.id !== account.customer.id) {
      return apiError(403, "COMPANY_FORBIDDEN", "Orders can only be placed for the current customer profile.", {
        companyId: company.id,
        customerId: account.customer.id,
      });
    }

    if ((checkoutMode === "delegated_customer" || checkoutMode === "employee_self") && !customerProfile.data) {
      return apiError(404, "COMPANY_NOT_FOUND", "Selected customer profile was not found.");
    }

    const targetCanCheckout =
      checkoutMode === "delegated_customer"
        ? company.profileKind !== "employee_self" && isDelegatedCompanyOrderable(company, customerProfile.data)
        : checkoutMode === "employee_self"
          ? account.canEmployeeSelfCheckout && isDelegatedCompanyOrderable(company, customerProfile.data)
          : account.canCheckout;
    const customerIssues = targetCanCheckout && company.status === "approved"
      ? []
      : customerReadinessIssues(
          company,
          customerProfile.data,
          checkoutMode
        );

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
          catalog: {
            products: [],
            rejected: [],
          },
          lines: [],
          totals: totalsDto(calculateTotals([], deliveryMethod), deliveryMethod),
          wallet: walletSummaryDto(
            calculateWalletSummary(0, 0, Boolean(result.data.useWallet))
          ),
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
      buyerCustomerId: company.id,
      includeBuyerPrices: account.canViewPrices || checkoutMode !== "customer_self",
    });

    if (catalog.source === "empty" && catalog.warning) {
      return apiError(
        503,
        "ORDER_PREVIEW_CATALOG_UNAVAILABLE",
        "Checkout preview catalog data is temporarily unavailable.",
        { warning: catalog.warning }
      );
    }

    const pricedCatalog = catalog.data.map((product) =>
      product.priceResolved || product.priceVersion
        ? product
        : applyAccountPriceToProduct(product, account)
    );
    const orderBuild = buildPreviewOrder(result.data.items, pricedCatalog);
    const totals = calculateTotals(orderBuild.lines, deliveryMethod);
    const wallet = await getCustomerWalletById(company.id);
    const walletSummary = calculateWalletSummary(
      totals.totalCents,
      wallet.data.balance,
      Boolean(result.data.useWallet)
    );

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
        catalog: {
          products: orderBuild.lines.map((line) => line.product),
          rejected: buildPreviewCatalogRejections(orderBuild.issues, pricedCatalog),
        },
        issues: orderBuild.issues,
        lines: orderBuild.lines.map(toPreviewLineDto),
        deliveryMethod,
        shippingMethod: shippingMethodForDeliveryMethod(deliveryMethod),
        totals: totalsDto(totals, deliveryMethod),
        wallet: walletSummaryDto(walletSummary),
      },
      meta: {
        source: "checkout_preview",
        catalogSource: catalog.source,
        companiesSource: companies.source,
        profileSource: customerProfile.source,
        walletSource: wallet.source,
        currency: "EUR",
        vatMode: "tax_included_shipping_only",
        ...warningsMeta(companies.warning, catalog.warning, customerProfile.warning),
      },
    });
  } catch {
    return apiError(500, "ORDER_PREVIEW_FAILED", "Checkout preview is temporarily unavailable.");
  }
}

function buildPreviewCatalogRejections(
  issues: PreviewIssue[],
  catalog: PartProduct[]
): PreviewCatalogRejection[] {
  const catalogBySku = new Map(
    catalog.map((product) => [toPublicSku(product.sku), product])
  );

  return issues
    .filter((issue) => issue.sku !== "customer")
    .map((issue) => ({
      reason: previewCatalogRejectionReason(issue, catalogBySku.get(toPublicSku(issue.sku))),
      sku: toPublicSku(issue.sku),
    }));
}

function previewCatalogRejectionReason(
  issue: PreviewIssue,
  product: PartProduct | undefined
) {
  if (!product) {
    return "not_found";
  }

  switch (issue.code) {
    case "moq":
      return "quantity_below_moq";
    case "out_of_stock":
      return "unavailable";
    case "price_missing":
      return "price_unavailable";
    case "stock_limit":
      return "quantity_over_stock";
    default:
      return issue.code || "unavailable";
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

function calculateTotals(lines: PreviewLine[], deliveryMethod: DeliveryMethod) {
  const subtotalCents = lines.reduce((total, line) => total + line.lineNetCents, 0);
  const shippingCents = calculateShippingCents(subtotalCents, deliveryMethod);
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

function totalsDto(totals: ReturnType<typeof calculateTotals>, deliveryMethod: DeliveryMethod) {
  return {
    subtotal: money(totals.subtotalCents),
    shipping: money(totals.shippingCents),
    vat: money(totals.vatCents),
    total: money(totals.totalCents),
    deliveryMethod,
    shippingMethod: shippingMethodForDeliveryMethod(deliveryMethod),
    freeShippingThreshold: money(freeShippingThresholdCents),
    vatMode: "tax_included_shipping_only",
  };
}

function calculateWalletSummary(
  totalCents: number,
  walletBalance: number,
  useWallet: boolean
) {
  const availableCents = Math.max(0, toCents(walletBalance));
  const appliedCents = useWallet ? Math.min(availableCents, totalCents) : 0;

  return {
    appliedCents,
    availableCents,
    enabled: useWallet,
    payableCents: Math.max(0, totalCents - appliedCents),
  };
}

function walletSummaryDto(summary: ReturnType<typeof calculateWalletSummary>) {
  return {
    appliedAmount: money(summary.appliedCents),
    availableAmount: money(summary.availableCents),
    enabled: summary.enabled,
    payableAmount: money(summary.payableCents),
  };
}

function resolveCompany(companies: CompanyProfile[], companyId: string) {
  return companies.find((company) => company.id === companyId) ?? null;
}

function singleCompanyResult(
  result: Awaited<ReturnType<typeof getCurrentEmployeeSelfCompany>>
): Awaited<ReturnType<typeof listCurrentCustomerCompanies>> {
  return {
    ...result,
    data: result.data ? [result.data] : [],
  };
}

function resolveCheckoutMode(
  account: Awaited<ReturnType<typeof getCurrentAccountContext>>,
  requestedMode: CheckoutMode | undefined,
  companyId: string,
  delegatedCheckout: boolean
): CheckoutMode | "forbidden" {
  if (account.accountType === "customer") {
    return requestedMode && requestedMode !== "customer_self"
      ? "forbidden"
      : "customer_self";
  }

  if (account.accountType !== "employee") {
    return "forbidden";
  }

  const employeeSelfId = account.employeeSelfCustomer?.id;
  const inferredMode =
    requestedMode ??
    (employeeSelfId && companyId === employeeSelfId
      ? "employee_self"
      : "delegated_customer");

  if (inferredMode === "employee_self") {
    return employeeSelfId && companyId === employeeSelfId
      ? "employee_self"
      : "forbidden";
  }

  if (inferredMode === "delegated_customer") {
    return delegatedCheckout ? "delegated_customer" : "forbidden";
  }

  return "forbidden";
}

function customerReadinessIssues(
  company: CompanyProfile,
  profile: Awaited<ReturnType<typeof getCurrentCustomerProfile>>["data"],
  checkoutMode: CheckoutMode
) {
  const issues: PreviewIssue[] = [];

  if (checkoutMode === "delegated_customer" && company.profileKind === "employee_self") {
    issues.push({
      sku: "customer",
      code: "customer_not_orderable",
      message: "Employee self profile cannot be used for delegated checkout.",
    });
  }

  if (company.status !== "approved") {
    issues.push({
      sku: "customer",
      code: "customer_not_orderable",
      message: "Customer must be active before checkout.",
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

  const missing = checkoutProfileMissingFields(profile);

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
  return customerCheckoutReadiness(company, profile).orderable;
}

function warningsMeta(...warnings: Array<string | undefined>) {
  const values = warnings.filter((warning): warning is string => Boolean(warning));
  return values.length > 0 ? { warnings: values } : {};
}
