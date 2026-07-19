# P1-2026-07-20-admin-product-catalog-simplification

状态：done

看板目录：done

优先级：P1

Task ID：TASK-20260720-03

风险等级：R2

自治等级：L3

## 老板原始目标

“查看项目的后台面板的商品管理页面，帮我重新去商品目录规划一下……让一个小白也能看得懂……尽量在手机端就能操作，电脑端也要进行适配……能不能再进行简化”以及“开始按照计划设置目标并开始进行计划，完成后推送以及应用”。

## 目标

把后台商品管理收敛为“极简商品目录 + 一页式录入/编辑 + 就地图片上传”，让新手能在手机或电脑上用最少字段完成商品建档，同时保持价格、库存、图片和发布权限的服务端边界。

## 业务影响

减少门店员工录入商品时的选择和跳转，缩短新商品建档、补图与修改资料的时间；避免无价格/成本权限的岗位在新建流程越权写入敏感字段，并保持商品、库存和发布契约一致。

## 完成定义

- 商品目录首屏只保留搜索、状态、添加商品和清晰列表，批次与横幅等高级入口降级为次要工具。
- 新建与编辑使用同一个移动端优先的一页式流程；基础路径只要求图片、分类、品牌/型号、名称、批发价、初始库存和供应商，系统自动提供安全默认值。
- 图片可在同一流程选择、预览和上传；新建商品时先建草稿再自动补图，不暴露原始存储路径给新手。
- 不同岗位只看到并提交自己有权限的价格、成本、库存和图片操作；服务端拒绝越权字段。
- 中文、意大利语、桌面端和手机端均可用；lint、TypeScript、build、浏览器验收通过。
- 只提交本任务文件，推送 `main`，Vercel 生产部署达到 READY 并完成公开路径 smoke test；仅应用本任务的最小权限 migration，不夹带其他 pending migration。

## 主责部门

商品目录部

## 协作部门

- 价格与客户部
- 仓库库存部
- 平台发布部

## 工程守门代理

- PartsPro 业务契约代理
- Next.js 16 App Router 代理
- 前端体验代理
- Vercel 发布代理
- Supabase Migration 守门代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 商品目录部 |
| Approver | 老板 |
| Consulted | 价格与客户部、仓库库存部、PartsPro 业务契约代理、前端体验代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：后台商品目录、商品新建/编辑抽屉、图片管理
- API：`/api/admin/products`、现有商品图片接口
- 数据表/RPC：复用 `products`、`inventory_items`、`admin_create_product_draft`、`admin_update_product`、`admin_adjust_product_stock`；只收紧创建 RPC 的字段权限与执行授权，不改表、不回填数据
- 文档：本任务卡
- 外部系统：Supabase Storage（复用现有图片接口）、Vercel Git 部署

## 已知事实

- 当前商品编辑抽屉有六个标签页，新建表单同时展示约二十个字段，并要求新手理解 SKU、MOQ、交期、兼容性和原始图片路径。
- 创建接口只检查 `product.create_draft`，但允许同一请求写价格、成本和初始库存；编辑接口已经按字段检查对应权限。
- 图片接口已支持 JPEG、PNG、WebP、10MB 限制和主图设置，可直接复用。
- 数据库发布守门仍要求完整商品资料；极简录入默认先保存草稿，资料不足时不应假装已可上架。
- 当前工作区有不属于本任务的重复 PWA 图标文件，必须留在提交之外。

## 假设与未知项

- 自动 SKU 使用现有草稿创建规则，不改变历史 SKU 或供应商 SKU。
- 自动值沿用当前 RPC 的业务默认：MOQ 1、仓位 Milano、VAT 为 `IVA esclusa`、保修 180 天；有价格权限时零售价按批发价的现有默认规则生成，高级人员仍可后续修改。
- 初始库存仍通过现有创建 RPC 原子记录；创建后库存调整继续走库存调整接口。
- 本任务不改变商品上架必备字段、客户价格计算或前台目录规则。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | PartsPro 业务契约代理 | 创建字段权限与草稿/发布准备度契约 | 现有角色权限、API、RPC | 无权限字段在服务端被拒绝或忽略，现有授权角色不回归 |
| WP-02 | 前端体验代理 | 极简目录与一页式移动端/桌面端表单 | WP-01 | 新手主路径清晰，无横向溢出，键盘和触控可用 |
| WP-03 | 商品目录部 | 图片选择、预览、创建后自动上传和资料补全 | WP-01、WP-02 | 新建/编辑均能在同一流程完成图片操作 |
| WP-04 | Next.js 16 App Router 代理 | Client/Route Handler 边界和错误处理复核 | WP-01、WP-03 | 认证授权在服务端，客户端仅提交允许字段 |
| WP-05 | Vercel 发布代理 | 质量门、范围化推送和生产验证 | WP-01 至 WP-04 | `main` 推送成功，生产 READY，smoke test 通过 |

