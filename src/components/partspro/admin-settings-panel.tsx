"use client";

import { ShieldCheck } from "lucide-react";
import { AdminPermissionsPanel } from "./admin-permissions-panel";

export function AdminSettingsPanel() {
  return (
    <section className="min-w-0 space-y-2 text-slate-950 sm:space-y-4">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <ShieldCheck className="size-4 shrink-0 text-primary sm:size-5" />
          <h2 className="truncate text-xl font-black tracking-normal sm:text-2xl">
            后台设置
          </h2>
        </div>
        <p className="mt-0.5 text-xs font-semibold leading-5 text-slate-500 sm:mt-1 sm:text-sm sm:font-normal sm:leading-6">
          管理员工角色和后台权限矩阵。
        </p>
      </div>
      <AdminPermissionsPanel embedded />
    </section>
  );
}
