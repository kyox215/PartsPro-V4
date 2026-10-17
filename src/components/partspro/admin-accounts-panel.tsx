"use client";

import { englishUiCopy } from "@/i18n/english-ui-copy";


import { AdminSearchField } from "./admin-ui-controls";
import { AdminPricingPanel, ClassificationPricePreview } from "./admin-pricing-panel";
import * as React from "react";
import { useRouter } from "next/navigation";
import { accountText, accountTemplate } from "@/lib/admin-account-text";
import { accountProfilePatchSchema, profileChangedValues, rolePermissionDifference, canCloseAccountDraft, type AccountProfilePatch } from "@/lib/admin-account-operation.mjs";
import { usePersistentAdminValue, useAdminMemoryValue } from "./admin-workspace-state";
import { Activity, AlertTriangle, ArrowLeftRight, BadgeCheck, BriefcaseBusiness, ChevronLeft, ChevronRight, CircleDollarSign, Clock3, FilePenLine, KeyRound, Loader2, RefreshCcw, ShieldCheck, ShoppingBag, Star, UserCog, UsersRound, } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogBody, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AddressDraftFields } from "@/components/partspro/address-draft-fields";
import { adminPermissionLabel, adminRoleTemplateLabel, getAdminDictionary, type AdminText, } from "@/i18n/dictionaries/admin";
import { formatEuro } from "@/lib/partspro-data";
import { formatTierDiscount } from "@/lib/partspro-pricing";
import { type AddressDraft, type AddressDraftField, formatAddressDraft, isAddressDraftComplete, normalizeAddressText, parseAddressDraft, } from "@/lib/partspro-address-draft";
import { cn } from "@/lib/utils";
import { AdminBusyRegion, AdminNotice, AdminActionButton, AdminEmptyState } from "./admin-feedback";
import { useI18n } from "./i18n-provider";
type AccountType = "customer" | "employee";
type ConversionKind = "role" | "to_customer" | "to_employee";
type CustomerActionKind = "customer_level" | "customer_status" | "customer_type";
type CustomerLevel = "bronze" | "silver" | "gold" | "emerald" | "diamond" | "master" | "king";
type CustomerStatus = "pending" | "active" | "suspended";
type CustomerType = "retail" | "wholesale";
const detailTabsListClassName = "!flex !h-auto !w-full min-w-0 gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-slate-200 bg-white/80 p-0.5 shadow-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";
const detailTabsTriggerClassName = "!h-7 min-w-[72px] flex-1 whitespace-nowrap rounded px-2 text-[11px] font-bold leading-none text-slate-500 transition-colors data-active:!bg-primary data-active:!text-white data-active:!shadow-sm sm:!h-8 sm:min-w-0 sm:text-xs";
type AccountCustomer = {
    assignmentStatus: string;
    billingAddress: string | null;
    contactName: string | null;
    convertedToEmployeeAt: string | null;
    createdAt: string | null;
    customerType: string;
    email: string | null;
    fiscalCode: string | null;
    id: string | null;
    lastActivityAt: string | null;
    lastOrderAt: string | null;
    level: string;
    baseLevel: string;
    levelSource: string;
    storedLevel: string;
    lifetimeSpendNet: number;
    promoLevel: string | null;
    promoLevelStartsAt: string | null;
    promoLevelExpiresAt: string | null;
    promoLevelReason: string | null;
    name: string | null;
    orders: AccountCustomerOrder[];
    ordersCount: number;
    pec: string | null;
    phone: string | null;
    profileCompletedAt: string | null;
    profileKind: string;
    recentActivity: AccountCustomerActivity[];
    revenue: number;
    sdi: string | null;
    shippingAddress: string | null;
    spendSummary: AccountSpendSummary;
    status: string;
    updatedAt: string | null;
    userId: string | null;
    vatNumber: string | null;
};
type AccountCustomerOrder = {
    createdAt: string | null;
    id: string;
    lineCount: number;
    orderNo: string;
    paymentStatus: string;
    shipping: number;
    status: string;
    total: number;
    totalNet: number;
    updatedAt: string | null;
    vat: number;
};
type AccountSpendSummary = {
    cancelledAmount: number;
    orderCount: number;
    paidAmount: number;
    pendingAmount: number;
    refundedAmount: number;
    shipping: number;
    total: number;
    totalNet: number;
    vat: number;
};
type AccountCustomerActivity = {
    brand: string | null;
    createdAt: string | null;
    eventType: string;
    id: string;
    model: string | null;
    modelSeries: string | null;
    productName: string | null;
    searchQuery: string | null;
    skuCode: string | null;
};
type Account = {
    accountType: AccountType;
    authProvider: string;
    avatarUrl: string | null;
    createdAt: string | null;
    customer: AccountCustomer | null;
    customerId: string | null;
    customerState: string;
    displayName: string | null;
    email: string | null;
    profileCustomer: AccountCustomer | null;
    profileState: AccountProfileState;
    role: string;
    roleTemplate: string | null;
    updatedAt: string | null;
    userId: string;
};
type AccountProfileState = {
    kind: "customer" | "employee_self";
    missingFields: string[];
    status: "complete" | "incomplete" | "missing";
};
type AccountMembership = {
    accountType: string;
    createdAt: string | null;
    customerId: string;
    displayName: string | null;
    email: string | null;
    memberRole: string;
    role: string | null;
    roleTemplate: string | null;
    status: string;
    userId: string;
};
type AccountAuditEvent = {
    action: string;
    actorEmail: string | null;
    actorRole: string | null;
    createdAt: string | null;
    entityType: string | null;
    id: string;
    reason: string | null;
    result: string;
};
type AccountDetail = {
    account: Account;
    auditEvents: AccountAuditEvent[];
    customer: AccountCustomer | null;
    memberships: AccountMembership[];
    permissions: string[];
    profileCustomer: AccountCustomer | null;
    profileState: AccountProfileState;
};
type AccountDetailInclude = "activity" | "audit" | "orders";
type AccountDetailTab = "activity" | "memberships" | "orders" | "permissions" | "profile" | "spend";
type RoleTemplate = {
    description: string | null;
    id: string;
    label: string;
    permissions: string[];
};
type Notice = {
    message: string;
    tone: "error" | "success" | "warning";
};
type ConversionState = {
    account: Account;
    kind: ConversionKind;
    reason: string;
    roleTemplate: string;
    initialRoleTemplate: string;
    currentPermissions: string[];
};
type CustomerActionState = {
    account: Account;
    customerType: CustomerType;
    kind: CustomerActionKind;
    level: CustomerLevel | "automatic";
    reason: string;
    status: CustomerStatus;
    targetCustomer: AccountCustomer;
};
type AccountProfileEditorState = {
    account: Account;
    billingAddress: AddressDraft;
    billingSameAsShipping: boolean;
    companyName: string;
    contactName: string;
    email: string;
    fiscalCode: string;
    pec: string;
    phone: string;
    reason: string;
    shippingAddress: AddressDraft;
    mode: "complete" | "correction";
    original: Record<string, string>;
};
type AccountProfileEditorField = "companyName" | "contactName" | "fiscalCode" | "pec" | "phone" | "reason";
type CurrentUser = {
    permissions: string[];
    userId: string | null;
};
type AdminAccountsPanelProps = {
    initialPermissions?: readonly string[];
    initialUserId?: string | null;
    permissionsLoaded?: boolean;
    focusAccountId?: string;
};
const accountDetailInlineMediaQuery = "(min-width: 1280px)";
const adminAccountReadTimeoutMs = 8000;
const adminAccountAuxiliaryReadTimeoutMs = 6000;
const pageSize = 12;
const customerLevels = [
    "bronze",
    "silver",
    "gold",
    "emerald",
    "diamond",
    "master",
    "king",
] as const satisfies readonly CustomerLevel[];
const customerStatuses = ["pending", "active", "suspended"] as const satisfies readonly CustomerStatus[];
const customerTypes = ["retail", "wholesale"] as const satisfies readonly CustomerType[];
function useAdminText() {
    const { locale } = useI18n();
    return getAdminDictionary(locale).admin;
}
export function AdminAccountsPanel(props: AdminAccountsPanelProps = {}) {
    return <AdminAccountsPanelContent key={props.initialUserId ?? "accounts-session"} {...props}/>;
}
function AdminAccountsPanelContent({ initialPermissions, initialUserId = null, permissionsLoaded: externalPermissionsLoaded = false, focusAccountId, }: AdminAccountsPanelProps = {}) {
    const { locale } = useI18n();
    const router = useRouter();
    const text = useAdminText();
    const hasExternalPermissions = initialPermissions !== undefined;
    const [accountType, setAccountType] = usePersistentAdminValue<AccountType>("accounts-type", "customer");
    const [accounts, setAccounts] = React.useState<Account[]>([]);
    const [detail, setDetail] = React.useState<AccountDetail | null>(null);
    const [detailOpen, setDetailOpen] = React.useState(false);
    const [usesInlineDetailPane, setUsesInlineDetailPane] = React.useState(false);
    const [roleTemplates, setRoleTemplates] = React.useState<RoleTemplate[]>([]);
    const [fetchedCurrentUserId, setFetchedCurrentUserId] = React.useState<string | null>(null);
    const [fetchedCurrentPermissions, setFetchedCurrentPermissions] = React.useState<string[]>([]);
    const [fetchedPermissionsLoaded, setFetchedPermissionsLoaded] = React.useState(false);
    const [query, setQuery] = useAdminMemoryValue("accounts-query", "");
    const [appliedQuery, setAppliedQuery] = useAdminMemoryValue("accounts-applied-query", "");
    const [selectedAccountId, setSelectedAccountId] = useAdminMemoryValue("accounts-selected", "");
    const appliedFocusId = React.useRef<string | null>(null);
    const [page, setPage] = usePersistentAdminValue<number>("accounts-page", 0);
    const [total, setTotal] = React.useState(0);
    const [loading, setLoading] = React.useState(false);
    const [detailLoading, setDetailLoading] = React.useState(false);
    const [detailTab, setDetailTab] = React.useState<AccountDetailTab>("profile");
    const [detailLoadedIncludes, setDetailLoadedIncludes] = React.useState<Set<AccountDetailInclude>>(() => new Set());
    const [detailLoadingIncludes, setDetailLoadingIncludes] = React.useState<Set<AccountDetailInclude>>(() => new Set());
    const [submitting, setSubmitting] = React.useState(false);
    const [pricingMutating, setPricingMutating] = React.useState(false);
    const pricingMutatingRef = React.useRef(false);
    const pricingDeferredFocusRef = React.useRef(false);
    const handlePricingMutation = React.useCallback((pending: boolean) => {
        pricingMutatingRef.current = pending;
        setPricingMutating(pending);
    }, []);
    const [notice, setNotice] = React.useState<Notice | null>(null);
    const [dialogError, setDialogError] = React.useState("");
    const [conversion, setConversion] = React.useState<ConversionState | null>(null);
    const [customerAction, setCustomerAction] = React.useState<CustomerActionState | null>(null);
    const [profileEditor, setProfileEditor] = React.useState<AccountProfileEditorState | null>(null);
    const detailCacheRef = React.useRef(new Map<string, AccountDetail>());
    const detailLoadedIncludesRef = React.useRef(new Map<string, Set<AccountDetailInclude>>());
    const detailEpochRef = React.useRef(0);
    const detailAbortRef = React.useRef<AbortController | null>(null);
    const currentUserId = hasExternalPermissions ? initialUserId : fetchedCurrentUserId;
    const currentPermissions = React.useMemo(() => hasExternalPermissions
        ? [...(initialPermissions ?? [])]
        : fetchedCurrentPermissions, [fetchedCurrentPermissions, hasExternalPermissions, initialPermissions]);
    const permissionsLoaded = hasExternalPermissions
        ? externalPermissionsLoaded
        : fetchedPermissionsLoaded;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPermissionSet = React.useMemo(() => new Set(currentPermissions), [currentPermissions]);
    const canManageCustomerLevel = currentPermissionSet.has("customers.manage_level");
    const canManageCustomerStatus = currentPermissionSet.has("customers.classify");
    const canManageCustomerProfile = currentPermissionSet.has("customers.classify");
    const canManageCustomerType = currentPermissionSet.has("customers.classify");
    const canReadCustomerAccounts = currentPermissionSet.has("customers.read");
    const canReadEmployeeAccounts = currentPermissionSet.has("employees.read") ||
        currentPermissionSet.has("employees.manage_permissions");
    const canManageEmployeeAccounts = currentPermissionSet.has("employees.manage_permissions");
    const canReadSelectedAccountType = accountType === "employee" ? canReadEmployeeAccounts : canReadCustomerAccounts;
    const visibleAccountTabCount = (canReadCustomerAccounts ? 1 : 0) + (canReadEmployeeAccounts ? 1 : 0);
    const refreshAccounts = React.useCallback(async (signal?: AbortSignal) => {
        if (!permissionsLoaded || !canReadSelectedAccountType) {
            setAccounts([]);
            setTotal(0);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const payload = await fetchAccounts(accountType, page, appliedQuery, signal, locale);
            if (signal?.aborted) {
                return;
            }
            setAccounts(payload.data);
            setTotal(payload.total);
            return true;
        }
        catch (error) {
            if (!signal?.aborted) {
                setNotice({ message: readableError(error, locale), tone: "error" });
            }
            return false;
        }
        finally {
            if (!signal?.aborted) {
                setLoading(false);
            }
        }
    }, [accountType, appliedQuery, canReadSelectedAccountType, locale, page, permissionsLoaded]);
    React.useEffect(() => {
        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            void refreshAccounts(controller.signal);
        }, 0);
        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [refreshAccounts]);
    React.useEffect(() => {
        const mediaQuery = window.matchMedia(accountDetailInlineMediaQuery);
        function handleMediaQueryChange() {
            const matches = mediaQuery.matches;
            setUsesInlineDetailPane(matches);
            if (matches) {
                setDetailOpen(false);
            }
        }
        handleMediaQueryChange();
        mediaQuery.addEventListener("change", handleMediaQueryChange);
        return () => {
            mediaQuery.removeEventListener("change", handleMediaQueryChange);
        };
    }, []);
    React.useEffect(() => () => detailAbortRef.current?.abort(), []);
    React.useEffect(() => {
        if (hasExternalPermissions) {
            return;
        }
        const controller = new AbortController();
        void fetchCurrentUser(controller.signal, locale)
            .then((me) => {
            if (controller.signal.aborted) {
                return;
            }
            setFetchedCurrentUserId(me.userId);
            setFetchedCurrentPermissions(me.permissions);
            setFetchedPermissionsLoaded(true);
        })
            .catch(() => {
            if (!controller.signal.aborted) {
                setFetchedPermissionsLoaded(true);
            }
        });
        return () => controller.abort();
    }, [hasExternalPermissions, locale]);
    React.useEffect(() => {
        if (!permissionsLoaded || !canReadEmployeeAccounts) {
            const timeoutId = window.setTimeout(() => {
                setRoleTemplates([]);
            }, 0);
            return () => window.clearTimeout(timeoutId);
        }
        const controller = new AbortController();
        void fetchRoleTemplates(controller.signal, locale)
            .then((templates) => {
            if (!controller.signal.aborted) {
                setRoleTemplates(templates);
            }
        })
            .catch(() => {
            if (!controller.signal.aborted) {
                setRoleTemplates([]);
            }
        });
        return () => controller.abort();
    }, [canReadEmployeeAccounts, permissionsLoaded, locale]);
    React.useEffect(() => {
        if (!permissionsLoaded || canReadSelectedAccountType) {
            return;
        }
        const timeoutId = window.setTimeout(() => {
            const nextType = canReadCustomerAccounts
                ? "customer"
                : canReadEmployeeAccounts
                    ? "employee"
                    : null;
            if (nextType && nextType !== accountType) {
                setAccountType(nextType);
            }
            setPage(0);
            detailEpochRef.current += 1;
            detailAbortRef.current?.abort();
            setDetail(null);
            setDetailOpen(false);
            setDetailLoading(false);
            setDetailLoadedIncludes(new Set());
            setDetailLoadingIncludes(new Set());
            setAccounts([]);
            setTotal(0);
        }, 0);
        return () => window.clearTimeout(timeoutId);
    }, [
        accountType,
        canReadCustomerAccounts,
        canReadEmployeeAccounts,
        canReadSelectedAccountType,
        permissionsLoaded, setAccountType, setPage,
    ]);
    function applySearch() {
        const value = query.trim();
        setPage(0);
        setAppliedQuery(value.length >= 2 ? value : "");
    }
    function openDetail(account: Account) {
        if (pricingMutatingRef.current) return;
        const shouldUseInlineDetailPane = usesInlineDetailPane || window.matchMedia(accountDetailInlineMediaQuery).matches;
        const userId = account.userId;
        setSelectedAccountId(userId);
        appliedFocusId.current = userId;
        const params = new URLSearchParams(window.location.search);
        params.set("panel", "accounts"); params.set("accountId", userId);
        router.replace(`/admin?${params}`, { scroll: false });
        const epoch = detailEpochRef.current + 1;
        const cached = detailCacheRef.current.get(userId);
        const initialDetail = cached ?? createLightweightAccountDetail(account);
        const loadedIncludes = detailLoadedIncludesRef.current.get(userId) ?? new Set();
        detailEpochRef.current = epoch;
        detailAbortRef.current?.abort();
        detailAbortRef.current = new AbortController();
        detailCacheRef.current.set(userId, initialDetail);
        setDetail(initialDetail);
        setDetailTab(defaultDetailTabForAccount());
        setDetailLoadedIncludes(new Set(loadedIncludes));
        setDetailLoadingIncludes(new Set());
        setDetailOpen(!shouldUseInlineDetailPane);
        if (account.accountType === "employee") {
            void loadDetail(userId, {
                epoch,
                silent: true,
                signal: detailAbortRef.current.signal,
            });
        }
    }
    function handleDetailTabChange(value: string) {
        const tab = normalizeDetailTab(value);
        setDetailTab(tab);
        if (!detail) {
            return;
        }
        const includes = includesForDetailTab(tab, detail).filter((include) => !detailLoadedIncludes.has(include) && !detailLoadingIncludes.has(include));
        if (includes.length > 0) {
            void loadDetail(detail.account.userId, { includes });
        }
    }
    async function loadDetail(userId: string, { epoch = detailEpochRef.current, includes = [], silent = false, signal, }: {
        epoch?: number;
        includes?: AccountDetailInclude[];
        silent?: boolean;
        signal?: AbortSignal;
    } = {}) {
        const isCoreRefresh = includes.length === 0;
        const showCoreLoading = isCoreRefresh && !silent;
        if (showCoreLoading) {
            setDetailLoading(true);
        }
        else if (!isCoreRefresh) {
            setDetailLoadingIncludes((current) => {
                const next = new Set(current);
                for (const include of includes) {
                    next.add(include);
                }
                return next;
            });
        }
        try {
            const nextDetail = await fetchAccountDetail(userId, { includes, signal }, locale);
            if (signal?.aborted || epoch !== detailEpochRef.current) {
                return;
            }
            const previousDetail = detailCacheRef.current.get(userId);
            const mergedDetail = previousDetail
                ? mergeAccountDetails(previousDetail, nextDetail, includes)
                : nextDetail;
            const loadedIncludes = new Set(detailLoadedIncludesRef.current.get(userId) ?? []);
            for (const include of includes) {
                loadedIncludes.add(include);
            }
            detailCacheRef.current.set(userId, mergedDetail);
            detailLoadedIncludesRef.current.set(userId, loadedIncludes);
            setDetail(mergedDetail);
            setDetailLoadedIncludes(new Set(loadedIncludes));
            return true;
        }
        catch (error) {
            if (!signal?.aborted && epoch === detailEpochRef.current) {
                setNotice({ message: readableError(error, locale), tone: "error" });
            }
            return false;
        }
        finally {
            if (signal?.aborted || epoch !== detailEpochRef.current) {
                return;
            }
            if (showCoreLoading) {
                setDetailLoading(false);
            }
            else if (!isCoreRefresh) {
                setDetailLoadingIncludes((current) => {
                    const next = new Set(current);
                    for (const include of includes) {
                        next.delete(include);
                    }
                    return next;
                });
            }
        }
    }
    const closeDraft = (kind: "conversion" | "customer" | "profile") => {
        const dirty = kind === "conversion" ? Boolean(conversion && (conversion.reason.trim() || conversion.roleTemplate !== conversion.initialRoleTemplate))
            : kind === "customer" ? Boolean(customerAction && (customerAction.reason.trim() || customerAction.level !== normalizeCustomerLevel(customerAction.targetCustomer.level) || customerAction.status !== normalizeCustomerStatus(customerAction.targetCustomer.status) || customerAction.customerType !== normalizeCustomerType(customerAction.targetCustomer.customerType)))
                : Boolean(profileEditor && (profileEditor.reason.trim() || Object.keys(profileChangedValues(profileEditorValues(profileEditor), profileEditor.original)).length));
        if (!canCloseAccountDraft(submitting, dirty, () => window.confirm(accountText("放弃未保存的修改？", locale))))
            return;
        setDialogError("");
        if (kind === "conversion")
            setConversion(null);
        else if (kind === "customer")
            setCustomerAction(null);
        else
            setProfileEditor(null);
    };
    const focusAccount = React.useEffectEvent(() => {
        if (focusAccountId && appliedFocusId.current === focusAccountId) return;
        if (pricingMutatingRef.current) { pricingDeferredFocusRef.current = true; return; }
        pricingDeferredFocusRef.current = false;
        const target = focusAccountId || selectedAccountId;
        if (!target) return;
        if (focusAccountId) appliedFocusId.current = focusAccountId;
        const epoch = ++detailEpochRef.current;
        detailAbortRef.current?.abort();
        const controller = new AbortController();
        detailAbortRef.current = controller;
        setSelectedAccountId(target);
        setDetail(null); setDetailLoadedIncludes(new Set()); setDetailLoadingIncludes(new Set());
        void loadDetail(target, { epoch, signal: controller.signal });
        setDetailOpen(!window.matchMedia(accountDetailInlineMediaQuery).matches);
    });
    React.useEffect(() => {
        if (!permissionsLoaded) return;
        const timer = window.setTimeout(() => focusAccount(), 0);
        return () => window.clearTimeout(timer);
    }, [focusAccountId, permissionsLoaded]);
    React.useEffect(() => {
        if (!pricingMutating && pricingDeferredFocusRef.current && permissionsLoaded) focusAccount();
    }, [pricingMutating, permissionsLoaded]);
    function openConversion(kind: ConversionKind, account: Account) {
        const fallbackRole = account.roleTemplate ?? "";
        setDialogError("");
        setConversion({
            account,
            kind,
            reason: "",
            roleTemplate: fallbackRole, initialRoleTemplate: fallbackRole,
            currentPermissions: detail?.account.userId === account.userId ? detail.permissions : [],
        });
    }
    function openCustomerAction(kind: CustomerActionKind, account: Account) {
        const customer = commerceCustomerForAccount(account);
        if (!customer) {
            return;
        }
        setDialogError("");
        setCustomerAction({
            account,
            customerType: normalizeCustomerType(customer.customerType),
            kind,
            level: normalizeCustomerLevel(customer.level),
            reason: "",
            status: normalizeCustomerStatus(customer.status),
            targetCustomer: customer,
        });
    }
    function openProfileEditor(account: Account, profileCustomer?: AccountCustomer | null) {
        setDialogError("");
        setProfileEditor(createAccountProfileEditor(account, profileCustomer ?? account.profileCustomer));
    }
    function updateProfileEditorField(field: AccountProfileEditorField, value: string) {
        setProfileEditor((current) => (current ? { ...current, [field]: value } : current));
    }
    const updateProfileEditorAddress = React.useCallback((addressKey: "billingAddress" | "shippingAddress", field: AddressDraftField, value: string) => {
        setProfileEditor((current) => {
            if (!current) {
                return current;
            }
            const nextAddress = {
                ...current[addressKey],
                [field]: value,
            };
            const nextEditor = {
                ...current,
                [addressKey]: nextAddress,
            };
            if (addressKey === "shippingAddress" && current.billingSameAsShipping) {
                return {
                    ...nextEditor,
                    billingAddress: nextAddress,
                };
            }
            return nextEditor;
        });
    }, []);
    function updateProfileEditorBillingSameAsShipping(checked: boolean) {
        setProfileEditor((current) => current
            ? {
                ...current,
                billingSameAsShipping: checked,
                billingAddress: checked ? current.shippingAddress : current.billingAddress,
            }
            : current);
    }
    async function submitConversion() {
        if (!conversion || conversion.reason.trim().length < 3) {
            return;
        }
        setDialogError("");
        setSubmitting(true);
        let writeCompleted = false;
        try {
            let nextDetail: AccountDetail | null = null;
            if (conversion.kind === "role") {
                await patchAccountRole(conversion.account.userId, conversion.roleTemplate, conversion.reason, locale);
            }
            else {
                nextDetail = await patchAccountType(conversion, locale);
            }
            writeCompleted = true;
            setNotice({ message: accountText("账号变更已保存。", locale), tone: "success" });
            setConversion(null);
            if (nextDetail) {
                const userId = nextDetail.account.userId;
                const nextLoadedIncludes = new Set<AccountDetailInclude>();
                detailEpochRef.current += 1;
                detailAbortRef.current?.abort();
                detailCacheRef.current.set(userId, nextDetail);
                detailLoadedIncludesRef.current.set(userId, nextLoadedIncludes);
                setDetail(nextDetail);
                setDetailLoadedIncludes(nextLoadedIncludes);
                setDetailLoadingIncludes(new Set());
                setDetailTab(defaultDetailTabForAccount());
                if ((nextDetail.account.accountType === "customer" && canReadCustomerAccounts) ||
                    (nextDetail.account.accountType === "employee" && canReadEmployeeAccounts)) {
                    setAccountType(nextDetail.account.accountType);
                    setPage(0);
                    setLoading(true);
                    try {
                        const payload = await fetchAccounts(nextDetail.account.accountType, 0, appliedQuery, undefined, locale);
                        setAccounts(payload.data);
                        setTotal(payload.total);
                    }
                    finally {
                        setLoading(false);
                    }
                }
                else {
                    if (await refreshAccounts() === false) setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
                }
            }
            else {
                if (await refreshAccounts() === false) setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
                if (await loadDetail(conversion.account.userId) === false) setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
            }
        }
        catch (error) {
            if (writeCompleted || error instanceof AccountWriteSavedError) {
                setConversion(null);
                setCustomerAction(null);
                setProfileEditor(null);
                setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
                // The next action is an explicit read retry from the panel.
            }
            else {
                setDialogError(readableError(error, locale));
                setNotice({ message: readableError(error, locale), tone: "error" });
            }
        }
        finally {
            setSubmitting(false);
        }
    }
    async function submitCustomerAction() {
        if (!customerAction || customerAction.reason.trim().length < 3) {
            return;
        }
        setDialogError("");
        setSubmitting(true);
        let writeCompleted = false;
        try {
            const nextDetail = await submitCustomerAccountAction(customerAction, locale);
            writeCompleted = true;
            setNotice({
                message: customerAction.kind === "customer_level"
                    ? accountText("客户等级已保存。", locale) : customerAction.kind === "customer_type"
                    ? accountText("价格类型已保存。", locale) : accountText("客户状态已保存。", locale),
                tone: "success",
            });
            setCustomerAction(null);
            const cachedDetail = detailCacheRef.current.get(nextDetail.account.userId);
            const mergedDetail = cachedDetail
                ? mergeAccountDetails(cachedDetail, nextDetail, [])
                : nextDetail;
            detailCacheRef.current.set(nextDetail.account.userId, mergedDetail);
            setDetail(mergedDetail);
            if (await refreshAccounts() === false) setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
        }
        catch (error) {
            if (writeCompleted || error instanceof AccountWriteSavedError) {
                setConversion(null);
                setCustomerAction(null);
                setProfileEditor(null);
                setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
                // The next action is an explicit read retry from the panel.
            }
            else {
                setDialogError(readableError(error, locale));
                setNotice({ message: readableError(error, locale), tone: "error" });
            }
        }
        finally {
            setSubmitting(false);
        }
    }
    async function submitProfileEditor() {
        if (!profileEditor || profileEditor.reason.trim().length < 3) {
            return;
        }
        const values = profileEditorValues(profileEditor);
        const changed = profileChangedValues(values, profileEditor.original);
        const addressKeys = profileEditor.mode === "complete" ? ["shippingAddress", "billingAddress"] : Object.keys(changed).filter(key => key.endsWith("Address"));
        if (addressKeys.some(key => !isAddressDraftComplete(key === "billingAddress" && profileEditor.billingSameAsShipping ? profileEditor.shippingAddress : profileEditor[key as "billingAddress" | "shippingAddress"]))) {
            setDialogError(accountText("请补全已修改地址的 CAP、Provincia、Citta、Via 和 Numero 后再保存。", locale));
            return;
        }
        const profile = { ...(profileEditor.mode === "complete" ? values : changed), mode: profileEditor.mode, reason: profileEditor.reason };
        const parsedProfile = accountProfilePatchSchema.safeParse(profile);
        if (!parsedProfile.success) {
            setDialogError(parsedProfile.error.issues.map(issue => profileValidationMessage(issue, locale)).join("; "));
            return;
        }
        setDialogError("");
        setSubmitting(true);
        let writeCompleted = false;
        try {
            const nextDetail = await patchAccountCustomerProfile(profileEditor.account.userId, parsedProfile.data, locale);
            writeCompleted = true;
            const cachedDetail = detailCacheRef.current.get(nextDetail.account.userId);
            const mergedDetail = cachedDetail
                ? mergeAccountDetails(cachedDetail, nextDetail, [])
                : nextDetail;
            detailCacheRef.current.set(nextDetail.account.userId, mergedDetail);
            setDetail(mergedDetail);
            setProfileEditor(null);
            setNotice({ message: accountText("账号资料已保存。", locale), tone: "success" });
            if (await refreshAccounts() === false) setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
        }
        catch (error) {
            if (writeCompleted || error instanceof AccountWriteSavedError) {
                setConversion(null);
                setCustomerAction(null);
                setProfileEditor(null);
                setNotice({ message: accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale), tone: "warning" });
                // The next action is an explicit read retry from the panel.
            }
            else {
                setDialogError(readableError(error, locale));
                setNotice({ message: readableError(error, locale), tone: "error" });
            }
        }
        finally {
            setSubmitting(false);
        }
    }
    return (<section className="admin-ui-panel min-w-0 space-y-3">
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black tracking-normal text-slate-950">{accountText("账号工作台", locale)}</h3>
            <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
              {!permissionsLoaded || (loading && accounts.length === 0)
            ? accountText("加载中", locale) : accountTemplate(["", ' 个账号'], [total], locale)}
            </Badge>
            <Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">
              {accountType === "employee" ? accountText("员工账号", locale) : accountText("客户账号", locale)}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500">{accountText("管理已存在的客户账号和员工账号，不创建新的 Supabase Auth 用户。", locale)}</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 bg-white" disabled={loading || !permissionsLoaded || !canReadSelectedAccountType} onClick={() => void refreshAccounts()}>
          <RefreshCcw className={cn("size-4", loading && "animate-spin")}/>{accountText("刷新", locale)}</Button>
      </div>

      <AdminPricingPanel permissions={[...currentPermissionSet]} customerId={detail?.profileCustomer?.id ?? detail?.customer?.id} onMutatingChange={handlePricingMutation}/>

      {notice ? <><NoticeBanner notice={notice} onDismiss={() => setNotice(null)}/>{notice.tone === "warning" && detail ? <Button type="button" variant="outline" size="sm" onClick={() => void loadDetail(detail.account.userId)}>{accountText("重读账号详情", locale)}</Button> : null}</> : null}

      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
        <div className="grid gap-2 xl:grid-cols-[minmax(360px,410px)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-2 rounded-md border border-slate-100 bg-slate-50/60 p-2">
            {permissionsLoaded && visibleAccountTabCount > 0 ? (<Tabs value={accountType} onValueChange={(value) => {
                if (pricingMutatingRef.current) return;
                const nextType = value === "employee" ? "employee" : "customer";
                if ((nextType === "employee" && !canReadEmployeeAccounts) ||
                    (nextType === "customer" && !canReadCustomerAccounts)) {
                    return;
                }
                setAccountType(nextType);
                setPage(0);
                detailEpochRef.current += 1;
                detailAbortRef.current?.abort();
                setDetail(null);
                setDetailOpen(false);
                setDetailLoading(false);
                setDetailLoadedIncludes(new Set());
                setDetailLoadingIncludes(new Set());
            }}>
                <TabsList className={cn("grid h-8 rounded-md bg-white p-1 shadow-sm", visibleAccountTabCount > 1 ? "grid-cols-2" : "grid-cols-1")}>
                  {canReadCustomerAccounts ? (<TabsTrigger disabled={pricingMutating} value="customer" className="h-6 rounded text-xs font-bold">{accountText("客户账号", locale)}</TabsTrigger>) : null}
                  {canReadEmployeeAccounts ? (<TabsTrigger disabled={pricingMutating} value="employee" className="h-6 rounded text-xs font-bold">{accountText("员工账号", locale)}</TabsTrigger>) : null}
                </TabsList>
              </Tabs>) : null}

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <div className="min-w-0">
                <AdminSearchField value={query} onValueChange={setQuery} pending={loading} clearLabel={(locale.startsWith("en") ? englishUiCopy("Cancella ricerca") : locale.startsWith("zh") ? "清除搜索" : "Cancella ricerca")} aria-label={accountText("搜索邮箱、姓名或角色", locale)} onKeyDown={(event) => {
            if (event.key === "Enter") {
                applySearch();
            }
        }} disabled={!permissionsLoaded || !canReadSelectedAccountType} className="bg-white text-sm" placeholder={accountText("搜索邮箱、姓名或角色", locale)}/>
              </div>
              <Button size="sm" className="h-8 px-3" disabled={!permissionsLoaded || !canReadSelectedAccountType} onClick={applySearch}>{accountText("搜索", locale)}</Button>
            </div>

            <div className="max-h-[calc(100svh-280px)] min-h-0 overflow-y-auto overscroll-contain pr-1 xl:min-h-[320px]">
              {!permissionsLoaded || (loading && accounts.length === 0) ? (<AccountListSkeleton />) : !canReadSelectedAccountType ? (<div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">{accountText("当前账号没有读取", locale)}{accountType === "employee" ? accountText("员工", locale) : accountText("客户", locale)}{accountText("账号的权限。", locale)}</div>) : (<AdminBusyRegion contentClassName="space-y-1.5" label={text.common.refreshing} pending={loading} rows={4}>
                  {accounts.length > 0 ? (accounts.map((account) => (<AccountListItem key={account.userId} account={account} active={detail?.account.userId === account.userId} currentUserId={currentUserId} disabled={pricingMutating} onOpen={openDetail}/>))) : (<div className="rounded-md border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">{accountText("没有匹配的账号。", locale)}</div>)}
                </AdminBusyRegion>)}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
              <Button variant="outline" size="sm" className="h-8 bg-white px-2" disabled={loading || !canReadSelectedAccountType || page <= 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>
                <ChevronLeft className="size-4"/>{accountText("上一页", locale)}</Button>
              <span className="text-xs font-bold text-slate-500">
                {page + 1}/{totalPages} · {total}
              </span>
              <Button variant="outline" size="sm" className="h-8 bg-white px-2" disabled={loading || !canReadSelectedAccountType || page + 1 >= totalPages} onClick={() => setPage((current) => current + 1)}>{accountText("下一页", locale)}<ChevronRight className="size-4"/>
              </Button>
            </div>
          </div>

          <div className="hidden min-w-0 xl:block">
            <AccountDetailPane canReadOrders={currentPermissionSet.has("orders.read")} canManageCustomerLevel={canManageCustomerLevel} canManageCustomerProfile={canManageCustomerProfile} canManageCustomerStatus={canManageCustomerStatus} canManageCustomerType={canManageCustomerType} canManageEmployeeAccounts={canManageEmployeeAccounts} currentUserId={currentUserId} detail={detail} loadedIncludes={detailLoadedIncludes} loading={detailLoading} loadingIncludes={detailLoadingIncludes} onAction={openConversion} onCustomerAction={openCustomerAction} onProfileEdit={openProfileEditor} onTabChange={handleDetailTabChange} tab={detailTab}/>
          </div>
        </div>
      </div>

      <Sheet open={detailOpen} onOpenChange={setDetailOpen}>
        <SheetContent side="right" className="admin-ui-panel !w-full !max-w-none overflow-y-auto p-0 sm:!w-[560px] sm:!max-w-[560px]">
          <SheetHeader className="sr-only">
            <SheetTitle>{detail?.account.email ?? accountText("账号详情", locale)}</SheetTitle>
            <SheetDescription>{accountText("账号资料、权限和审计。", locale)}</SheetDescription>
          </SheetHeader>
          <div className="p-1.5 sm:p-2">
            <AccountDetailPane canReadOrders={currentPermissionSet.has("orders.read")} canManageCustomerLevel={canManageCustomerLevel} canManageCustomerProfile={canManageCustomerProfile} canManageCustomerStatus={canManageCustomerStatus} canManageCustomerType={canManageCustomerType} canManageEmployeeAccounts={canManageEmployeeAccounts} currentUserId={currentUserId} detail={detail} loadedIncludes={detailLoadedIncludes} loading={detailLoading} loadingIncludes={detailLoadingIncludes} onAction={openConversion} onCustomerAction={openCustomerAction} onProfileEdit={openProfileEditor} onTabChange={handleDetailTabChange} tab={detailTab}/>
          </div>
        </SheetContent>
      </Sheet>

      <AccountActionDialog conversion={conversion} onChange={setConversion} error={dialogError} onClose={() => closeDraft("conversion")} onSubmit={submitConversion} roleTemplates={roleTemplates} submitting={submitting}/>
      <CustomerAccountActionDialog key={customerAction?.kind === "customer_type" ? `${customerAction.targetCustomer.id}:${customerAction.customerType}` : customerAction?.kind ?? "closed"} action={customerAction} onChange={setCustomerAction} error={dialogError} onClose={() => closeDraft("customer")} onSubmit={submitCustomerAction} submitting={submitting}/>
      <AccountProfileEditorDialog editor={profileEditor} onAddressChange={updateProfileEditorAddress} onBillingSameAsShippingChange={updateProfileEditorBillingSameAsShipping} onChange={updateProfileEditorField} error={dialogError} onModeChange={(mode) => setProfileEditor(current => current ? { ...current, mode } : current)} onClose={() => closeDraft("profile")} onSubmit={submitProfileEditor} submitting={submitting}/>
    </section>);
}
function createLightweightAccountDetail(account: Account): AccountDetail {
    const customer = account.customer
        ? {
            ...account.customer,
            orders: account.customer.orders ?? [],
            recentActivity: account.customer.recentActivity ?? [],
            spendSummary: account.customer.spendSummary ?? emptySpendSummary(),
        }
        : null;
    const profileCustomer = account.profileCustomer
        ? {
            ...account.profileCustomer,
            orders: account.profileCustomer.orders ?? [],
            recentActivity: account.profileCustomer.recentActivity ?? [],
            spendSummary: account.profileCustomer.spendSummary ?? emptySpendSummary(),
        }
        : null;
    return {
        account: {
            ...account,
            customer,
            profileCustomer,
        },
        auditEvents: [],
        customer,
        memberships: [],
        permissions: [],
        profileCustomer,
        profileState: account.profileState,
    };
}
function mergeAccountDetails(previous: AccountDetail, incoming: AccountDetail, includes: readonly AccountDetailInclude[]): AccountDetail {
    const includeSet = new Set(includes);
    const previousCustomer = previous.customer ?? previous.account.customer;
    const incomingCustomer = incoming.customer ?? incoming.account.customer;
    const customer = incomingCustomer
        ? {
            ...incomingCustomer,
            orders: includeSet.has("orders")
                ? incomingCustomer.orders
                : previousCustomer?.orders ?? incomingCustomer.orders,
            recentActivity: includeSet.has("activity")
                ? incomingCustomer.recentActivity
                : previousCustomer?.recentActivity ?? incomingCustomer.recentActivity,
            spendSummary: includeSet.has("orders")
                ? incomingCustomer.spendSummary
                : previousCustomer?.spendSummary ?? incomingCustomer.spendSummary,
        }
        : null;
    const incomingProfileCustomer = incoming.profileCustomer ?? incoming.account.profileCustomer;
    const profileCustomer = incomingProfileCustomer?.id && incomingProfileCustomer.id === customer?.id
        ? customer
        : incomingProfileCustomer;
    const profileState = incoming.profileState ?? incoming.account.profileState;
    return {
        account: {
            ...incoming.account,
            customer,
            profileCustomer,
            profileState,
        },
        auditEvents: includeSet.has("audit") ? incoming.auditEvents : previous.auditEvents,
        customer,
        memberships: incoming.memberships,
        permissions: incoming.permissions,
        profileCustomer,
        profileState,
    };
}
function createAccountProfileEditor(account: Account, profileCustomer: AccountCustomer | null): AccountProfileEditorState {
    const shippingAddress = parseAddressDraft(profileCustomer?.shippingAddress);
    const billingAddress = parseAddressDraft(profileCustomer?.billingAddress);
    const billingSameAsShipping = !normalizeAddressText(profileCustomer?.billingAddress) ||
        normalizeAddressText(profileCustomer?.billingAddress) ===
            normalizeAddressText(profileCustomer?.shippingAddress);
    const editor = {
        account,
        billingAddress: billingSameAsShipping ? shippingAddress : billingAddress,
        billingSameAsShipping,
        companyName: profileCustomer?.name ??
            account.displayName ??
            account.email ??
            "",
        contactName: profileCustomer?.contactName ?? "",
        email: account.email ?? profileCustomer?.email ?? "",
        fiscalCode: profileCustomer?.fiscalCode ?? "",
        pec: profileCustomer?.pec ?? "",
        phone: profileCustomer?.phone ?? "",
        reason: "",
        shippingAddress, mode: profileCustomer?.id ? "correction" as const : "complete" as const,
    };
    return { ...editor, original: profileEditorValues(editor) };
}
function profileEditorValues(editor: Pick<AccountProfileEditorState, "companyName" | "contactName" | "fiscalCode" | "pec" | "phone" | "shippingAddress" | "billingAddress" | "billingSameAsShipping">): Record<string, string> {
    const shippingAddress = formatAddressDraft(editor.shippingAddress);
    return { companyName: editor.companyName, contactName: editor.contactName, fiscalCode: editor.fiscalCode, pec: editor.pec, phone: editor.phone,
        shippingAddress, billingAddress: editor.billingSameAsShipping ? shippingAddress : formatAddressDraft(editor.billingAddress) };
}
function includesForDetailTab(tab: AccountDetailTab, detail: AccountDetail): AccountDetailInclude[] {
    if (tab === "orders" || tab === "spend") {
        return detail.account.accountType === "customer" ? ["orders"] : [];
    }
    if (tab === "activity") {
        return detail.account.accountType === "customer" || detail.customer
            ? ["activity", "audit"]
            : ["audit"];
    }
    return [];
}
function normalizeDetailTab(value: string): AccountDetailTab {
    if (value === "activity" ||
        value === "memberships" ||
        value === "orders" ||
        value === "permissions" ||
        value === "profile" ||
        value === "spend") {
        return value;
    }
    return "profile";
}
function customerDetailTabValue(tab: AccountDetailTab) {
    return tab === "orders" || tab === "spend" || tab === "activity" ? tab : "profile";
}
function employeeDetailTabValue(tab: AccountDetailTab) {
    if (tab === "profile") {
        return "profile";
    }
    return tab === "memberships" || tab === "activity" ? tab : "permissions";
}
function defaultDetailTabForAccount(): AccountDetailTab {
    return "profile";
}
function commerceCustomerForAccount(account: Pick<Account, "accountType" | "customer" | "profileCustomer">) {
    return account.accountType === "employee" ? account.profileCustomer : account.customer;
}
function AccountListItem({ account, active, currentUserId, disabled = false, onOpen, }: {
    account: Account;
    active: boolean;
    currentUserId: string | null;
    disabled?: boolean;
    onOpen: (account: Account) => void;
}) {
    const { locale } = useI18n();
    const isSelf = account.userId === currentUserId;
    const text = useAdminText();
    const commerceCustomer = commerceCustomerForAccount(account);
    return (<button type="button" disabled={disabled} className={cn("w-full rounded-md border px-2.5 py-2 text-left transition", active
            ? "border-primary/30 bg-primary/8"
            : "border-slate-200 bg-white hover:border-primary/30 hover:bg-primary/5")} onClick={() => onOpen(account)}>
      <div className="flex min-w-0 items-start gap-2">
        <AccountAvatar account={account}/>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <div className="truncate text-[13px] font-black leading-5 text-slate-950">
              {account.displayName ?? account.email ?? account.userId}
            </div>
            {isSelf ? (<Badge className="h-5 border-blue-200 bg-blue-50 px-1.5 text-[10px] text-blue-700" variant="outline">{accountText("当前账号", locale)}</Badge>) : null}
          </div>
          <div className="truncate text-[11px] font-semibold leading-4 text-slate-500">
            {account.email ?? account.userId}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            <Badge className={cn("h-5 px-1.5 text-[10px]", accountTypeBadgeClass(account.accountType))} variant="outline">
              {accountTypeLabel(account.accountType, locale)}
            </Badge>
            <ProfileStateBadge state={account.profileState}/>
            {account.accountType === "employee" ? (<Badge className="h-5 border-indigo-200 bg-indigo-50 px-1.5 text-[10px] text-indigo-700" variant="outline">
                {roleTemplateLabel(text, account.roleTemplate ?? account.role)}
              </Badge>) : null}
            <CustomerAssignmentBadges customer={commerceCustomer}/>
          </div>
        </div>
      </div>
    </button>);
}
function AccountDetailPane({ canReadOrders, canManageCustomerLevel, canManageCustomerProfile, canManageCustomerStatus, canManageCustomerType, canManageEmployeeAccounts, currentUserId, detail, loadedIncludes, loading, loadingIncludes, onAction, onCustomerAction, onProfileEdit, onTabChange, tab, }: {
    canReadOrders: boolean;
    canManageCustomerLevel: boolean;
    canManageCustomerProfile: boolean;
    canManageCustomerStatus: boolean;
    canManageCustomerType: boolean;
    canManageEmployeeAccounts: boolean;
    currentUserId: string | null;
    detail: AccountDetail | null;
    loadedIncludes: Set<AccountDetailInclude>;
    loading: boolean;
    loadingIncludes: Set<AccountDetailInclude>;
    onAction: (kind: ConversionKind, account: Account) => void;
    onCustomerAction: (kind: CustomerActionKind, account: Account) => void;
    onProfileEdit: (account: Account, profileCustomer?: AccountCustomer | null) => void;
    onTabChange: (value: string) => void;
    tab: AccountDetailTab;
}) {
    const { locale } = useI18n();
    const text = useAdminText();
    if (loading && !detail) {
        return (<div className="rounded-md border border-slate-200 bg-white p-2 sm:p-3">
        <div className="h-6 w-40 animate-pulse rounded bg-slate-100 sm:h-7 sm:w-48"/>
        <div className="mt-2 grid grid-cols-3 gap-1 sm:mt-3 sm:gap-2">
          <div className="h-12 animate-pulse rounded bg-slate-100 sm:h-16"/>
          <div className="h-12 animate-pulse rounded bg-slate-100 sm:h-16"/>
          <div className="h-12 animate-pulse rounded bg-slate-100 sm:h-16"/>
        </div>
        <div className="mt-2 h-28 animate-pulse rounded bg-slate-100 sm:mt-3 sm:h-36"/>
      </div>);
    }
    if (!detail) {
        return (<div className="grid min-h-[320px] place-items-center rounded-md border border-dashed border-slate-300 bg-slate-50/70 p-6 text-center">
        <div>
          <UsersRound className="mx-auto size-8 text-slate-300"/>
          <div className="mt-2 text-sm font-black text-slate-700">{accountText("选择一个账号查看详情", locale)}</div>
          <div className="mt-1 text-xs font-semibold text-slate-500">{accountText("右侧会显示资料、权限、客户等级和最近操作。", locale)}</div>
        </div>
      </div>);
    }
    const { account } = detail;
    const isSelf = currentUserId === account.userId;
    const canManageAccountProfile = canManageCustomerProfile;
    const commerceCustomer = commerceCustomerForAccount(account);
    const commerceSpend = commerceCustomer?.spendSummary ?? emptySpendSummary();
    return (<div aria-busy={loading} aria-live="polite" className="min-w-0">
      {loading ? (<div className="mb-1.5 overflow-hidden rounded-md border border-primary/10 bg-white text-primary shadow-sm">
          <div className="h-0.5 w-full animate-pulse bg-primary/40"/>
          <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold leading-4">
            <Loader2 className="size-3 animate-spin"/>
            <span>{text.common.refreshing}</span>
          </div>
        </div>) : null}
      <div className="min-w-0 space-y-1.5 rounded-md border border-slate-200 bg-slate-50/70 p-1.5 sm:space-y-2 sm:p-2">
        <div className="flex min-w-0 items-start gap-2 rounded-md border border-slate-200 bg-white p-2 sm:p-2.5">
          <AccountAvatar account={account} size="lg"/>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="min-w-0 break-words text-sm font-black leading-5 text-slate-950 sm:text-base sm:leading-6">
                {account.displayName ?? account.email ?? accountText("账号详情", locale)}
              </h3>
              {isSelf ? (<Badge className="border-blue-200 bg-blue-50 text-blue-700" variant="outline">{accountText("当前账号", locale)}</Badge>) : null}
            </div>
            <div className="break-words text-[11px] font-semibold leading-4 text-slate-500 sm:text-xs">
              {account.email ?? account.userId}
            </div>
            <div className="mt-1 flex flex-wrap gap-1 sm:mt-1.5">
              <Badge className={accountTypeBadgeClass(account.accountType)} variant="outline">
                {accountTypeLabel(account.accountType, locale)}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                {account.authProvider}
              </Badge>
              <Badge className="border-slate-200 bg-slate-50 text-slate-600" variant="outline">
                {formatDate(account.createdAt, locale) ?? accountText("无创建时间", locale)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-1.5">
          <InfoTile icon={UsersRound} label={account.accountType === "customer" ? accountText("客户资料", locale) : accountText("自购资料", locale)} value={account.profileCustomer?.name ?? account.displayName ?? account.email ?? accountText("资料未创建", locale)}/>
          <InfoTile icon={BadgeCheck} label={accountText("资料状态", locale)} value={profileStateLabel(account.profileState, locale)}/>
          <InfoTile icon={BriefcaseBusiness} label={accountText("账号角色", locale)} value={account.accountType === "employee"
            ? roleTemplateLabel(text, account.roleTemplate ?? account.role)
            : accountTypeLabel(account.accountType, locale)}/>
          <InfoTile icon={KeyRound} label={accountText("有效权限", locale)} value={detail.permissions.length}/>
        </div>

      {commerceCustomer ? (<div className="grid grid-cols-3 gap-1 sm:gap-1.5 lg:grid-cols-6">
          <InfoTile icon={BadgeCheck} label={accountText("活跃状态", locale)} value={customerStatusLabel(commerceCustomer.status, locale)}/>
          <InfoTile icon={BriefcaseBusiness} label={accountText("价格类型", locale)} value={customerTypeLabel(commerceCustomer.customerType, locale)}/>
          <InfoTile icon={Star} label={accountText("客户等级", locale)} value={<span className="inline-flex min-w-0 items-center gap-1">
                <span className="truncate">{customerLevelLabel(commerceCustomer.level, locale)}</span>
                <CustomerPromoBadge customer={commerceCustomer} compact/>
              </span>}/>
          <InfoTile icon={ShoppingBag} label={accountText("订单数量", locale)} value={commerceSpend.orderCount || commerceCustomer.ordersCount}/>
          <InfoTile icon={CircleDollarSign} label={accountText("消费金额", locale)} value={formatEuro(commerceSpend.total || commerceCustomer.revenue)}/>
          <InfoTile icon={Clock3} label={accountText("最近订单", locale)} value={formatDate(commerceCustomer.lastOrderAt, locale) ?? accountText("暂无", locale)}/>
        </div>) : null}

      <div className="flex flex-wrap gap-1">
        {account.accountType === "customer" && canManageEmployeeAccounts ? (<Button size="xs" disabled={isSelf} onClick={() => onAction("to_employee", account)}>
            <ArrowLeftRight className="size-3.5"/>{accountText("转为员工", locale)}</Button>) : account.accountType === "employee" && canManageEmployeeAccounts ? (<>
            <Button size="xs" variant="outline" className="bg-white" disabled={isSelf} onClick={() => onAction("role", account)}>
              <ShieldCheck className="size-3.5"/>{accountText("调整角色", locale)}</Button>
            <Button size="xs" variant="outline" className="bg-white" disabled={isSelf} onClick={() => onAction("to_customer", account)}>
              <ArrowLeftRight className="size-3.5"/>{accountText("转为客户", locale)}</Button>
          </>) : account.accountType === "employee" ? (<span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold text-slate-500">{accountText("员工账号为只读", locale)}</span>) : null}
        {isSelf && canManageEmployeeAccounts ? (<span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800">
            <AlertTriangle className="size-3.5"/>{accountText("当前账号禁止自我降级", locale)}</span>) : null}
      </div>

      {account.accountType === "customer" ? (<Tabs value={customerDetailTabValue(tab)} onValueChange={onTabChange} className="space-y-2">
          <TabsList className={detailTabsListClassName}>
            <TabsTrigger value="profile" className={detailTabsTriggerClassName}>{accountText("客户资料", locale)}</TabsTrigger>
            <TabsTrigger value="orders" className={detailTabsTriggerClassName}>{accountText("历史订单", locale)}</TabsTrigger>
            <TabsTrigger value="spend" className={detailTabsTriggerClassName}>{accountText("消费明细", locale)}</TabsTrigger>
            <TabsTrigger value="activity" className={detailTabsTriggerClassName}>{accountText("活动记录", locale)}</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="m-0">
            <CustomerProfileTab account={account} canManageCustomerLevel={canManageCustomerLevel} canManageProfile={canManageAccountProfile} canManageCustomerStatus={canManageCustomerStatus} canManageCustomerType={canManageCustomerType} customer={detail.customer} onCustomerAction={onCustomerAction} onProfileEdit={onProfileEdit} profileCustomer={detail.profileCustomer} profileState={detail.profileState}/>
          </TabsContent>
          <TabsContent value="orders" className="m-0">
            <CustomerOrdersTab canReadOrders={canReadOrders} customerId={detail.customer?.id ?? undefined} accountId={account.userId} loaded={loadedIncludes.has("orders")} loading={loadingIncludes.has("orders")} orders={detail.customer?.orders ?? []}/>
          </TabsContent>
          <TabsContent value="spend" className="m-0">
            <CustomerSpendTab canReadOrders={canReadOrders} accountId={account.userId} customer={detail.customer} loaded={loadedIncludes.has("orders")} loading={loadingIncludes.has("orders")}/>
          </TabsContent>
          <TabsContent value="activity" className="m-0">
            <AccountActivityTab detail={detail} loaded={loadedIncludes.has("activity") || loadedIncludes.has("audit")} loading={loadingIncludes.has("activity") || loadingIncludes.has("audit")} text={text}/>
          </TabsContent>
        </Tabs>) : (<Tabs value={employeeDetailTabValue(tab)} onValueChange={onTabChange} className="space-y-2">
          <TabsList className={detailTabsListClassName}>
            <TabsTrigger value="profile" className={detailTabsTriggerClassName}>{accountText("自购资料", locale)}</TabsTrigger>
            <TabsTrigger value="permissions" className={detailTabsTriggerClassName}>{accountText("有效权限", locale)}</TabsTrigger>
            <TabsTrigger value="memberships" className={detailTabsTriggerClassName}>{accountText("客户关系", locale)}</TabsTrigger>
            <TabsTrigger value="activity" className={detailTabsTriggerClassName}>{accountText("活动记录", locale)}</TabsTrigger>
          </TabsList>
          <TabsContent value="profile" className="m-0">
            <CustomerProfileTab account={account} canManageCustomerLevel={canManageCustomerLevel} canManageProfile={canManageAccountProfile} canManageCustomerStatus={canManageCustomerStatus} canManageCustomerType={canManageCustomerType} customer={detail.customer} onCustomerAction={onCustomerAction} onProfileEdit={onProfileEdit} profileCustomer={detail.profileCustomer} profileState={detail.profileState}/>
          </TabsContent>
          <TabsContent value="permissions" className="m-0">
            <AccountPermissionsSection detail={detail} text={text}/>
          </TabsContent>
          <TabsContent value="memberships" className="m-0">
            <EmployeeMembershipsSection detail={detail} text={text}/>
          </TabsContent>
          <TabsContent value="activity" className="m-0">
            <AccountActivityTab detail={detail} loaded={loadedIncludes.has("audit")} loading={loadingIncludes.has("audit")} text={text}/>
          </TabsContent>
        </Tabs>)}
      </div>
    </div>);
}
function CustomerProfileTab({ account, canManageCustomerLevel, canManageProfile, canManageCustomerStatus, canManageCustomerType, customer, onCustomerAction, onProfileEdit, profileCustomer, profileState, }: {
    account: Account;
    canManageCustomerLevel: boolean;
    canManageProfile: boolean;
    canManageCustomerStatus: boolean;
    canManageCustomerType: boolean;
    customer: AccountCustomer | null;
    onCustomerAction: (kind: CustomerActionKind, account: Account) => void;
    onProfileEdit: (account: Account, profileCustomer?: AccountCustomer | null) => void;
    profileCustomer: AccountCustomer | null;
    profileState: AccountProfileState;
}) {
    const { locale } = useI18n();
    const commerceCustomer = account.accountType === "employee" ? profileCustomer : customer;
    const historyCustomer = account.accountType === "employee" && customer?.id && customer.id !== commerceCustomer?.id
        ? customer
        : null;
    const canShowCustomerActions = Boolean(commerceCustomer);
    const title = account.accountType === "employee" ? accountText("员工自购资料", locale) : accountText("客户资料", locale);
    return (<DetailSection title={title}>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <ProfileStateBadge state={profileState}/>
        {profileState.missingFields.length > 0 ? (<span className="text-[11px] font-semibold leading-5 text-slate-500">{accountText("缺少：", locale)}{profileState.missingFields.map(item => profileMissingFieldLabel(item, locale)).join("、")}
          </span>) : null}
        <Button size="xs" variant="outline" className="ml-auto bg-white" disabled={!canManageProfile} onClick={() => onProfileEdit(account, profileCustomer)}>
          <FilePenLine className="size-3.5"/>{accountText("编辑资料", locale)}</Button>
      </div>
      {profileCustomer ? (<div className="space-y-1.5 sm:space-y-2">
          {canShowCustomerActions ? (<div className="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap sm:gap-1.5">
            <Button size="xs" variant="outline" className="bg-white" disabled={!canManageCustomerLevel} onClick={() => onCustomerAction("customer_level", account)}>
              <Star className="size-3.5"/>{accountText("修改等级", locale)}</Button>
            <Button size="xs" variant="outline" className="bg-white" disabled={!canManageCustomerStatus} onClick={() => onCustomerAction("customer_status", account)}>
              <BadgeCheck className="size-3.5"/>{accountText("修改状态", locale)}</Button>
            <Button size="xs" variant="outline" className="bg-white" disabled={!canManageCustomerType} onClick={() => onCustomerAction("customer_type", account)}>
              <BriefcaseBusiness className="size-3.5"/>{accountText("修改价格类型", locale)}</Button>
            {!canManageCustomerLevel || !canManageCustomerStatus || !canManageCustomerType ? (<span className="col-span-3 text-[11px] font-semibold leading-5 text-slate-500 sm:text-xs sm:leading-8">{accountText("缺少权限的操作会被锁定。", locale)}</span>) : null}
            </div>) : null}
          <div className="grid grid-cols-2 gap-1 sm:gap-1.5 lg:grid-cols-3">
            <DetailLine label={accountText("名称", locale)} value={profileCustomer.name ?? accountText("暂无", locale)}/>
            <DetailLine label={accountText("登录邮箱", locale)} value={account.email ?? profileCustomer.email ?? accountText("暂无", locale)}/>
            <DetailLine label={accountText("电话", locale)} value={profileCustomer.phone ?? accountText("暂无", locale)}/>
            <DetailLine label={accountText("税号", locale)} value={profileCustomer.fiscalCode ?? accountText("暂无", locale)}/>
            <DetailLine label={accountText("微信/WhatsApp", locale)} value={profileCustomer.contactName ?? accountText("可留空", locale)}/>
            <DetailLine label="PEC" value={profileCustomer.pec ?? accountText("可留空", locale)}/>
            {commerceCustomer ? (<>
                <DetailLine label={accountText("活跃状态", locale)} value={customerStatusLabel(commerceCustomer.status, locale)}/>
                <DetailLine label={accountText("价格类型", locale)} value={customerTypeLabel(commerceCustomer.customerType, locale)}/>
                <DetailLine label={accountText("客户等级", locale)} value={<span className="inline-flex min-w-0 flex-wrap items-center gap-1">
                      <span>{customerLevelLabel(commerceCustomer.level, locale)}</span>
                      <CustomerPromoBadge customer={commerceCustomer}/>
                    </span>}/>
              </>) : null}
            <DetailLine label={accountText("配送地址", locale)} multiline value={profileCustomer.shippingAddress ?? accountText("暂无", locale)}/>
            <DetailLine label={accountText("账单地址", locale)} multiline value={profileCustomer.billingAddress ?? accountText("暂无", locale)}/>
            <DetailLine label={accountText("资料完成时间", locale)} value={formatDateTime(profileCustomer.profileCompletedAt, locale) ?? accountText("未完成", locale)}/>
            <DetailLine label={accountText("更新时间", locale)} value={formatDateTime(profileCustomer.updatedAt, locale) ?? accountText("暂无", locale)}/>
          </div>
          {historyCustomer ? (<div className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600">
              <div className="mb-1 font-black text-slate-800">{accountText("历史客户资料 / 已转员工", locale)}</div>
              <div className="flex flex-wrap gap-1">
                <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">
                  {assignmentStatusLabel(historyCustomer.assignmentStatus, locale)}
                </Badge>
                <Badge className="border-sky-200 bg-sky-50 text-sky-700" variant="outline">
                  {customerTypeLabel(historyCustomer.customerType, locale)}
                </Badge>
                <Badge className="border-violet-200 bg-violet-50 text-violet-700" variant="outline">
                  {customerLevelLabel(historyCustomer.level, locale)}
                </Badge>
                <Badge className="border-slate-200 bg-slate-50 text-slate-500" variant="outline">{accountText("只读历史记录", locale)}</Badge>
              </div>
            </div>) : null}
        </div>) : (<EmptyText text={account.accountType === "employee" ? accountText("员工自购资料未创建。", locale) : accountText("客户资料未初始化。", locale)}/>)}
    </DetailSection>);
}
function accountOrdersHref(customerId: string, accountId: string, orderId?: string) {
    const params = new URLSearchParams({ panel: "orders", customerId, returnAccountId: accountId });
    if (orderId)
        params.set("orderId", orderId);
    return `/admin?${params}`;
}
function CustomerOrdersTab({ loaded, loading, orders, canReadOrders, customerId, accountId, }: {
    loaded: boolean;
    loading: boolean;
    orders: AccountCustomerOrder[];
    canReadOrders: boolean;
    customerId?: string;
    accountId: string;
}) {
    const { locale } = useI18n();
    return (<DetailSection title={accountText("最近最多20单", locale)}><p className="mb-2 text-xs text-slate-500">{accountText("这里只展示最近最多20单。完整历史请打开全部订单。", locale)}</p>{canReadOrders && customerId ? <a className="mb-2 inline-block text-xs text-primary underline" href={accountOrdersHref(customerId, accountId)}>{accountText("全部订单", locale)}</a> : null}
      {loading || !loaded ? (<LoadingText text={accountText("正在加载历史订单...", locale)}/>) : orders.length > 0 ? (<div className="space-y-1.5">
          {orders.map((order) => (<div key={order.id} className="grid gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 sm:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]">
              <div className="min-w-0">
                {canReadOrders && customerId ? <a className="break-words text-xs font-black text-primary underline" href={accountOrdersHref(customerId, accountId, order.id)}>{order.orderNo}</a> : <div className="break-words text-xs font-black text-slate-950">{order.orderNo}</div>}
                <div className="text-[11px] font-semibold text-slate-500">
                  {formatDateTime(order.createdAt, locale) ?? accountText("暂无日期", locale)}
                </div>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-1">
                <Badge className={orderStatusBadgeClass(order.status)} variant="outline">
                  {orderStatusLabel(order.status, locale)}
                </Badge>
                <Badge className={paymentStatusBadgeClass(order.paymentStatus)} variant="outline">
                  {paymentStatusLabel(order.paymentStatus, locale)}
                </Badge>
              </div>
              <div className="text-[11px] font-semibold text-slate-500">
                {order.lineCount}{accountText("行商品", locale)}</div>
              <div className="text-right text-sm font-black text-slate-950">
                {formatEuro(order.total)}
              </div>
            </div>))}
        </div>) : (<EmptyText text={accountText("暂无历史订单。", locale)}/>)}
    </DetailSection>);
}
function CustomerSpendTab({ customer, canReadOrders, accountId, loaded, loading, }: {
    customer: AccountCustomer | null;
    canReadOrders: boolean;
    accountId: string;
    loaded: boolean;
    loading: boolean;
}) {
    const { locale } = useI18n();
    const summary = customer?.spendSummary ?? emptySpendSummary();
    const orders = customer?.orders ?? [];
    return (<DetailSection title={accountText("消费金额明细", locale)}><p className="mb-2 text-xs text-slate-500">{accountText("订单明细表仅展示最近最多20单。更多订单请打开全部订单。", locale)}</p>{canReadOrders && customer?.id ? <a className="mb-2 inline-block text-xs text-primary underline" href={accountOrdersHref(customer.id, accountId)}>{accountText("全部订单", locale)}</a> : null}
      {loading || !loaded ? (<LoadingText text={accountText("正在加载消费明细...", locale)}/>) : (<div className="space-y-2">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-5 sm:gap-1.5">
          <SpendTile label={accountText("累计消费", locale)} value={formatEuro(summary.total)}/>
          <SpendTile label={accountText("已付款", locale)} value={formatEuro(summary.paidAmount)}/>
          <SpendTile label={accountText("待收款", locale)} value={formatEuro(summary.pendingAmount)}/>
          <SpendTile label={accountText("退款/取消", locale)} value={formatEuro(summary.refundedAmount + summary.cancelledAmount)}/>
          <SpendTile label={accountText("订单数", locale)} value={accountTemplate(["", ' 单'], [summary.orderCount], locale)}/>
        </div>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-1.5">
          <DetailLine label={accountText("净额", locale)} value={formatEuro(summary.totalNet)}/>
          <DetailLine label="VAT" value={formatEuro(summary.vat)}/>
          <DetailLine label={accountText("运费", locale)} value={formatEuro(summary.shipping)}/>
          <DetailLine label={accountText("退款金额", locale)} value={formatEuro(summary.refundedAmount)}/>
        </div>
        {orders.length > 0 ? (<div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
            <div className="min-w-[620px]">
              <div className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr] border-b border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <span>{accountText("订单", locale)}</span>
                <span>{accountText("付款", locale)}</span>
                <span className="text-right">{accountText("净额", locale)}</span>
                <span className="text-right">VAT</span>
                <span className="text-right">{accountText("运费", locale)}</span>
                <span className="text-right">{accountText("总额", locale)}</span>
              </div>
              {orders.map((order) => (<div key={order.id} className="grid grid-cols-[1.3fr_0.9fr_0.8fr_0.8fr_0.8fr_0.9fr] border-b border-slate-100 px-2 py-1.5 text-xs last:border-b-0">
                  {canReadOrders && customer?.id ? <a className="min-w-0 truncate font-black text-primary underline" href={accountOrdersHref(customer.id, accountId, order.id)}>{order.orderNo}</a> : <span className="min-w-0 truncate font-black text-slate-900">{order.orderNo}</span>}
                  <span className="font-semibold text-slate-600">{paymentStatusLabel(order.paymentStatus, locale)}</span>
                  <span className="text-right font-semibold text-slate-700">{formatEuro(order.totalNet)}</span>
                  <span className="text-right font-semibold text-slate-700">{formatEuro(order.vat)}</span>
                  <span className="text-right font-semibold text-slate-700">{formatEuro(order.shipping)}</span>
                  <span className="text-right font-black text-slate-950">{formatEuro(order.total)}</span>
                </div>))}
            </div>
          </div>) : (<EmptyText text={accountText("暂无消费明细。", locale)}/>)}
      </div>)}
    </DetailSection>);
}
function SpendTile({ label, value }: {
    label: string;
    value: React.ReactNode;
}) {
    return (<div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
      <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-black text-slate-950">{value}</div>
    </div>);
}
function AccountPermissionsSection({ detail, text }: {
    detail: AccountDetail;
    text: AdminText;
}) {
    const { locale } = useI18n();
    const [query, setQuery] = React.useState("");
    const matches = detail.permissions.filter(permission => `${permission} ${adminPermissionLabel(text, permission, permission)}`.toLowerCase().includes(query.trim().toLowerCase()));
    return <DetailSection title={accountText("有效权限", locale)}><Input value={query} onChange={event => setQuery(event.target.value)} aria-label={accountText("搜索全部权限", locale)} placeholder={accountText("搜索全部权限", locale)}/><p className="my-2 text-xs text-slate-500">{matches.length} / {detail.permissions.length}</p>
    <div className="flex max-h-64 flex-wrap gap-1 overflow-y-auto">{matches.map(permission => <Badge key={permission} variant="outline" title={permission}>{adminPermissionLabel(text, permission, permission)} · {permission}</Badge>)}</div>{matches.length === 0 ? <EmptyText text={accountText("暂无匹配权限。", locale)}/> : null}</DetailSection>;
}
function EmployeeMembershipsSection({ detail, text, }: {
    detail: AccountDetail;
    text: AdminText;
}) {
    const { locale } = useI18n();
    return (<DetailSection title={accountText("历史客户成员关系", locale)}>
      {detail.memberships.length > 0 ? (<div className="space-y-1.5">
          {detail.memberships.map((membership) => (<div key={`${membership.customerId}:${membership.userId}`} className="rounded-md border border-slate-200 bg-slate-50/70 px-2 py-1.5">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="min-w-0 break-words text-xs font-black text-slate-900">
                  {membership.displayName ?? membership.email ?? membership.userId}
                </span>
                <Badge className={accountTypeBadgeClass(membership.accountType)} variant="outline">
                  {accountTypeLabel(membership.accountType, locale)}
                </Badge>
                <Badge className={memberStatusBadgeClass(membership.status)} variant="outline">
                  {memberStatusLabel(membership.status, locale)}
                </Badge>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] font-semibold text-slate-500">
                <span>{membership.email ?? membership.userId}</span>
                <span>{accountText("成员角色：", locale)}{memberRoleLabel(membership.memberRole, locale)}</span>
                {membership.roleTemplate ? (<span>{accountText("员工角色：", locale)}{roleTemplateLabel(text, membership.roleTemplate)}</span>) : null}
                {membership.status === "disabled" ? (<span>{accountText("旧客户成员关系已停用，不代表员工登录被禁用", locale)}</span>) : null}
              </div>
            </div>))}
        </div>) : (<EmptyText text={accountText("暂无历史客户成员关系。", locale)}/>)}
    </DetailSection>);
}
function AccountActivityTab({ detail, loaded, loading, text, }: {
    detail: AccountDetail;
    loaded: boolean;
    loading: boolean;
    text: AdminText;
}) {
    const { locale } = useI18n();
    return (<DetailSection title={accountText("活动记录", locale)}>
      {loading || !loaded ? (<LoadingText text={accountText("正在加载活动记录...", locale)}/>) : detail.auditEvents.length > 0 || (detail.customer?.recentActivity.length ?? 0) > 0 ? (<div className="grid gap-2 xl:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-slate-500">
              <ShieldCheck className="size-3.5"/>{accountText("后台审计", locale)}</div>
            {detail.auditEvents.length > 0 ? (<ol className="space-y-1.5">
                {detail.auditEvents.slice(0, 8).map((event) => (<li key={event.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="break-words text-xs font-black text-slate-900">
                          {adminActionLabel(event.action, locale)}
                        </div>
                        <div className="mt-0.5 break-words text-[11px] font-semibold leading-4 text-slate-500">
                          {[
                        event.actorEmail,
                        event.actorRole
                            ? roleTemplateLabel(text, event.actorRole, event.actorRole)
                            : null,
                        event.entityType,
                    ]
                        .filter(Boolean)
                        .join(" · ") || accountText("系统记录", locale)}
                        </div>
                        {event.reason ? (<div className="mt-0.5 break-words text-[11px] leading-4 text-slate-600">
                            {event.reason}
                          </div>) : null}
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {formatDateTime(event.createdAt, locale) ?? accountText("暂无", locale)}
                      </span>
                    </div>
                  </li>))}
              </ol>) : (<EmptyText text={accountText("暂无后台审计记录。", locale)}/>)}
          </div>
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black text-slate-500">
              <Activity className="size-3.5"/>{accountText("客户活动", locale)}</div>
            {detail.customer?.recentActivity.length ? (<ol className="space-y-1.5">
                {detail.customer.recentActivity.slice(0, 8).map((event) => (<li key={event.id} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                    <div className="flex min-w-0 items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="break-words text-xs font-black text-slate-900">
                          {customerActivityLabel(event, locale)}
                        </div>
                        <div className="mt-0.5 break-words text-[11px] font-semibold leading-4 text-slate-500">
                          {customerActivitySubject(event, locale)}
                        </div>
                      </div>
                      <span className="shrink-0 text-[11px] font-semibold text-slate-500">
                        {formatDateTime(event.createdAt, locale) ?? accountText("暂无", locale)}
                      </span>
                    </div>
                  </li>))}
              </ol>) : (<EmptyText text={accountText("暂无客户活动记录。", locale)}/>)}
          </div>
        </div>) : (<EmptyText text={accountText("暂无最近操作记录。", locale)}/>)}
    </DetailSection>);
}
function AccountActionDialog({ conversion, onChange, onClose, onSubmit, roleTemplates, submitting, error, }: {
    conversion: ConversionState | null;
    onChange: (conversion: ConversionState | null) => void;
    onClose: () => void;
    onSubmit: () => void;
    roleTemplates: RoleTemplate[];
    submitting: boolean;
    error: string;
}) {
    const { locale } = useI18n();
    const text = useAdminText();
    const title = conversion?.kind === "to_employee"
        ? accountText("客户转为员工", locale) : conversion?.kind === "to_customer"
        ? accountText("员工转为客户", locale) : accountText("调整员工角色", locale);
    const description = conversion?.kind === "to_customer"
        ? accountText("员工会恢复为客户账号并进入待处理状态；正式激活时会自动应用批发客户规则。", locale) : conversion?.kind === "to_employee"
        ? accountText("客户账号会转为员工，原客户资料会暂停并标记为已转员工。", locale) : accountText("角色模板会决定员工默认后台权限。", locale);
    const target = roleTemplates.find(template => template.id === conversion?.roleTemplate);
    const difference = rolePermissionDifference(conversion?.currentPermissions ?? [], target?.permissions ?? []);
    const canSubmit = Boolean(conversion && conversion.reason.trim().length >= 3 && (conversion.kind === "to_customer" || target));
    return (<Dialog open={Boolean(conversion)} onOpenChange={(open) => { if (!open && !submitting)
        onClose(); }}>
      <DialogContent data-admin-dirty={conversion && (conversion.reason.trim() || conversion.roleTemplate !== conversion.initialRoleTemplate) ? "true" : undefined} data-admin-mutating={submitting ? "true" : undefined} scrollLayout="body" className="admin-ui-panel sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody><fieldset disabled={submitting} className="contents">
          {error ? <AdminNotice tone="error" message={error} className="mb-3" /> : null}
          {conversion ? (<div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="font-black text-slate-900">
                  {conversion.account.displayName ?? conversion.account.email ?? conversion.account.userId}
                </div>
                <div className="mt-1 break-words text-xs text-slate-500">
                  {conversion.account.email ?? conversion.account.userId}
                </div>
              </div>
              {conversion.kind !== "to_customer" ? (<div className="space-y-1.5">
                  <Label htmlFor="account-role-template">{accountText("员工角色", locale)}</Label>
                  <Select value={conversion.roleTemplate} onValueChange={(value) => onChange({ ...conversion, roleTemplate: value })}>
                    <SelectTrigger id="account-role-template" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleTemplates.map((roleTemplate) => (<SelectItem key={roleTemplate.id} value={roleTemplate.id}>
                          {roleTemplateLabel(text, roleTemplate.id, roleTemplate.label)}
                        </SelectItem>))}
                    </SelectContent>
                  </Select>
                  {!target ? <p role="alert" className="text-sm text-amber-700">{accountText("请选择已加载的真实角色模板；没有模板时不能保存。", locale)}</p> : <div className="space-y-2 rounded-lg border bg-slate-50 p-3 text-xs"><p>{target.description || accountText("暂无角色说明", locale)}</p><p>{accountText("当前有效权限与目标角色模板差异；账号专属覆盖以保存后的有效权限为准。", locale)}</p><p>{accountText("新增 (", locale)}{difference.added.length})</p><div className="flex flex-wrap gap-1">{difference.added.map(permission => <Badge key={permission} variant="outline" className={/manage|approve|delete|permissions|finance/.test(permission) ? "border-red-300 text-red-700" : ""}>{adminPermissionLabel(text, permission, permission)} · {permission}</Badge>)}</div><p>{accountText("移除 (", locale)}{difference.removed.length})</p><div className="flex flex-wrap gap-1">{difference.removed.map(permission => <Badge key={permission} variant="outline">{adminPermissionLabel(text, permission, permission)} · {permission}</Badge>)}</div></div>}
                </div>) : null}
              <div className="space-y-1.5">
                <Label htmlFor="conversion-reason">{accountText("变更原因", locale)}</Label>
                <Textarea id="conversion-reason" aria-describedby="conversion-reason-hint" value={conversion.reason} onChange={(event) => onChange({ ...conversion, reason: event.target.value })} placeholder={accountText("说明业务原因，便于审计追踪", locale)} rows={4}/>
                <p id="conversion-reason-hint" className="text-xs text-slate-500">{accountText("至少填写 3 个字，去除首尾空格后计算。", locale)}</p>
              </div>
            </div>) : null}
        </fieldset></DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>{accountText("取消", locale)}</Button>
          <AdminActionButton pending={submitting} onClick={onSubmit} disabled={!canSubmit || submitting}>
            {!(submitting) && (<BadgeCheck className="size-4"/>)}{accountText("保存", locale)}</AdminActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
function CustomerAccountActionDialog({ action, onChange, onClose, onSubmit, submitting, error, }: {
    action: CustomerActionState | null;
    onChange: (action: CustomerActionState | null) => void;
    onClose: () => void;
    onSubmit: () => void;
    submitting: boolean;
    error: string;
}) {
    const { locale } = useI18n();
    const [previewScope, setPreviewScope] = React.useState("");
    const scopeLabel = action?.account.accountType === "employee" ? accountText("员工自购资料", locale) : accountText("客户资料", locale);
    const title = action?.kind === "customer_level"
        ? accountTemplate(["修改", '等级'], [scopeLabel], locale) : action?.kind === "customer_type"
        ? accountTemplate(["修改", '价格类型'], [scopeLabel], locale) : accountTemplate(["修改", '活跃状态'], [scopeLabel], locale);
    const description = action?.kind === "customer_level"
        ? accountText("客户等级会按每件固定金额影响前台客户价和代客下单价格。", locale) : action?.kind === "customer_type"
        ? accountText("价格类型决定客户使用零售价还是批发价，和活跃状态独立。", locale) : accountText("活跃状态只控制账号是否可继续使用价格和 checkout，不会改变价格类型。", locale);
    const canSubmit = Boolean(action && action.reason.trim().length >= 3 && (action.kind !== "customer_type" || previewScope === `${action.targetCustomer.id}:${action.customerType}`));
    return (<Dialog open={Boolean(action)} onOpenChange={(open) => { if (!open && !submitting)
        onClose(); }}>
      <DialogContent data-admin-dirty={action && (action.reason.trim() || action.level !== normalizeCustomerLevel(action.targetCustomer.level) || action.status !== normalizeCustomerStatus(action.targetCustomer.status) || action.customerType !== normalizeCustomerType(action.targetCustomer.customerType)) ? "true" : undefined} data-admin-mutating={submitting ? "true" : undefined} scrollLayout="body" className="admin-ui-panel sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogBody><fieldset disabled={submitting} className="contents">
          {error ? <AdminNotice tone="error" message={error} className="mb-3" /> : null}
          {action ? (<div className="space-y-3">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm">
                <div className="font-black text-slate-900">
                  {action.targetCustomer.name ?? action.account.displayName ?? action.account.email ?? action.account.userId}
                </div>
                <div className="mt-1 break-words text-xs text-slate-500">
                  {scopeLabel} · {action.targetCustomer.email ?? action.account.email ?? action.account.userId}
                </div>
              </div>
              {action.kind === "customer_level" ? (<div className="space-y-1.5">
                  <Label htmlFor="account-customer-level">{accountText("客户等级", locale)}</Label>
                  <Select value={action.level} onValueChange={(value) => onChange({ ...action, level: value === "automatic" ? "automatic" : normalizeCustomerLevel(value) })}>
                    <SelectTrigger id="account-customer-level" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">{accountText("恢复消费自动等级", locale)}</SelectItem>
                      {customerLevels.map((level) => (<SelectItem key={level} value={level}>
                          {customerLevelOptionLabel(level, locale)}
                        </SelectItem>))}
                    </SelectContent>
                  </Select>
                  <div className="text-xs font-semibold text-slate-500">
                    {action.level === "automatic" ? accountText("恢复消费等级作为基础，有效促销继续取高。", locale) : accountTemplate(["基础等级减价：每件减 ", '；有效促销只提升，不降低。'], [customerLevelDiscountLabel(action.level)], locale)}
                  </div>
                </div>) : action.kind === "customer_type" ? (<div className="space-y-1.5">
                  <Label htmlFor="account-customer-type">{accountText("价格类型", locale)}</Label>
                  <Select value={action.customerType} onValueChange={(value) => onChange({ ...action, customerType: normalizeCustomerType(value) })}>
                    <SelectTrigger id="account-customer-type" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {customerTypes.map((type) => (<SelectItem key={type} value={type}>
                          {customerTypeLabel(type, locale)}
                        </SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>) : (<div className="space-y-1.5">
                  <Label htmlFor="account-customer-status">{accountText("活跃状态", locale)}</Label>
                  <Select value={action.status} onValueChange={(value) => onChange({ ...action, status: normalizeCustomerStatus(value) })}>
                    <SelectTrigger id="account-customer-status" className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {customerStatuses.map((status) => (<SelectItem key={status} value={status}>
                          {customerStatusLabel(status, locale)}
                        </SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>)}
              <p className="text-xs text-slate-600">{accountText("基础等级：", locale)}{action.targetCustomer.baseLevel}（{action.targetCustomer.levelSource === "manual" ? accountText("人工", locale) : accountText("自动", locale)}{accountText("）；有效等级：", locale)}{action.targetCustomer.level}。{action.targetCustomer.promoLevelExpiresAt ? accountTemplate(["促销到期：", ''], [new Date(action.targetCustomer.promoLevelExpiresAt).toLocaleString()], locale) : ""}</p>
              {action.kind === "customer_type" && action.targetCustomer.id ? <ClassificationPricePreview key={`${action.targetCustomer.id}:${action.customerType}`} customerId={action.targetCustomer.id} customerType={action.customerType} onReady={setPreviewScope}/> : null}
              {action.kind === "customer_type" && previewScope !== `${action.targetCustomer.id}:${action.customerType}` ? (<p role="status" className="text-xs text-amber-700">{accountText("请先完成价格变更影响预览，再保存。", locale)}</p>) : null}
              <div className="space-y-1.5">
                <Label htmlFor="action-reason">{accountText("变更原因", locale)}</Label>
                <Textarea id="action-reason" aria-describedby="action-reason-hint" value={action.reason} onChange={(event) => onChange({ ...action, reason: event.target.value })} placeholder={accountText("说明业务原因，便于审计追踪", locale)} rows={4}/>
                <p id="action-reason-hint" className="text-xs text-slate-500">{accountText("至少填写 3 个字，去除首尾空格后计算。", locale)}</p>
              </div>
            </div>) : null}
        </fieldset></DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>{accountText("取消", locale)}</Button>
          <AdminActionButton pending={submitting} onClick={onSubmit} disabled={!canSubmit || submitting}>
            {!(submitting) && (<BadgeCheck className="size-4"/>)}{accountText("保存", locale)}</AdminActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
function AccountProfileEditorDialog({ editor, onAddressChange, onBillingSameAsShippingChange, onChange, onClose, onSubmit, submitting, error, onModeChange, }: {
    editor: AccountProfileEditorState | null;
    onAddressChange: (addressKey: "billingAddress" | "shippingAddress", field: AddressDraftField, value: string) => void;
    onBillingSameAsShippingChange: (checked: boolean) => void;
    onChange: (field: AccountProfileEditorField, value: string) => void;
    onClose: () => void;
    onSubmit: () => void;
    submitting: boolean;
    error: string;
    onModeChange: (mode: "complete" | "correction") => void;
}) {
    const { locale } = useI18n();
    const values = editor ? profileEditorValues(editor) : {};
    const changed = editor ? profileChangedValues(values, editor.original) : {};
    const validation = editor ? accountProfilePatchSchema.safeParse({ ...(editor.mode === "complete" ? values : changed), mode: editor.mode, reason: editor.reason }) : null;
    const canSubmit = Boolean(validation?.success);
    return (<Dialog open={Boolean(editor)} onOpenChange={(open) => { if (!open && !submitting)
        onClose(); }}>
      <DialogContent data-admin-dirty={editor && (editor.reason.trim() || Object.keys(changed).length) ? "true" : undefined} data-admin-mutating={submitting ? "true" : undefined} scrollLayout="body" className="admin-ui-panel sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {editor?.account.accountType === "employee" ? accountText("编辑员工自购资料", locale) : accountText("编辑客户个人中心资料", locale)}
          </DialogTitle>
          <DialogDescription>{accountText("这些资料用于账号、订单、发票和配送；邮箱来自登录账号，不能在这里修改。", locale)}</DialogDescription>
        </DialogHeader>
        <DialogBody><fieldset disabled={submitting} className="contents">
          {error ? <AdminNotice tone="error" message={error} className="mb-3" /> : null}
          {editor ? (<form id="admin-profile-editor-form" className="space-y-3" onSubmit={(event) => {
                event.preventDefault();
                onSubmit();
            }}>
              <div className="space-y-2"><Label htmlFor="account-profile-mode">{accountText("编辑任务", locale)}</Label><Select value={editor.mode} onValueChange={(mode) => onModeChange(mode as "complete" | "correction")}><SelectTrigger id="account-profile-mode"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="correction">{accountText("修正已知字段", locale)}</SelectItem><SelectItem value="complete">{accountText("补全资料用于购买", locale)}</SelectItem></SelectContent></Select><p className="text-xs text-slate-500">{accountText("修正模式仅保存变化字段；checkout仍要求完整档案。地址若修改，需完整填写。", locale)}</p><p className="text-xs text-slate-600">{accountText("本次变化字段：", locale)}{Object.keys(changed).join(" / ") || accountText("暂无", locale)}</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <ProfileEditorInput field="companyName" label={accountText("客户名称", locale)} required={editor.mode === "complete"} value={editor.companyName} onChange={onChange}/>
                <ProfileEditorInput field="contactName" label={accountText("微信号码 / WhatsApp 号码", locale)} value={editor.contactName} onChange={onChange}/>
                <div className="space-y-1.5">
                  <Label htmlFor="admin-profile-editor-email" className="text-xs font-black text-slate-500">{accountText("邮箱 *", locale)}</Label>
                  <Input id="admin-profile-editor-email" disabled type="email" value={editor.email}/>
                </div>
                <ProfileEditorInput field="phone" label={accountText("电话", locale)} required={editor.mode === "complete"} value={editor.phone} onChange={onChange}/>
                <ProfileEditorInput field="fiscalCode" label={accountText("税号", locale)} required={editor.mode === "complete"} value={editor.fiscalCode} onChange={onChange}/>
                <ProfileEditorInput field="pec" label="PEC" value={editor.pec} onChange={onChange}/>
              </div>

              <AddressDraftFields addressKey="shippingAddress" idPrefix="admin-profile-editor" title={accountText("配送地址", locale)} value={editor.shippingAddress} onChange={onAddressChange}/>
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                <Checkbox className="mt-0.5" checked={editor.billingSameAsShipping} onCheckedChange={(checked) => onBillingSameAsShippingChange(Boolean(checked))}/>
                <span>{accountText("账单地址跟配送地址一样", locale)}</span>
              </label>
              {!editor.billingSameAsShipping ? (<AddressDraftFields addressKey="billingAddress" idPrefix="admin-profile-editor" title={accountText("账单地址", locale)} value={editor.billingAddress} onChange={onAddressChange}/>) : null}

              <div className="space-y-1.5">
                <Label htmlFor="admin-profile-editor-reason" className="text-xs font-black text-slate-500">{accountText("变更原因 *", locale)}</Label>
                <Textarea id="admin-profile-editor-reason" aria-describedby="admin-profile-editor-reason-hint" value={editor.reason} onChange={(event) => onChange("reason", event.target.value)} placeholder={accountText("说明业务原因，便于审计追踪", locale)} rows={3}/>
                <p id="admin-profile-editor-reason-hint" className="text-xs text-slate-500">{accountText("至少填写 3 个字，去除首尾空格后计算。", locale)}</p>
              </div>

              {validation && !validation.success ? <div role="status" className="space-y-1 text-xs text-amber-700">{validation.error.issues.map((issue, index) => <p key={index}>{profileValidationMessage(issue, locale)}</p>)}</div> : null}
            </form>) : null}
        </fieldset></DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>{accountText("取消", locale)}</Button>
          <AdminActionButton pending={submitting} type="submit" form="admin-profile-editor-form" disabled={!canSubmit || submitting}>
            {!(submitting) && (<BadgeCheck className="size-4"/>)}{accountText("保存资料", locale)}</AdminActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>);
}
function profileValidationMessage(issue: { path: PropertyKey[]; message: string }, locale: string) {
    const field = String(issue.path[0] ?? "");
    const labels: Record<string, string> = { companyName: "客户名称", contactName: "微信号码 / WhatsApp 号码", fiscalCode: "税号", pec: "PEC", phone: "电话", reason: "变更原因", shippingAddress: "配送地址", billingAddress: "账单地址" };
    const message = issue.message === "PROFILE_CHANGE_REQUIRED" ? "至少修改一个字段。" : field === "reason" ? "至少填写3字的变更原因。" : field === "phone" ? "电话长度须为5至40个字符。" : issue.message === "PROFILE_COMPLETE_FIELD_REQUIRED" ? "补全模式要求填写此字段。" : "请检查此字段的长度和格式。";
    return `${accountText(labels[field] ?? field, locale)}: ${accountText(message, locale)}`;
}

function ProfileEditorInput({ field, label, onChange, required, value, }: {
    field: Exclude<AccountProfileEditorField, "reason">;
    label: string;
    onChange: (field: AccountProfileEditorField, value: string) => void;
    required?: boolean;
    value: string;
}) {
    const id = `admin-profile-editor-${field}`;
    return (<div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-black text-slate-500">
        {label}
        {required ? " *" : null}
      </Label>
      <Input id={id} required={required} value={value} onChange={(event) => onChange(field, event.currentTarget.value)}/>
    </div>);
}
async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit & {
    timeoutMs?: number;
} = {}, locale = "en-US") {
    const { signal, timeoutMs = adminAccountReadTimeoutMs, ...requestInit } = init;
    const controller = new AbortController();
    let timedOut = false;
    function abortFromParent() {
        controller.abort(signal?.reason);
    }
    if (signal?.aborted) {
        abortFromParent();
    }
    else {
        signal?.addEventListener("abort", abortFromParent, { once: true });
    }
    const timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, timeoutMs);
    try {
        return await fetch(input, {
            ...requestInit,
            signal: controller.signal,
        });
    }
    catch (error) {
        if (timedOut) {
            throw new Error(accountText("账号数据加载超时，请检查网络后重试。", locale));
        }
        throw error;
    }
    finally {
        window.clearTimeout(timeoutId);
        signal?.removeEventListener("abort", abortFromParent);
    }
}
async function fetchCurrentUser(signal?: AbortSignal, locale = "en-US"): Promise<CurrentUser> {
    const response = await fetchWithTimeout("/api/me", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
        timeoutMs: adminAccountAuxiliaryReadTimeoutMs,
    }, locale);
    if (!response.ok) {
        throw new Error(accountTemplate(["GET /api/me 返回 ", ''], [response.status], locale));
    }
    const payload = (await response.json()) as unknown;
    return {
        permissions: isRecord(payload)
            ? readArray(payload.permissions).map(readString).filter(isDefined)
            : [],
        userId: isRecord(payload) ? readString(payload.userId) : null,
    };
}
async function fetchRoleTemplates(signal?: AbortSignal, locale = "en-US"): Promise<RoleTemplate[]> {
    const response = await fetchWithTimeout("/api/admin/permissions/catalog", {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
        timeoutMs: adminAccountAuxiliaryReadTimeoutMs,
    }, locale);
    if (!response.ok) {
        return [];
    }
    const payload = (await response.json()) as unknown;
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    return readArray(data.roleTemplates).map(normalizeRoleTemplate).filter(isDefined);
}
function submitCustomerAccountAction(action: CustomerActionState, locale = "en-US"): Promise<AccountDetail> {
    if (action.kind === "customer_level") {
        return patchCustomerLevel(action.account.userId, action.level, action.reason, locale);
    }
    if (action.kind === "customer_type") {
        return patchCustomerType(action.account.userId, action.customerType, action.reason, locale);
    }
    return patchCustomerStatus(action.account.userId, action.status, action.reason, locale);
}
async function fetchAccounts(accountType: AccountType, page: number, query: string, signal?: AbortSignal, locale = "en-US") {
    const params = new URLSearchParams({
        accountType,
        limit: String(pageSize),
        offset: String(page * pageSize),
    });
    if (query.trim().length >= 2) {
        params.set("q", query.trim());
    }
    const response = await fetchWithTimeout(`/api/admin/accounts?${params.toString()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
        timeoutMs: adminAccountReadTimeoutMs,
    }, locale);
    if (!response.ok) {
        throw new Error(accountTemplate(["GET /api/admin/accounts 返回 ", ''], [response.status], locale));
    }
    const payload = (await response.json()) as unknown;
    const meta = isRecord(payload) && isRecord(payload.meta) ? payload.meta : {};
    return {
        data: isRecord(payload)
            ? readArray(payload.data).map(normalizeAccount).filter(isDefined)
            : [],
        total: readNumber(meta.total) ?? 0,
    };
}
async function fetchAccountDetail(userId: string, { includes = [], signal, }: {
    includes?: AccountDetailInclude[];
    signal?: AbortSignal;
} = {}, locale = "en-US"): Promise<AccountDetail> {
    const params = new URLSearchParams();
    if (includes.length > 0) {
        params.set("include", includes.join(","));
    }
    const query = params.toString();
    const response = await fetchWithTimeout(`/api/admin/accounts/${encodeURIComponent(userId)}${query ? `?${query}` : ""}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        signal,
        timeoutMs: adminAccountReadTimeoutMs,
    }, locale);
    if (!response.ok) {
        throw new Error(accountTemplate(["GET /api/admin/accounts/", ' 返回 ', ''], [userId, response.status], locale));
    }
    const payload = (await response.json()) as unknown;
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
    const detail = normalizeAccountDetail(data);
    if (!detail) {
        throw new Error(accountText("账号详情返回格式不完整", locale));
    }
    return detail;
}
async function patchAccountType(conversion: ConversionState, locale = "en-US"): Promise<AccountDetail> {
    const body = conversion.kind === "to_employee"
        ? {
            accountType: "employee",
            reason: conversion.reason,
            roleTemplate: conversion.roleTemplate,
            userId: conversion.account.userId,
        }
        : {
            accountType: "customer",
            assignmentStatus: "needs_review",
            customerType: "retail",
            reason: conversion.reason,
            userId: conversion.account.userId,
        };
    const response = await fetch("/api/admin/accounts", {
        body: JSON.stringify(body),
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "PATCH",
    });
    if (!response.ok) {
        throw await accountPatchError(response, locale);
    }
    return accountDetailFromResponse(await response.json(), accountText("账号变更返回格式不完整", locale), locale);
}
async function patchAccountRole(userId: string, roleTemplate: string, reason: string, locale = "en-US") {
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/role`, {
        body: JSON.stringify({ reason, roleTemplate }),
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "PATCH",
    });
    if (!response.ok) {
        throw await accountPatchError(response, locale);
    }
}
async function patchCustomerLevel(userId: string, level: CustomerLevel | "automatic", reason: string, locale = "en-US"): Promise<AccountDetail> {
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-level`, {
        body: JSON.stringify({ level, reason }),
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "PATCH",
    });
    if (!response.ok) {
        throw await accountPatchError(response, locale);
    }
    return accountDetailFromResponse(await response.json(), accountText("客户等级更新返回格式不完整", locale), locale);
}
async function patchCustomerStatus(userId: string, status: CustomerStatus, reason: string, locale = "en-US"): Promise<AccountDetail> {
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-status`, {
        body: JSON.stringify({ reason, status }),
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "PATCH",
    });
    if (!response.ok) {
        throw await accountPatchError(response, locale);
    }
    return accountDetailFromResponse(await response.json(), accountText("客户状态更新返回格式不完整", locale), locale);
}
async function patchCustomerType(userId: string, customerType: CustomerType, reason: string, locale = "en-US"): Promise<AccountDetail> {
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-type`, {
        body: JSON.stringify({ customerType, reason }),
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "PATCH",
    });
    if (!response.ok) {
        throw await accountPatchError(response, locale);
    }
    return accountDetailFromResponse(await response.json(), accountText("价格类型更新返回格式不完整", locale), locale);
}
async function patchAccountCustomerProfile(userId: string, profile: AccountProfilePatch, locale = "en-US"): Promise<AccountDetail> {
    const response = await fetch(`/api/admin/accounts/${encodeURIComponent(userId)}/customer-profile`, {
        body: JSON.stringify(profile),
        cache: "no-store",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
        },
        method: "PATCH",
    });
    if (!response.ok) {
        throw await accountPatchError(response, locale);
    }
    return accountDetailFromResponse(await response.json(), accountText("账号资料更新返回格式不完整", locale), locale);
}
class AccountWriteSavedError extends Error {
}
async function accountPatchError(response: Response, locale = "en-US") {
    const payload = await response.json().catch(() => null) as { error?: { code?: string; details?: { issues?: { path: string; message: string }[] } } } | null;
    const code = payload?.error?.code ?? `HTTP_${response.status}`;
    const message = code === "ADMIN_PERMISSION_DENIED" ? "当前账号没有执行此操作的权限。" : code === "ACCOUNT_PROFILE_NOT_INITIALIZED" ? "资料未初始化，请先补全资料用于购买。" : code.includes("SELF_") ? "当前账号禁止自我降级" : response.status === 400 ? "请检查输入字段后重试。" : "操作失败，请稍后重试。";
    const fields = payload?.error?.details?.issues?.map(issue => profileValidationMessage({ path: issue.path.split("."), message: issue.message }, locale)).join("; ");
    return new Error(`${accountText(message, locale)}${fields ? ` ${fields}` : ""} (${code})`);
}

function accountDetailFromResponse(payload: unknown, message: string, locale = "en-US"): AccountDetail {
    if (isRecord(payload) && isRecord(payload.meta) && payload.meta.saved === true && !payload.data)
        throw new AccountWriteSavedError(accountText("已保存；账号详情刷新失败，请重试读取，不要重复提交。", locale));
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : null;
    const detail = normalizeAccountDetail(data);
    if (!detail) {
        throw new Error(message);
    }
    return detail;
}
function AccountAvatar({ account, size = "default", }: {
    account: Pick<Account, "accountType" | "displayName" | "email">;
    size?: "default" | "lg";
}) {
    const Icon = account.accountType === "employee" ? UserCog : UsersRound;
    return (<div className={cn("grid shrink-0 place-items-center rounded-full text-white shadow-sm", account.accountType === "employee" ? "bg-indigo-600" : "bg-blue-600", size === "lg" ? "size-10" : "size-8")} aria-hidden="true">
      {size === "lg" ? (<Icon className="size-5"/>) : (<span className="text-xs font-black">{initials(account)}</span>)}
    </div>);
}
function InfoTile({ icon: Icon, label, value, }: {
    icon: React.ComponentType<{
        className?: string;
    }>;
    label: string;
    value: React.ReactNode;
}) {
    return (<div className="min-h-[46px] min-w-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 sm:min-h-[56px] sm:px-2 sm:py-1.5">
      <div className="flex min-w-0 items-center gap-1 text-[10px] font-bold leading-3 text-slate-500 sm:text-[11px]">
        <Icon className="size-3 shrink-0 sm:size-3.5"/>
        <span className="min-w-0 truncate">{label}</span>
      </div>
      <div className="mt-0.5 truncate text-[12px] font-black leading-4 text-slate-900 sm:text-[13px] sm:leading-5">
        {value}
      </div>
    </div>);
}
function DetailSection({ children, title }: {
    children: React.ReactNode;
    title: string;
}) {
    return (<section className="rounded-md border border-slate-200 bg-white p-2 sm:p-2.5">
      <h4 className="mb-1.5 text-[11px] font-black uppercase tracking-wide text-slate-500 sm:mb-2 sm:text-xs">{title}</h4>
      {children}
    </section>);
}
function DetailLine({ label, multiline = false, value, }: {
    label: string;
    multiline?: boolean;
    value: React.ReactNode;
}) {
    return (<div className={cn("min-w-0 rounded-md bg-slate-50 px-1.5 py-1 sm:px-2", multiline && "sm:col-span-2 lg:col-span-3")}>
      <div className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
      <div className={cn("text-[11px] font-bold leading-4 text-slate-900 sm:text-xs sm:leading-5", multiline ? "break-words" : "truncate sm:break-words")}>
        {value}
      </div>
    </div>);
}
function CustomerAssignmentBadges({ customer }: {
    customer: AccountCustomer | null;
}) {
    const { locale } = useI18n();
    const badgeClass = "h-5 px-1.5 text-[10px]";
    if (!customer) {
        return (<Badge className={cn(badgeClass, "border-slate-200 bg-slate-50 text-slate-500")} variant="outline">{accountText("客户资料未初始化", locale)}</Badge>);
    }
    return (<>
      <Badge className={cn(badgeClass, customerStatusBadgeClass(customer.status))} variant="outline">
        {customerStatusLabel(customer.status, locale)}
      </Badge>
      <Badge className={cn(badgeClass, "border-sky-200 bg-sky-50 text-sky-700")} variant="outline">
        {customerTypeLabel(customer.customerType, locale)}
      </Badge>
      <Badge className={cn(badgeClass, "border-violet-200 bg-violet-50 text-violet-700")} variant="outline">
        {customerLevelLabel(customer.level, locale)}
      </Badge>
      <CustomerPromoBadge customer={customer} compact/>
      <Badge className={cn(badgeClass, "border-slate-200 bg-slate-50 text-slate-500")} variant="outline">
        {customer.ordersCount}{accountText("单", locale)}</Badge>
    </>);
}
function ProfileStateBadge({ state }: {
    state: AccountProfileState;
}) {
    const { locale } = useI18n();
    return (<Badge className={cn("h-5 px-1.5 text-[10px]", profileStateBadgeClass(state.status))} variant="outline">
      {profileStateLabel(state, locale)}
    </Badge>);
}
function CustomerPromoBadge({ compact = false, customer, }: {
    compact?: boolean;
    customer: AccountCustomer;
}) {
    const { locale } = useI18n();
    const expiresAt = activePromoExpiresAt(customer);
    if (!expiresAt) {
        return null;
    }
    return (<Badge className={cn("h-5 shrink-0 border-emerald-200 bg-emerald-50 px-1.5 text-[10px] font-black text-emerald-700", compact && "max-w-[92px] truncate")} variant="outline">{accountText("活动至", locale)}{formatDate(expiresAt, locale)}
    </Badge>);
}
function NoticeBanner({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) { return <AdminNotice tone={notice.tone} message={notice.message} onDismiss={onDismiss} dismissLabel="OK" />; }
function AccountListSkeleton() {
    const { locale } = useI18n();
    return (<div className="space-y-2">
      <LoadingText text={accountText("正在加载账号...", locale)}/>
      {Array.from({ length: 5 }).map((_, index) => (<div key={index} className="grid h-[76px] animate-pulse grid-cols-[minmax(0,1fr)_68px] gap-3 rounded-md border border-slate-200 bg-white p-2">
          <div className="min-w-0 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-200"/>
            <div className="h-3 w-5/6 rounded bg-slate-100"/>
            <div className="h-5 w-24 rounded-full bg-slate-100"/>
          </div>
          <div className="h-7 rounded bg-slate-100"/>
        </div>))}
    </div>);
}
function EmptyText({ text }: { text: string }) { return <AdminEmptyState title={text} className="py-4" />; }
function LoadingText({ text }: {
    text: string;
}) {
    return (<div className="flex items-center justify-center gap-1.5 rounded-md border border-primary/10 bg-primary/5 p-4 text-sm font-semibold text-primary">
      <Loader2 className="size-4 animate-spin"/>
      {text}
    </div>);
}
function normalizeAccountDetail(value: unknown): AccountDetail | null {
    if (!isRecord(value)) {
        return null;
    }
    const account = normalizeAccount(value.account);
    if (!account) {
        return null;
    }
    const customer = normalizeCustomer(value.customer) ?? account.customer;
    const profileCustomer = normalizeCustomer(value.profileCustomer) ?? account.profileCustomer;
    const profileState = normalizeProfileState(value.profileState, account.accountType, profileCustomer);
    const normalizedAccount = {
        ...account,
        customer,
        profileCustomer,
        profileState,
    };
    return {
        account: normalizedAccount,
        customer,
        memberships: readArray(value.memberships).map(normalizeMembership).filter(isDefined),
        permissions: readArray(value.permissions).map(readString).filter(isDefined),
        auditEvents: readArray(value.auditEvents).map(normalizeAuditEvent).filter(isDefined),
        profileCustomer,
        profileState,
    };
}
function normalizeAccount(value: unknown): Account | null {
    if (!isRecord(value)) {
        return null;
    }
    const userId = readString(value.userId);
    if (!userId) {
        return null;
    }
    const accountType: AccountType = readString(value.accountType) === "employee" ? "employee" : "customer";
    const customer = normalizeCustomer(value.customer);
    const rawProfileCustomer = normalizeCustomer(value.profileCustomer);
    const profileCustomer = rawProfileCustomer ?? (accountType === "employee" ? null : customer);
    const profileState = normalizeProfileState(value.profileState, accountType, profileCustomer);
    return {
        userId,
        email: readString(value.email),
        displayName: readString(value.displayName),
        avatarUrl: readString(value.avatarUrl),
        authProvider: readString(value.authProvider) ?? "password",
        accountType,
        role: readString(value.role) ?? "customer",
        roleTemplate: readString(value.roleTemplate),
        customerId: readString(value.customerId),
        customerState: readString(value.customerState) ?? "profiles_only",
        customer,
        profileCustomer,
        profileState,
        createdAt: readString(value.createdAt),
        updatedAt: readString(value.updatedAt),
    };
}
function normalizeCustomer(value: unknown): AccountCustomer | null {
    if (!isRecord(value)) {
        return null;
    }
    return {
        id: readString(value.id),
        userId: readString(value.userId),
        name: readString(value.name),
        contactName: readString(value.contactName),
        email: readString(value.email),
        phone: readString(value.phone),
        vatNumber: readString(value.vatNumber),
        fiscalCode: readString(value.fiscalCode),
        sdi: readString(value.sdi),
        pec: readString(value.pec),
        billingAddress: readString(value.billingAddress),
        shippingAddress: readString(value.shippingAddress),
        status: readString(value.status) ?? "pending",
        customerType: readString(value.customerType) ?? "retail",
        assignmentStatus: readString(value.assignmentStatus) ?? "needs_review",
        profileKind: readString(value.profileKind) ?? "customer",
        level: readString(value.level) ?? "bronze",
        baseLevel: readString(value.baseLevel) ?? "bronze",
        levelSource: readString(value.levelSource) ?? "automatic",
        storedLevel: readString(value.storedLevel) ?? "bronze",
        lifetimeSpendNet: readNumber(value.lifetimeSpendNet) ?? 0,
        promoLevel: readString(value.promoLevel),
        promoLevelStartsAt: readString(value.promoLevelStartsAt),
        promoLevelExpiresAt: readString(value.promoLevelExpiresAt),
        promoLevelReason: readString(value.promoLevelReason),
        orders: readArray(value.orders).map(normalizeCustomerOrder).filter(isDefined),
        ordersCount: readNumber(value.ordersCount) ?? 0,
        revenue: readNumber(value.revenue) ?? readNumber(value.lifetimeSpendNet) ?? 0,
        lastOrderAt: readString(value.lastOrderAt),
        lastActivityAt: readString(value.lastActivityAt),
        recentActivity: readArray(value.recentActivity).map(normalizeCustomerActivity).filter(isDefined),
        spendSummary: normalizeSpendSummary(value.spendSummary),
        profileCompletedAt: readString(value.profileCompletedAt),
        convertedToEmployeeAt: readString(value.convertedToEmployeeAt),
        createdAt: readString(value.createdAt),
        updatedAt: readString(value.updatedAt),
    };
}
function normalizeProfileState(value: unknown, accountType: AccountType, profileCustomer: AccountCustomer | null): AccountProfileState {
    if (isRecord(value)) {
        const statusValue = readString(value.status);
        const status = statusValue === "complete" || statusValue === "missing"
            ? statusValue
            : statusValue === "incomplete"
                ? "incomplete"
                : null;
        const kind = readString(value.kind) === "employee_self" ? "employee_self" : "customer";
        if (status) {
            return {
                kind,
                missingFields: readArray(value.missingFields).map(readString).filter(isDefined),
                status,
            };
        }
    }
    if (!profileCustomer) {
        return {
            kind: accountType === "employee" ? "employee_self" : "customer",
            missingFields: ["profile"],
            status: "missing",
        };
    }
    const missingFields = profileMissingFields(profileCustomer);
    return {
        kind: accountType === "employee" ? "employee_self" : "customer",
        missingFields,
        status: missingFields.length > 0 ? "incomplete" : "complete",
    };
}
function profileMissingFields(profileCustomer: AccountCustomer) {
    const missingFields: string[] = [];
    for (const [field, value] of [
        ["name", profileCustomer.name],
        ["email", profileCustomer.email],
        ["phone", profileCustomer.phone],
        ["fiscalCode", profileCustomer.fiscalCode],
        ["billingAddress", profileCustomer.billingAddress],
        ["shippingAddress", profileCustomer.shippingAddress],
    ] as const) {
        if (!value) {
            missingFields.push(field);
        }
    }
    return missingFields;
}
function normalizeCustomerOrder(value: unknown): AccountCustomerOrder | null {
    if (!isRecord(value)) {
        return null;
    }
    const id = readString(value.id);
    const orderNo = readString(value.orderNo);
    if (!id || !orderNo) {
        return null;
    }
    return {
        id,
        orderNo,
        status: readString(value.status) ?? "submitted",
        paymentStatus: readString(value.paymentStatus) ?? "unpaid",
        totalNet: readNumber(value.totalNet) ?? 0,
        vat: readNumber(value.vat) ?? 0,
        shipping: readNumber(value.shipping) ?? 0,
        total: readNumber(value.total) ?? 0,
        lineCount: readNumber(value.lineCount) ?? 0,
        createdAt: readString(value.createdAt),
        updatedAt: readString(value.updatedAt),
    };
}
function normalizeSpendSummary(value: unknown): AccountSpendSummary {
    if (!isRecord(value)) {
        return emptySpendSummary();
    }
    return {
        cancelledAmount: readNumber(value.cancelledAmount) ?? 0,
        orderCount: readNumber(value.orderCount) ?? 0,
        paidAmount: readNumber(value.paidAmount) ?? 0,
        pendingAmount: readNumber(value.pendingAmount) ?? 0,
        refundedAmount: readNumber(value.refundedAmount) ?? 0,
        shipping: readNumber(value.shipping) ?? 0,
        total: readNumber(value.total) ?? 0,
        totalNet: readNumber(value.totalNet) ?? 0,
        vat: readNumber(value.vat) ?? 0,
    };
}
function emptySpendSummary(): AccountSpendSummary {
    return {
        cancelledAmount: 0,
        orderCount: 0,
        paidAmount: 0,
        pendingAmount: 0,
        refundedAmount: 0,
        shipping: 0,
        total: 0,
        totalNet: 0,
        vat: 0,
    };
}
function normalizeCustomerActivity(value: unknown): AccountCustomerActivity | null {
    if (!isRecord(value)) {
        return null;
    }
    const id = readString(value.id);
    if (!id) {
        return null;
    }
    return {
        id,
        eventType: readString(value.eventType) ?? "activity",
        skuCode: readString(value.skuCode),
        productName: readString(value.productName),
        brand: readString(value.brand),
        model: readString(value.model),
        modelSeries: readString(value.modelSeries),
        searchQuery: readString(value.searchQuery),
        createdAt: readString(value.createdAt),
    };
}
function normalizeMembership(value: unknown): AccountMembership | null {
    if (!isRecord(value)) {
        return null;
    }
    const customerId = readString(value.customerId);
    const userId = readString(value.userId);
    if (!customerId || !userId) {
        return null;
    }
    return {
        customerId,
        userId,
        email: readString(value.email),
        displayName: readString(value.displayName),
        accountType: readString(value.accountType) ?? "customer",
        role: readString(value.role),
        roleTemplate: readString(value.roleTemplate),
        memberRole: readString(value.memberRole) ?? "owner",
        status: readString(value.status) ?? "active",
        createdAt: readString(value.createdAt),
    };
}
function normalizeAuditEvent(value: unknown): AccountAuditEvent | null {
    if (!isRecord(value)) {
        return null;
    }
    const id = readString(value.id);
    if (!id) {
        return null;
    }
    return {
        id,
        action: readString(value.action) ?? "admin.audit",
        actorEmail: readString(value.actorEmail),
        actorRole: readString(value.actorRole),
        entityType: readString(value.entityType),
        reason: readString(value.reason),
        result: readString(value.result) ?? "ok",
        createdAt: readString(value.createdAt),
    };
}
function normalizeRoleTemplate(value: unknown): RoleTemplate | null {
    if (!isRecord(value)) {
        return null;
    }
    const id = readString(value.id);
    if (!id) {
        return null;
    }
    return {
        id,
        label: readString(value.label) ?? id,
        description: readString(value.description),
        permissions: readArray(value.permissions).map(readString).filter(isDefined),
    };
}
function accountTypeLabel(value: string, locale = "en-US") {
    return value === "employee" ? accountText("员工账号", locale) : accountText("客户账号", locale);
}
function profileStateLabel(state: AccountProfileState, locale = "en-US") {
    if (state.status === "complete") {
        return accountText("资料完整", locale);
    }
    if (state.status === "missing") {
        return accountText("资料未创建", locale);
    }
    return accountText("资料待补全", locale);
}
function profileMissingFieldLabel(value: string, locale = "en-US") {
    const labels: Record<string, string> = {
        billingAddress: accountText("账单地址", locale),
        email: accountText("邮箱", locale),
        fiscalCode: accountText("税号", locale),
        name: accountText("名称", locale),
        phone: accountText("电话", locale),
        profile: accountText("资料", locale),
        shippingAddress: accountText("配送地址", locale),
    };
    return labels[value] ?? value;
}
function customerStatusLabel(value: string, locale = "en-US") {
    if (value === "active") {
        return accountText("活跃", locale);
    }
    if (value === "suspended") {
        return accountText("已暂停", locale);
    }
    return accountText("待处理", locale);
}
function customerTypeLabel(value: string, locale = "en-US") {
    return value === "wholesale" ? accountText("批发客户", locale) : accountText("零售价客户", locale);
}
function assignmentStatusLabel(value: string, locale = "en-US") {
    const labels: Record<string, string> = {
        archived: accountText("已归档", locale),
        assigned: accountText("已启用", locale),
        converted_to_employee: accountText("已转员工", locale),
        needs_review: accountText("待审核", locale),
    };
    return labels[value] ?? value;
}
function orderStatusLabel(value: string, locale = "en-US") {
    const labels: Record<string, string> = {
        accepted: accountText("已接单", locale),
        cancelled: accountText("已取消", locale),
        completed: accountText("已完成", locale),
        packed: accountText("已打包", locale),
        picking: accountText("拣货中", locale),
        shipped: accountText("已发货", locale),
        submitted: accountText("新订单", locale),
    };
    return labels[value] ?? value;
}
function paymentStatusLabel(value: string, locale = "en-US") {
    const labels: Record<string, string> = {
        authorized: accountText("待核查", locale),
        paid: accountText("已付款", locale),
        refunded: accountText("已退款", locale),
        unpaid: accountText("待收款", locale),
    };
    return labels[value] ?? value;
}
function customerLevelLabel(value: string, locale = "en-US") {
    return accountTemplate(["", ' \u00B7 每件减 ', ''], [customerLevelName(value, locale), customerLevelDiscountLabel(value)], locale);
}
function customerLevelOptionLabel(value: string, locale = "en-US") {
    return accountTemplate(["", ' \u00B7 每件减 ', ''], [customerLevelName(value, locale), customerLevelDiscountLabel(value)], locale);
}
function customerLevelDiscountLabel(value: string) {
    return formatTierDiscount(normalizeCustomerLevel(value));
}
function customerLevelName(value: string, locale = "en-US") {
    const labels: Record<CustomerLevel, string> = {
        bronze: accountText("青铜 Bronze", locale),
        silver: accountText("白银 Silver", locale),
        gold: accountText("黄金 Gold", locale),
        emerald: accountText("翡翠 Emerald", locale),
        diamond: accountText("钻石 Diamond", locale),
        master: accountText("大师 Master", locale),
        king: accountText("王者 King", locale),
    };
    return labels[normalizeCustomerLevel(value)];
}
function activePromoExpiresAt(customer: AccountCustomer) {
    if (!customer.promoLevel || !customer.promoLevelStartsAt || !customer.promoLevelExpiresAt) {
        return null;
    }
    const now = Date.now();
    const startsAt = new Date(customer.promoLevelStartsAt).getTime();
    const expiresAt = new Date(customer.promoLevelExpiresAt).getTime();
    if (!Number.isFinite(startsAt) || !Number.isFinite(expiresAt)) {
        return null;
    }
    return now >= startsAt && now < expiresAt ? customer.promoLevelExpiresAt : null;
}
function normalizeCustomerLevel(value: string): CustomerLevel {
    return customerLevels.includes(value as CustomerLevel)
        ? (value as CustomerLevel)
        : "bronze";
}
function normalizeCustomerStatus(value: string): CustomerStatus {
    return customerStatuses.includes(value as CustomerStatus)
        ? (value as CustomerStatus)
        : "pending";
}
function normalizeCustomerType(value: string): CustomerType {
    return customerTypes.includes(value as CustomerType)
        ? (value as CustomerType)
        : "retail";
}
function customerActivityLabel(event: AccountCustomerActivity, locale = "en-US") {
    const labels: Record<string, string> = {
        catalog_filter: accountText("筛选目录", locale),
        catalog_search: accountText("搜索目录", locale),
        model_view: accountText("查看机型", locale),
        order_detail_view: accountText("查看订单", locale),
        product_view: accountText("查看商品", locale),
    };
    return labels[event.eventType] ?? event.eventType;
}
function customerActivitySubject(event: AccountCustomerActivity, locale = "en-US") {
    return [
        event.searchQuery ? accountTemplate(["搜索：", ''], [event.searchQuery], locale) : null,
        event.productName,
        event.skuCode,
        event.brand,
        event.modelSeries ?? event.model,
    ]
        .filter(Boolean)
        .join(" · ") || accountText("客户前台操作", locale);
}
function memberRoleLabel(value: string, locale = "en-US") {
    const labels: Record<string, string> = {
        buyer: accountText("采购", locale),
        finance: accountText("财务", locale),
        owner: accountText("所有者", locale),
        support: accountText("售后", locale),
    };
    return labels[value] ?? value;
}
function memberStatusLabel(value: string, locale = "en-US") {
    if (value === "disabled") {
        return accountText("已停用成员关系", locale);
    }
    if (value === "invited") {
        return accountText("已邀请", locale);
    }
    return accountText("活跃", locale);
}
function roleTemplateLabel(text: AdminText, value: string | null | undefined, fallback?: string | null) {
    return adminRoleTemplateLabel(text, value, fallback);
}
function adminActionLabel(value: string, locale = "en-US") {
    const labels: Record<string, string> = {
        "account.role_update": accountText("员工角色更新", locale),
        "account.type_update": accountText("账号类型更新", locale),
        "customer.classification_update": accountText("客户分类更新", locale),
        "customer.profile_ensure": accountText("客户资料创建", locale),
        "customer.level_update": accountText("客户等级更新", locale),
        "customer.profile_update": accountText("客户档案更新", locale),
        "customer.terms_update": accountText("商业条款更新", locale),
        "employee.self_customer_ensure": accountText("员工自购资料创建", locale),
        "permissions.update": accountText("权限覆盖更新", locale),
    };
    return labels[value] ?? value;
}
function accountTypeBadgeClass(value: string) {
    return value === "employee"
        ? "border-indigo-200 bg-indigo-50 text-indigo-700"
        : "border-blue-200 bg-blue-50 text-blue-700";
}
function profileStateBadgeClass(value: AccountProfileState["status"]) {
    if (value === "complete") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (value === "missing") {
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
    return "border-amber-200 bg-amber-50 text-amber-700";
}
function customerStatusBadgeClass(value: string) {
    if (value === "active") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (value === "suspended") {
        return "border-red-200 bg-red-50 text-red-700";
    }
    return "border-amber-200 bg-amber-50 text-amber-700";
}
function orderStatusBadgeClass(value: string) {
    if (value === "completed" || value === "shipped") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (value === "cancelled") {
        return "border-red-200 bg-red-50 text-red-700";
    }
    if (value === "packed" || value === "picking") {
        return "border-blue-200 bg-blue-50 text-blue-700";
    }
    return "border-amber-200 bg-amber-50 text-amber-700";
}
function paymentStatusBadgeClass(value: string) {
    if (value === "paid") {
        return "border-emerald-200 bg-emerald-50 text-emerald-700";
    }
    if (value === "refunded") {
        return "border-slate-200 bg-slate-50 text-slate-600";
    }
    if (value === "authorized") {
        return "border-blue-200 bg-blue-50 text-blue-700";
    }
    return "border-amber-200 bg-amber-50 text-amber-700";
}
function memberStatusBadgeClass(value: string) {
    if (value === "disabled") {
        return "border-slate-200 bg-slate-50 text-slate-500";
    }
    if (value === "invited") {
        return "border-amber-200 bg-amber-50 text-amber-700";
    }
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
}
function initials(account: Pick<Account, "displayName" | "email">) {
    const value = account.displayName ?? account.email ?? "A";
    return value.slice(0, 2).toUpperCase();
}
function formatDate(value: string | null | undefined, locale: string) {
    if (!value) {
        return null;
    }
    return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
    }).format(new Date(value));
}
function formatDateTime(value: string | null | undefined, locale: string) {
    if (!value) {
        return null;
    }
    return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        month: "2-digit",
        year: "2-digit",
    }).format(new Date(value));
}
function readableError(error: unknown, locale = "en-US") {
    return error instanceof Error ? error.message : accountText("操作失败，请稍后重试。", locale);
}
function readArray(value: unknown): unknown[] {
    return Array.isArray(value) ? value : [];
}
function readString(value: unknown) {
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
function readNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isDefined<T>(value: T | null | undefined): value is T {
    return value !== null && value !== undefined;
}