## 批准要求

- 是否需要老板批准：已批准；2026-07-20 老板明确回复“批准”，同意应用本任务的生产权限 DDL
- 是否需要 Supabase migration 安全门：是；创建 RPC 的直接调用路径必须在数据库层补齐字段权限，migration 不改表、不回填数据
- 是否需要 Vercel 发布门：是
- 是否需要 PartsPro 业务契约验收：是

## 验收标准

- 手机端无需横向滚动即可搜索、筛选、打开商品、新建、编辑和上传图片。
- 桌面端保持高效列表，但不恢复复杂多标签编辑路径。
- 新建主路径的可见输入不超过七组；系统默认值清晰可解释，失败时错误贴近对应字段。
- 无价格权限的岗位不能通过创建接口写批发价/零售价，无成本权限的岗位不能写成本，无库存权限的岗位不能写初始库存。
- 图片只能通过现有受权限保护的上传接口写入，文件类型和大小限制保持不变。
- 未满足上架条件时保存为草稿并明确提示待补资料，不误导为已发布。
- 现有商品批次、横幅、导入/导出和库存调整能力仍可从次要入口访问。

## 禁止事项

- 不修改或批量回填生产商品、价格、成本、库存或图片数据。
- 不降低发布守门、RLS、Storage policy 或管理员权限要求。
- 不新增不必要的 Supabase migration。
- 不提交无关的重复 PWA 图标或其他用户改动。
- 不用前端隐藏代替服务端字段授权。

## 验证命令

```bash
git diff --check
npm run lint
npx tsc --noEmit
npm run build
```

补充验证：

```text
- API 权限回归：创建时价格、成本、库存字段按权限拒绝/放行
- 390x844 手机端：目录、新建、图片、保存、编辑
- 1440x900 桌面端：目录、新建、编辑、次要工具入口
- Vercel：目标 commit READY，公开后台入口与 API 鉴权 smoke 正常
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | 无空白错误 |
| `npm run lint` | pass | ESLint 0 error / 0 warning |
| `npx tsc --noEmit` | pass | TypeScript 通过 |
| `npm run build` | pass | Next.js 16.2.6 production build 通过 |
| browser mobile / desktop | pass | 已登录生产后台；桌面与 390×844 手机端目录、新建、编辑、中文/意大利语通过；页面与抽屉 `scrollWidth = clientWidth`，控制台 0 error；未提交表单 |
| Vercel production | pass | commit `e755281`，deployment `dpl_4i73MDuEXtkzwNoqeZUMisgA6ZUr` READY，`www.partspro.app` alias 正常 |
| production API auth smoke | pass | 未登录请求 `/api/admin/products?limit=1` 返回预期 401 `missing_session` |
| Supabase migration | pass | `PartsPro-V4` / `yiuxrjqexlfjtxxrkqvi` ACTIVE_HEALTHY；仅本任务 migration 已写入远端版本 `20260719232814`；远端 statement 与本地文件 SHA-256 均为 `657a3db633a879ff1be1d38ac707873ccb57284fccd6cf0189774236153da077`，另两份 pending migration 未应用 |
| RPC permission smoke | pass | 原始 private writer 对 `authenticated`/`anon` 均不可执行；guard 仅允许 `authenticated`/`service_role`；public wrapper 为 invoker 且 `anon` 不可执行；guard 固定 `search_path = public, pg_temp` |
| Supabase advisors | pass with baseline warnings | security 33 WARN / 0 ERROR、performance 11 WARN + 86 INFO / 0 ERROR；目标函数无新增 advisory，现有项目级告警不在本任务范围 |
| production data invariant | pass | migration statement 仅含函数、授权与注释 DDL；当前商品数 17,906，最新 `products.updated_at` 为 `2026-07-19 11:55:15.196229+00`；未创建测试商品、未回填数据 |

## 执行记录

- 创建：2026-07-20
- 批准：2026-07-20，老板要求按已确认的极简计划执行并推送应用
- 开始：2026-07-20
- review：2026-07-20，完成 React、API、RPC 权限、移动端响应式与 SQL 风险复核
- verified：2026-07-20，lint、TypeScript、build、生产桌面/手机端、双语和 API 鉴权 smoke 通过
- released：2026-07-20，`e755281` 已推送 `main`，Vercel production READY
- approved-ddl：2026-07-20，老板明确批准生产权限 DDL
- applied-db：2026-07-20，远端 migration `20260719232814_guard_admin_product_create_permissions` 已确认应用并完成权限、哈希与数据不变量核验
- closed：2026-07-20

## 结果

极简商品目录与一页式新建/编辑已上线，创建 RPC 的价格、成本、库存和图片字段权限已在生产数据库收紧。手机端、桌面端、双语、构建、API 鉴权、Supabase 权限与生产部署均通过；未触碰其他任务的 migration、审计文件、前台改动或重复 PWA 图标。
