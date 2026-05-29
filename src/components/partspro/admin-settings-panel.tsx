"use client";

import { ShieldCheck, UsersRound } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminAccountsPanel } from "./admin-accounts-panel";
import { AdminPermissionsPanel } from "./admin-permissions-panel";

export function AdminSettingsPanel() {
  return (
    <section className="min-w-0 space-y-4 text-slate-950">
      <div className="min-w-0">
        <h2 className="text-2xl font-black tracking-normal">后台设置</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          管理登录账号、员工角色和后台权限矩阵。
        </p>
      </div>
      <Tabs defaultValue="accounts" className="min-w-0 space-y-4">
        <TabsList className="grid h-auto w-full rounded-lg border border-slate-200 bg-white p-1 sm:w-[420px] sm:grid-cols-2">
          <TabsTrigger
            value="accounts"
            className="h-9 gap-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <UsersRound className="size-4" />
            账号管理
          </TabsTrigger>
          <TabsTrigger
            value="permissions"
            className="h-9 gap-2 rounded-md text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-white"
          >
            <ShieldCheck className="size-4" />
            权限矩阵
          </TabsTrigger>
        </TabsList>
        <TabsContent value="accounts" className="mt-0 min-w-0">
          <AdminAccountsPanel />
        </TabsContent>
        <TabsContent value="permissions" className="mt-0 min-w-0">
          <AdminPermissionsPanel embedded />
        </TabsContent>
      </Tabs>
    </section>
  );
}
