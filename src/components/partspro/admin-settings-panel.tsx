"use client";

import { ShieldCheck } from "lucide-react";
import { AdminPermissionsPanel } from "./admin-permissions-panel";

export function AdminSettingsPanel() {
  return (
    <section className="min-w-0 space-y-4 text-slate-950">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-5 shrink-0 text-primary" />
          <h2 className="truncate text-2xl font-black tracking-normal">
            后台设置
          </h2>
        </div>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          管理员工角色和后台权限矩阵。
        </p>
      </div>
      <AdminPermissionsPanel embedded />
    </section>
  );
}
