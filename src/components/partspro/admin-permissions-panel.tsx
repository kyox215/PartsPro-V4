"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  KeyRound,
  RefreshCcw,
  Search,
  ShieldCheck,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  adminPermissionDescription,
  adminPermissionGroupLabel,
  adminPermissionLabel,
  adminRoleTemplateDescription,
  adminRoleTemplateLabel,
  formatAdminMessage,
  getAdminDictionary,
  type AdminText,
} from "@/i18n/dictionaries/admin";
import { CUSTOMER_MANAGE_LEVEL_PERMISSION } from "@/lib/partspro-permissions";
import { cn } from "@/lib/utils";
import { AdminBusyRegion, AdminInlinePending } from "./admin-feedback";
import { useI18n } from "./i18n-provider";

type PermissionEffect = "grant" | "deny" | "inherit";

type AdminPermission = {
  description: string | null;
  groupName: string;
  id: string;
  label: string;
};

type RoleTemplate = {
  description: string | null;
  id: string;
  label: string;
  permissions: string[];
};

type PermissionOverride = {
  effect: Exclude<PermissionEffect, "inherit">;
  permissionId: string;
  userId: string;
};

type EmployeeAccount = {
  accountType: string;
  displayName: string | null;
  email: string | null;
  roleTemplate: string | null;
  userId: string;
};

type PermissionsPayload = {
  overrides: PermissionOverride[];
  permissions: AdminPermission[];
  roleTemplates: RoleTemplate[];
};

type Notice = {
  message: string;
  tone: "success" | "warning" | "error";
};

