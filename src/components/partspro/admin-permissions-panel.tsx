"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
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
import { cn } from "@/lib/utils";

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

export function AdminPermissionsPanel() {
  const [employees, setEmployees] = React.useState<EmployeeAccount[]>([]);
  const [permissions, setPermissions] = React.useState<AdminPermission[]>([]);
  const [roleTemplates, setRoleTemplates] = React.useState<RoleTemplate[]>([]);
  const [overrides, setOverrides] = React.useState<PermissionOverride[]>([]);
  const [selectedUserId, setSelectedUserId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<Notice | null>(null);

  const refreshData = React.useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);

    try {
      const [permissionsResult, employeesResult] = await Promise.all([
        fetchPermissions(signal),
        fetchEmployees(signal),
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
        message: "权限配置已从 Supabase 同步。",
        tone: "success",
      });
    } catch (error) {
      if (!signal?.aborted) {
        setNotice({
          message: readableError(error),
          tone: "error",
        });
      }
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

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
        employee.userId,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [employees, query]);
  const selectedEmployee =
    employees.find((employee) => employee.userId === selectedUserId) ??
    filteredEmployees[0] ??
    null;
  const selectedRole =
    roleTemplates.find((roleTemplate) => roleTemplate.id === selectedEmployee?.roleTemplate) ??
    roleTemplates.find((roleTemplate) => roleTemplate.id === "sales_support") ??
    roleTemplates[0] ??
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
  const permissionGroups = React.useMemo(() => groupPermissions(permissions), [permissions]);

  async function updateRoleTemplate(roleTemplate: string) {
    if (!selectedEmployee || selectedEmployee.roleTemplate === roleTemplate) {
      return;
    }

    setPendingKey(`role:${selectedEmployee.userId}`);

    try {
      await patchPermissions({
        roleTemplate,
        userId: selectedEmployee.userId,
      });
      setEmployees((current) =>
        current.map((employee) =>
          employee.userId === selectedEmployee.userId
            ? { ...employee, roleTemplate }
            : employee
        )
      );
      setNotice({
        message: "角色模板已保存。",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: readableError(error),
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
      const result = await patchPermissions({
        overrides: [{ effect, permissionId }],
        userId: selectedEmployee.userId,
      });
      setOverrides((current) => [
        ...current.filter((override) => override.userId !== selectedEmployee.userId),
        ...result.overrides,
      ]);
      setNotice({
        message: "单项权限覆盖已保存。",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: readableError(error),
        tone: "error",
      });
    } finally {
      setPendingKey(null);
    }
  }

  return (
    <section className="min-w-0 space-y-4 text-slate-950">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-normal">权限设置</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            员工后台功能由角色模板决定，再用单项覆盖做例外控制。
          </p>
        </div>
        <Button
          variant="outline"
          className="bg-white"
          disabled={isLoading}
          onClick={() => void refreshData()}
        >
          <RefreshCcw className={cn("size-4", isLoading && "animate-spin")} />
          同步
        </Button>
      </div>

      {notice && <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="border-slate-200 bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCog className="size-5 text-primary" />
              员工
            </CardTitle>
            <CardDescription>仅显示客户管理中标记为 staff 的账号。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="bg-white pl-9"
                placeholder="搜索邮箱、姓名或角色"
              />
            </div>
            <div className="grid max-h-[560px] gap-2 overflow-y-auto pr-1">
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <button
                    key={employee.userId}
                    type="button"
                    className={cn(
                      "min-w-0 rounded-lg border p-3 text-left transition",
                      employee.userId === selectedEmployee?.userId
                        ? "border-primary/30 bg-primary/8"
                        : "border-slate-200 bg-white hover:border-primary/30"
                    )}
                    onClick={() => setSelectedUserId(employee.userId)}
                  >
                    <div className="truncate text-sm font-black">
                      {employee.displayName ?? employee.email ?? "Staff"}
                    </div>
                    <div className="mt-1 truncate text-xs font-medium text-slate-500">
                      {employee.email ?? employee.userId}
                    </div>
                    <Badge variant="outline" className="mt-2 bg-white">
                      {employee.roleTemplate ?? "未设置"}
                    </Badge>
                  </button>
                ))
              ) : (
                <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                  暂无员工账号。
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 border-slate-200 bg-white">
          <CardHeader className="gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-primary" />
                权限矩阵
              </CardTitle>
              <CardDescription>
                {selectedEmployee
                  ? selectedEmployee.email ?? selectedEmployee.userId
                  : "选择一个员工后编辑权限。"}
              </CardDescription>
            </div>
            {selectedEmployee && (
              <Select
                value={selectedRole?.id ?? ""}
                onValueChange={(value) => void updateRoleTemplate(value)}
                disabled={pendingKey?.startsWith("role:")}
              >
                <SelectTrigger className="w-full bg-white lg:w-64">
                  <SelectValue placeholder="选择角色模板" />
                </SelectTrigger>
                <SelectContent>
                  {roleTemplates.map((roleTemplate) => (
                    <SelectItem key={roleTemplate.id} value={roleTemplate.id}>
                      {roleTemplate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardHeader>
          <CardContent className="min-w-0 space-y-4">
            {selectedRole && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                <span className="font-black text-slate-900">{selectedRole.label}</span>
                {selectedRole.description ? `：${selectedRole.description}` : ""}
              </div>
            )}

            {selectedEmployee ? (
              permissionGroups.map(([groupName, items]) => (
                <div key={groupName} className="min-w-0 rounded-lg border border-slate-200">
                  <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black uppercase text-slate-600">
                    {groupName}
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
                                {effectiveAllowed ? "允许" : "关闭"}
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
                                className={overrideEffect === effect ? "" : "bg-white"}
                                disabled={pendingKey === `permission:${permission.id}`}
                                onClick={() => void updateOverride(permission.id, effect)}
                              >
                                {effectLabel(effect)}
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
                选择员工后显示权限矩阵。
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

async function fetchPermissions(signal?: AbortSignal): Promise<PermissionsPayload> {
  const response = await fetch("/api/admin/permissions", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/permissions 返回 ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("/api/admin/permissions 返回格式不完整");
  }

  return {
    overrides: readArray(payload.data.overrides).map(normalizeOverride).filter(isDefined),
    permissions: readArray(payload.data.permissions).map(normalizePermission).filter(isDefined),
    roleTemplates: readArray(payload.data.roleTemplates)
      .map(normalizeRoleTemplate)
      .filter(isDefined),
  };
}

async function fetchEmployees(signal?: AbortSignal): Promise<EmployeeAccount[]> {
  const response = await fetch("/api/admin/accounts?accountType=employee&limit=100", {
    cache: "no-store",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new Error(`GET /api/admin/accounts 返回 ${response.status}`);
  }

  const payload = (await response.json()) as unknown;

  if (!isRecord(payload)) {
    throw new Error("/api/admin/accounts 返回格式不完整");
  }

  return readArray(payload.data).map(normalizeEmployee).filter(isDefined);
}

async function patchPermissions(input: {
  overrides?: Array<{ effect: PermissionEffect; permissionId: string }>;
  roleTemplate?: string;
  userId: string;
}) {
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
    throw new Error(`PATCH /api/admin/permissions 返回 ${response.status}`);
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

function NoticeBanner({
  notice,
  onDismiss,
}: {
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
        OK
      </Button>
    </div>
  );
}

function effectLabel(effect: PermissionEffect) {
  if (effect === "grant") {
    return "允许";
  }

  if (effect === "deny") {
    return "拒绝";
  }

  return "继承";
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

function readableError(error: unknown) {
  return error instanceof Error ? error.message : "操作失败，请稍后重试。";
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
