# P1-2026-07-20-catalog-department-navigation

状态：closed

看板目录：done

优先级：P1

Task ID：TASK-20260720-01

风险等级：R2

自治等级：L3

## 老板原始目标

“去掉仅看有货；1 级、2 级菜单可以点击并直接显示全部子系列；三星、苹果等移动到 2 级菜单，新增手机、平板、电脑 1 级菜单；REMAX 放在百货系列。开始按照计划执行，完成后推送并应用 migration。”

## 目标

建立“业务大类 → 品牌 → 系列 → 型号”的四级目录，父级均可直接筛选全部后代商品，并在默认目录中展示全部商品而非仅有货商品。

## 业务影响

改善客户在移动端和桌面端查找配件的路径；为手机、平板、电脑和百货建立稳定的数据归属；避免 REMAX 与设备品牌混排，同时保持旧目录链接兼容。

## 完成定义

代码、数据库 migration、后台商品写入契约和中意文案一起完成；lint/build 通过；linked Supabase migration 已安全应用；main 已推送；线上目录完成 smoke test。

## 主责部门

商品目录部

## 协作部门

采购到货部、平台发布部、文档审计部

## 工程守门代理

PartsPro 业务契约代理、前端体验代理、Next.js 16 App Router 代理、Supabase Migration 守门代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 商品目录部 |
| Approver | 老板（已明确授权执行、应用 migration、推送 main） |
| Consulted | 前端体验、采购到货、业务契约、Migration 守门 |
| Informed | 平台发布、文档审计 |

## 涉及范围

- 页面：`/`、`/catalogo`、移动目录抽屉、后台商品编辑
- API：`/api/catalogo`、后台商品新增/更新 API
- 数据表/RPC：`public.products`、公开目录 views、后台商品 RPC、REMAX 写入保护
- 文档：本任务卡
- 外部系统：linked Supabase `yiuxrjqexlfjtxxrkqvi`、GitHub main、Vercel production

## 已知事实

- 现有 `products.category` 表示屏幕、电池等配件类型，不能复用为手机/平板/电脑大类。
- 执行前盘点 active REMAX 为 58 个，其余品牌均归入手机目录；当前没有可可靠自动识别的平板/电脑商品。上线验收时 active REMAX 为 57 个，属于并发商品状态变化，不是 migration 数据丢失。
- 当前目录默认 `minStock=1`，且品牌/系列文字只展开、不筛选。

## 假设与未知项

- 现有非 REMAX 商品迁移为“手机”；“平板”“电脑”先建立空目录，后续由后台建档时明确归类。
- 旧链接中显式 `minStock=1` 继续有效，但新目录默认显示全部库存状态。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 商品目录部 | `catalog_department` 数据契约与回填 | 远端只读盘点 | migration review 通过 |
| WP-02 | 前端体验代理 | 四级目录、父级点击、移动端关闭行为 | WP-01 view 契约 | 交互与响应式验收 |
| WP-03 | PartsPro 业务契约代理 | API、repository、后台写入一致性 | WP-01 | 类型、DTO、RPC 一致 |
| WP-04 | Supabase Migration 守门代理 | history/dry-run 等价检查、应用后验证 | lint/build | linked migration 唯一且已应用 |
| WP-05 | 平台发布部 | scoped commit、push main、production smoke | WP-01 至 WP-04 | 远端 main 与线上验收完成 |

## 批准要求

- 是否需要老板批准：已批准执行、migration 应用及推送 main
- 是否需要 Supabase migration 安全门：是
- 是否需要 Vercel 发布门：是
- 是否需要 PartsPro 业务契约验收：是

## 验收标准

- “仅看有货”入口消失，默认目录不带库存下限。
- 手机、平板、电脑、百货系列均为一级入口；品牌位于二级；系列和型号分别位于三级、四级。
- 一级、二级、三级文字均可直接显示全部后代商品；箭头只负责展开/收起。
- Apple、Samsung 等现有设备品牌位于手机；REMAX 位于百货系列并可见。
- 桌面和移动端 URL/API 筛选行为一致，旧 `minStock=1` 链接仍兼容。
- 后台新增/更新及 REMAX 导入不会写出错误的大类。
- migration、lint、build、production smoke 均有证据。

## 禁止事项

- 不复用或改写现有配件类型 `category` 的业务语义。
- 不删除无库存商品，不把库存状态写入分类字段。
- 不夹带旧 pending migration，不覆盖工作区无关未跟踪文件。
- 不在 migration 未验证前用部署掩盖数据库契约缺失。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

若本机 Supabase CLI 无 access token，则以已连接的 Supabase 官方 MCP 对同一 project ref 执行 migration history 对比、单 migration apply 和应用后查询，记录降级原因及证据。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | tracked diff、任务卡和新 migration 均无空白错误 |
| `npm run lint` | pass | 全量 ESLint exit 0 |
| `npx tsc --noEmit --pretty false` | pass | TypeScript exit 0 |
| `npm run build` | pass | Next.js 16.2.6 production build，18/18 static pages，exit 0 |
| migration history / single pending gate | pass | 应用前 remote 99 / local 100，唯一 pending 为本任务；CLI dry-run 仅因缺少 access token 无法认证 |
| linked apply + SQL smoke | pass | `20260720202358_catalog_department_navigation` 已应用；local/remote 均 100；invalid=0；REMAX 74/74 属于百货；view/ACL/trigger/RPC 均通过；公开 REST 200 |
| 本地桌面/移动 smoke | pass | 父级筛选、独立箭头、REMAX 百货、手机抽屉自动关闭、URL 和无 `minStock` 均通过；console error/warn 为空 |
| main push + production smoke | pass | 功能提交 `e4f18f5` 已推送 `main`；Vercel production `dpl_4tTmcL2cr9Qo3SR2ZJEzp7ygmg4M` 为 `READY` 并绑定 `www.partspro.app`；正式站桌面/移动目录 smoke 通过；近 30 分钟无 runtime error 或 5xx |

## 执行记录

- 创建：2026-07-20
- 批准：2026-07-20，老板明确要求开始执行、完成后推送并应用 migration
- 开始：2026-07-20
- review：2026-07-20，业务契约、前端体验、Next.js 和 migration 守门完成
- verified：2026-07-20，lint/type/build、linked SQL/REST smoke、桌面及移动浏览器 smoke 全部通过
- released：2026-07-20，Supabase migration 已应用，GitHub main 已推送，Vercel production READY
- closed：2026-07-20，正式域名桌面/移动 smoke 及运行时错误检查通过

## 结果

已完成“业务大类 → 品牌 → 系列 → 型号”四级目录、父级直接筛选、独立展开箭头、默认展示全部库存状态、REMAX 百货归类，以及前台/API/后台/数据库契约同步。migration、main push、Vercel production 与正式域名 smoke 均已完成。

残余风险：平板和电脑目录当前为空，需要后续建档或后台编辑时显式归类；Apple 等缺少可靠系列字段的数据不会伪造系列，而是从品牌直接展示型号。