export function AdminPermissionsPanel({ embedded = false }: { embedded?: boolean }) {
  const { locale } = useI18n();
  const text = getAdminDictionary(locale).admin;
  const copy = text.permissions;
  const [employees, setEmployees] = React.useState<EmployeeAccount[]>([]);
  const [permissions, setPermissions] = React.useState<AdminPermission[]>([]);
  const [roleTemplates, setRoleTemplates] = React.useState<RoleTemplate[]>([]);
  const [overrides, setOverrides] = React.useState<PermissionOverride[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [permissionQuery, setPermissionQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);

  const refreshData = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);

    try {
      const [permissionsResult, employeesResult] = await Promise.all([
        fetchPermissions(copy, signal),
        fetchEmployees(copy, signal),
      ]);

      if (signal?.aborted) {
        return;
      }

      setPermissions(permissionsResult.permissions);
      setRoleTemplates(permissionsResult.roleTemplates);
      setOverrides(permissionsResult.overrides);
      setEmployees(employeesResult);
      setSelectedUserId((current) =>
        employeesResult.some((employee) => employee.userId === current)
          ? current
          : employeesResult[0]?.userId ?? ""
      );
      setNotice({
        message: copy.syncSuccess,
        tone: "success",
      });
    } catch (error) {
      if (!signal?.aborted) {
        setNotice({
          message: readableError(error, copy),
          tone: "error",
        });
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, [copy]);

  React.useEffect(() => {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      void refreshData(controller.signal);
    }, 0);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [refreshData]);

  const filteredEmployees = React.useMemo(() => {
    const value = query.trim().toLowerCase();

    if (!value) {
      return employees;
    }

    return employees.filter((employee) =>
      [
        employee.email,
        employee.displayName,
        employee.roleTemplate,
        adminRoleTemplateLabel(text, employee.roleTemplate, ""),
        employee.userId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [employees, query, text]);
  const localizedRoleTemplates = React.useMemo(
    () =>
      roleTemplates.map((roleTemplate) => ({
        ...roleTemplate,
        description: adminRoleTemplateDescription(
          text,
          roleTemplate.id,
          roleTemplate.description
        ),
        label: adminRoleTemplateLabel(text, roleTemplate.id, roleTemplate.label),
      })),
    [roleTemplates, text]
  );
  const localizedPermissions = React.useMemo(
    () =>
      permissions.map((permission) => ({
        ...permission,
        description: adminPermissionDescription(
          text,
          permission.id,
          permission.description
        ),
        label: adminPermissionLabel(text, permission.id, permission.label),
      })),
    [permissions, text]
  );
  const selectedEmployee =
    employees.find((employee) => employee.userId === selectedUserId) ??
    filteredEmployees[0] ??
    null;
  const selectedRole =
    localizedRoleTemplates.find((roleTemplate) => roleTemplate.id === selectedEmployee?.roleTemplate) ??
    localizedRoleTemplates.find((roleTemplate) => roleTemplate.id === "sales_support") ??
    localizedRoleTemplates[0] ??
    null;
  const selectedOverrideMap = React.useMemo(() => {
    const map = new Map<string, PermissionOverride["effect"]>();

    for (const override of overrides) {
      if (override.userId === selectedEmployee?.userId) {
        map.set(override.permissionId, override.effect);
      }
    }

    return map;
  }, [overrides, selectedEmployee?.userId]);
  const permissionGroups = React.useMemo(
    () => groupPermissions(localizedPermissions),
    [localizedPermissions]
  );
  const filteredPermissionGroups = React.useMemo(
    () => filterPermissionGroups(permissionGroups, permissionQuery, text),
    [permissionGroups, permissionQuery, text]
  );
  const customerLevelPermission = localizedPermissions.find(
    (permission) => permission.id === CUSTOMER_MANAGE_LEVEL_PERMISSION
  );
  const customerLevelRoleAllows = Boolean(
    selectedRole?.permissions.includes(CUSTOMER_MANAGE_LEVEL_PERMISSION)
  );
  const customerLevelOverride =
    selectedOverrideMap.get(CUSTOMER_MANAGE_LEVEL_PERMISSION) ?? "inherit";
  const customerLevelAllowed =
    customerLevelOverride === "grant" ||
    (customerLevelOverride === "inherit" && customerLevelRoleAllows);

  async function updateRoleTemplate(roleTemplate: string) {
    if (!selectedEmployee || selectedEmployee.roleTemplate === roleTemplate) {
      return;
    }

    setPendingKey(`role:${selectedEmployee.userId}`);

    try {
      await patchPermissions(
        {
          reason: `Role template changed to ${roleTemplate}.`,
          roleTemplate,
          userId: selectedEmployee.userId,
        },
        copy
      );
      setEmployees((current) =>
        current.map((employee) =>
          employee.userId === selectedEmployee.userId
            ? { ...employee, roleTemplate }
            : employee
        )
      );
      setNotice({
        message: copy.roleSaved,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: readableError(error, copy),
        tone: "error",
      });
    } finally {
      setPendingKey(null);
    }
  }

  async function updateOverride(permissionId: string, effect: PermissionEffect) {
    if (!selectedEmployee) {
      return;
    }

    setPendingKey(`permission:${permissionId}`);

    try {
      const result = await patchPermissions(
        {
          overrides: [{ effect, permissionId }],
          reason: `Permission override ${permissionId} set to ${effect}.`,
          userId: selectedEmployee.userId,
        },
        copy
      );
      setOverrides((current) => [
        ...current.filter((override) => override.userId !== selectedEmployee.userId),
        ...result.overrides,
      ]);
      setNotice({
        message: copy.updateSaved,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: readableError(error, copy),
        tone: "error",
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="min-w-0 space-y-4 text-slate-950">
      <div
        className={cn(
          "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
          embedded && "sr-only"
        )}
      >
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-normal">{copy.title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            {copy.description}
          </p>
        </div>
        <Button
          variant="outline"
          className="bg-white"
          disabled={isLoading}
          onClick={() => void refreshData()}
        >
          <RefreshCcw className={cn("size-4", isLoading && "animate-spin")} />
          {copy.sync}
        </Button>
      </div>

      {notice && <NoticeBanner copy={copy} notice={notice} onDismiss={() => setNotice(null)} />}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              {copy.employees}
            </CardTitle>
            <CardDescription>{copy.employeeListDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="bg-white pl-9"
                placeholder={copy.employeeSearchPlaceholder}
              />
            </div>
            <div className="grid max-h-[560px] gap-2 overflow-y-auto pr-1">
              <AdminBusyRegion
                contentClassName="grid gap-2"
                label={text.common.refreshing}
                pending={isLoading}
                rows={4}
              >
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((employee) => (
                    <button
                      key={employee.userId}
                      type="button"
                      className={cn(
                        "min-w-0 rounded-lg border p-3 text-left transition active:scale-[0.99]",
                        employee.userId === selectedEmployee?.userId
                          ? "border-primary/30 bg-primary/8"
                          : "border-slate-200 bg-white hover:border-primary/30"
                      )}
                      aria-label={formatAdminMessage(copy.employeeSelectAria, {
                        name: employee.displayName ?? employee.email ?? employee.userId,
                      })}
                      onClick={() => setSelectedUserId(employee.userId)}
                    >
                      <div className="truncate text-sm font-black">
                        {employee.displayName ?? employee.email ?? copy.employees}
                      </div>
                      <div className="mt-1 truncate text-xs font-medium text-slate-500">
                        {employee.email ?? employee.userId}
                      </div>
                      <Badge variant="outline" className="mt-2 bg-white">
                        {adminRoleTemplateLabel(text, employee.roleTemplate)}
                      </Badge>
                    </button>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                    {copy.employeeEmpty}
                  </div>
                )}
              </AdminBusyRegion>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200 bg-white">
          <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                {copy.title}
              </CardTitle>
              <CardDescription>
                {selectedEmployee
                  ? selectedEmployee.email ?? selectedEmployee.userId
                  : copy.userRequired}
              </CardDescription>
              <AdminInlinePending
                label={pendingKey?.startsWith("role:") ? text.common.saving : text.common.refreshing}
                pending={Boolean(pendingKey?.startsWith("role:"))}
              />
            </div>
            {selectedEmployee && (
              <Select
                value={selectedRole?.id ?? ""}
                onValueChange={(value) => void updateRoleTemplate(value)}
                disabled={pendingKey?.startsWith("role:")}
              >
                <SelectTrigger className="w-full bg-white lg:w-64" aria-label={copy.roleSelectLabel}>
                  <SelectValue placeholder={copy.roleSelectPlaceholder} />
                </SelectTrigger>
                <SelectContent>
                  {localizedRoleTemplates.map((roleTemplate) => (
                    <SelectItem key={roleTemplate.id} value={roleTemplate.id}>
                      {roleTemplate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            <AdminBusyRegion
              contentClassName="min-w-0 space-y-4"
              label={isLoading ? text.common.refreshing : text.common.saving}
              pending={isLoading}
              rows={5}
            >
            {selectedRole && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                <span className="font-black text-slate-900">{selectedRole.label}</span>
                {selectedRole.description ? `：${selectedRole.description}` : ""}
              </div>
            )}

            {selectedEmployee ? (
              <>
                {customerLevelPermission && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <KeyRound className="size-4 text-primary" />
                          <span className="break-words text-sm font-black text-slate-950">
                            {customerLevelPermission.label}
                          </span>
                          <Badge
                            className={cn(
                              "border",
                              customerLevelAllowed
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-600"
                            )}
                          >
                            {customerLevelAllowed ? copy.customerLevelOpen : copy.customerLevelClosed}
                          </Badge>
                        </div>
                        <div className="mt-1 break-words font-mono text-xs text-slate-500">
                          {CUSTOMER_MANAGE_LEVEL_PERMISSION}
                        </div>
                        {customerLevelPermission.description && (
                          <p className="mt-1 text-xs leading-5 text-slate-600">
                            {customerLevelPermission.description}
                          </p>
                        )}
                      </div>
                      <div className="grid shrink-0 grid-cols-3 gap-2 lg:w-[300px]">
                        {(["inherit", "grant", "deny"] as const).map((effect) => (
                          <Button
                            key={effect}
                            size="sm"
                            variant={customerLevelOverride === effect ? "default" : "outline"}
                            className={cn(
                              customerLevelOverride === effect ? "" : "bg-white",
                              pendingKey ===
                                `permission:${CUSTOMER_MANAGE_LEVEL_PERMISSION}` &&
                                "ring-2 ring-primary/15"
                            )}
                            disabled={
                              pendingKey ===
                              `permission:${CUSTOMER_MANAGE_LEVEL_PERMISSION}`
                            }
                            onClick={() =>
                              void updateOverride(CUSTOMER_MANAGE_LEVEL_PERMISSION, effect)
                            }
                          >
                            {effectLabel(effect, copy)}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={permissionQuery}
                    onChange={(event) => setPermissionQuery(event.target.value)}
                    className="bg-white pl-9"
                    placeholder={copy.matrixSearchPlaceholder}
                  />
                </div>

                {filteredPermissionGroups.length > 0 ? (
                  filteredPermissionGroups.map(([groupName, items]) => (
                    <div key={groupName} className="min-w-0 rounded-lg border border-slate-200">
                      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-600">
                        {groupLabel(text, groupName)}
                      </div>
                      <div className="divide-y divide-slate-100">
                        {items.map((permission) => {
                          const roleAllows = Boolean(
                            selectedRole?.permissions.includes(permission.id)
                          );
                          const overrideEffect =
                            selectedOverrideMap.get(permission.id) ?? "inherit";
                          const effectiveAllowed =
                            overrideEffect === "grant" ||
                            (overrideEffect === "inherit" && roleAllows);

                          return (
                            <div
                              key={permission.id}
                              className="grid min-w-0 gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_300px]"
                            >
                              <div className="min-w-0">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                  <span className="break-words text-sm font-black text-slate-900">
                                    {permission.label}
                                  </span>
                                  <Badge
                                    className={cn(
                                      "border",
                                      effectiveAllowed
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                        : "border-slate-200 bg-slate-50 text-slate-600"
                                    )}
                                  >
                                    {effectiveAllowed ? copy.permissionOpen : copy.permissionClosed}
                                  </Badge>
                                </div>
                                <div className="mt-1 break-words font-mono text-xs text-slate-400">
                                  {permission.id}
                                </div>
                                {permission.description && (
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    {permission.description}
                                  </p>
                                )}
                              </div>
                              <div className="grid grid-cols-3 gap-2 self-center">
                                {(["inherit", "grant", "deny"] as const).map((effect) => (
                                  <Button
                                    key={effect}
                                    size="sm"
                                    variant={overrideEffect === effect ? "default" : "outline"}
                                    className={cn(
                                      overrideEffect === effect ? "" : "bg-white",
                                      pendingKey === `permission:${permission.id}` &&
                                        "ring-2 ring-primary/15"
                                    )}
                                    disabled={pendingKey === `permission:${permission.id}`}
                                    onClick={() => void updateOverride(permission.id, effect)}
                                  >
                                    {effectLabel(effect, copy)}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                    {copy.noPermissionMatches}
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                {copy.matrixEmpty}
              </div>
            )}
            </AdminBusyRegion>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

async function fetchPermissions(
  copy: AdminText["permissions"],
  signal?: AbortSignal
): Promise<PermissionsPayload> {
  const response = await fetch("/api/admin/permissions", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      formatAdminMessage(copy.permissionsRequestFailed, { status: response.status })
    );
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error(copy.permissionsIncomplete);
  }

  return {
    overrides: readArray(payload.data.overrides).map(normalizeOverride).filter(isDefined),
    permissions: readArray(payload.data.permissions).map(normalizePermission).filter(isDefined),
    roleTemplates: readArray(payload.data.roleTemplates)
      .map(normalizeRoleTemplate)
      .filter(isDefined),
  };
}

async function fetchEmployees(
  copy: AdminText["permissions"],
  signal?: AbortSignal
): Promise<EmployeeAccount[]> {
  const response = await fetch("/api/admin/accounts?accountType=employee&limit=100", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(
      formatAdminMessage(copy.accountsRequestFailed, { status: response.status })
    );
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload)) {
    throw new Error(copy.accountsIncomplete);
  }

  return readArray(payload.data).map(normalizeEmployee).filter(isDefined);
}

async function patchPermissions(
  input: {
    overrides?: Array<{ effect: PermissionEffect; permissionId: string }>;
    reason: string;
    roleTemplate?: string;
    userId: string;
  },
  copy: AdminText["permissions"]
) {
  const response = await fetch("/api/admin/permissions", {
    body: JSON.stringify(input),
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    method: "PATCH",
  });

  if (!response.ok) {
    throw new Error(
      formatAdminMessage(copy.patchRequestFailed, { status: response.status })
    );
  }

  const payload = (await response.json()) as unknown;
  const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};

  return {
    overrides: readArray(data.overrides).map(normalizeOverride).filter(isDefined),
  };
}

function groupPermissions(permissions: AdminPermission[]) {
  const groups = new Map<string, AdminPermission[]>();

  for (const permission of permissions) {
    const current = groups.get(permission.groupName) ?? [];
    current.push(permission);
    groups.set(permission.groupName, current);
  }

  return [...groups.entries()];
}

function filterPermissionGroups(
  groups: Array<[string, AdminPermission[]]>,
  query: string,
  text: AdminText
) {
  const value = query.trim().toLowerCase();

  if (!value) {
    return groups;
  }

  return groups
    .map(
      ([groupName, items]) =>
        [
          groupName,
          items.filter((permission) =>
            [
              permission.id,
              permission.label,
              permission.description,
              permission.groupName,
              groupLabel(text, permission.groupName),
            ]
              .join(" ")
              .toLowerCase()
              .includes(value)
          ),
        ] as [string, AdminPermission[]]
    )
    .filter(([, items]) => items.length > 0);
}

function groupLabel(text: AdminText, groupName: string) {
  return adminPermissionGroupLabel(text, groupName, groupName);
}

function NoticeBanner({
  copy,
  notice,
  onDismiss,
}: {
  copy: AdminText["permissions"];
  notice: Notice;
  onDismiss: () => void;
}) {
  const isSuccess = notice.tone === "success";

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium",
        isSuccess
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : notice.tone === "warning"
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {isSuccess ? (
        <CheckCircle2 className="size-4 shrink-0" />
      ) : (
        <AlertTriangle className="size-4 shrink-0" />
      )}
      <span className="min-w-0 flex-1 break-words">{notice.message}</span>
      <Button
        variant="ghost"
        size="xs"
        className="text-current hover:bg-white/60"
        onClick={onDismiss}
      >
        {copy.closeNotice}
      </Button>
    </div>
  );
}

function effectLabel(effect: PermissionEffect, copy: AdminText["permissions"]) {
  if (effect === "grant") {
    return copy.effectGrant;
  }

  if (effect === "deny") {
    return copy.effectDeny;
  }

  return copy.effectInherit;
}

function normalizePermission(value: unknown): AdminPermission | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);

  if (!id) {
    return null;
  }

  return {
    description: readString(value.description),
    groupName: readString(value.groupName) ?? "other",
    id,
    label: readString(value.label) ?? id,
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
    description: readString(value.description),
    id,
    label: readString(value.label) ?? id,
    permissions: readArray(value.permissions)
      .map(readString)
      .filter((permission): permission is string => Boolean(permission)),
  };
}

function normalizeOverride(value: unknown): PermissionOverride | null {
  if (!isRecord(value)) {
    return null;
  }

  const permissionId = readString(value.permissionId);
  const userId = readString(value.userId);

  if (!permissionId || !userId) {
    return null;
  }

  return {
    effect: readString(value.effect) === "deny" ? "deny" : "grant",
    permissionId,
    userId,
  };
}

function normalizeEmployee(value: unknown): EmployeeAccount | null {
  if (!isRecord(value)) {
    return null;
  }

  const userId = readString(value.userId);

  if (!userId) {
    return null;
  }

  return {
    accountType: readString(value.accountType) ?? "employee",
    displayName: readString(value.displayName),
    email: readString(value.email),
    roleTemplate: readString(value.roleTemplate),
    userId,
  };
}

function readableError(error: unknown, copy: AdminText["permissions"]) {
  return error instanceof Error ? error.message : copy.operationFailed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
