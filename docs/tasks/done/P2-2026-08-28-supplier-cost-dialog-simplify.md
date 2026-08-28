# P2-2026-08-28-supplier-cost-dialog-simplify

状态：verified

看板目录：done

优先级：P2

Task ID：TASK-20260828-01

风险等级：R2

自治等级：L2

## 老板原始目标

简化登记运输 / 到货费用页面，让费用、计入商品成本、凭证和预览步骤更容易理解；完成后推送 main 并部署生产。

## 目标

将到货费用弹窗整理为三步式流程：填写账单、确认计入商品成本、补充凭证，并保留现有金额、IVA、币种/汇率、分摊、预览、保存估算、确认正式成本和更正契约。

## 业务影响

降低采购到货人员录入运输/到货费用的理解成本，减少把账单金额与计入商品落地成本混淆的风险。仅调整后台 UI 和文案，不自动修改售价、库存、财务数据或数据库结构。

## 完成定义

三步双语 UI、快捷填充、零成本原因条件显示、可折叠凭证区和新 Preview 文案均有契约测试；现有金额/IVA/币种/FX/分摊及 Preview→保存/确认/更正逻辑不变；局部测试、lint、typegen、tsc、build 和 diff check 通过，并完成发布候选审查。

## 主责部门

采购到货部

## 协作部门

前端体验部、PartsPro 业务契约部、平台发布部

## 工程守门代理

Next.js 16 App Router 代理、Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 采购到货部 / luna_worker |
| Approver | Hexiang Huang |
| Consulted | 前端体验部、PartsPro 业务契约部 |
| Informed | 平台发布部、文档审计部 |

## 涉及范围

- 页面：后台到货批次详情的“登记运输 / 到货费用”弹窗
- API：无变更；保留现有 preview / estimate / confirm / correct 请求
- 数据表/RPC：无变更；不调用、不写入 Supabase
- 文档：本任务卡
- 外部系统：Git main、Vercel production 由发布门处理

## 已知事实

- 现有费用弹窗已有宽屏修复、双语文案、金额和 FX 字段、预览及安全读回流程。
- 金额解析、IVA、原币与 EUR 快照、分摊算法和财务安全门属于既有业务契约。
- 本次需求是 UI 简化，不要求数据库 migration。

## 假设与未知项

- 现有 Dialog 组件继续提供 role、aria-labelledby、焦点陷阱和 Escape 行为。
- 生产发布前以最新 origin/main 为基线；若远端继续变化，需重新做发布门检查。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | luna_worker | 三步式双语 UI、条件字段与契约测试 | origin/main | UI contract 通过，业务字段未变 |
| WP-02 | luna_worker | 发布候选验证与任务归档 | WP-01 | lint/typecheck/build/diff check 通过，worktree clean |
| WP-03 | 平台发布部 | 推送 main、Vercel production、线上 smoke | 用户发布批准 | 目标 commit READY 且线上页面可用 |

## 批准要求

- 是否需要老板批准：需要；用户已批准完成后推送 main 并部署 Vercel production。
- 是否需要 Supabase migration 安全门：否；不新增或修改 migration，不调用 Supabase。
- 是否需要 Vercel 发布门：是。
- 是否需要 PartsPro 业务契约验收：是；必须确认费用计算和财务写入边界不变。

## 验收标准

- [x] 标题和说明直白说明“账单金额 → 计入商品成本 → 预览分摊”，并提供中文/意大利语。
- [x] 第 1 步突出费用类型、未税金额、IVA、自动含税总额和币种；非 EUR FX 字段仍按原逻辑显示。
- [x] 第 2 步突出计入商品成本、税额能否抵扣和怎么分到商品；两个快捷按钮必须显式点击后才填值。
- [x] 零成本原因只在金额解析为 0 或已有校验错误时显示，且错误不被隐藏。
- [x] 第 3 步为默认收起且可访问的高级凭证区；已有高级内容、更正模式或高级错误时展开。
- [x] 手工分摊、重量警告、Preview 结果、保存估算、确认正式成本和更正流程保持原逻辑。
- [x] API payload、字段名、金额/IVA/币种/FX、权限、幂等与财务数据不变。

## 禁止事项

- 不修改 API、repository、schema、SQL、migration、lockfile 或 RMA 文件。
- 不向 authenticated 角色开放敏感价格列，不改变 Supabase 权限。
- 不自动替用户选择 IVA、计入商品成本、分摊方式或任何会计值。
- 不自动修改售价、库存、财务层或历史成本。
- 不在本阶段调用 Supabase、保存估算或确认正式成本。

## 验证命令

```bash
node --test tests/supplier-batch-transport-cost-ui-contract.test.mjs
node --test tests/supplier-batch-transport-cost-contract.test.mjs tests/supplier-batch-transport-cost-ui-contract.test.mjs
npx eslint src/components/partspro/supplier-batch-transport-cost-dialog.tsx tests/supplier-batch-transport-cost-ui-contract.test.mjs
npm run lint
npx next typegen
npx tsc --noEmit --pretty false
npm run build
git diff --check
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `node --test tests/supplier-batch-transport-cost-ui-contract.test.mjs` | passed | 23/23 |
| combined transport contract tests | passed | 47/47 (`tests/supplier-batch-transport-cost-contract.test.mjs` + UI contract) |
| targeted ESLint | passed | component and UI contract test |
| `npm run lint` | passed | repository lint |
| `npx next typegen` | passed | route types generated successfully |
| `npx tsc --noEmit --pretty false` | passed | no diagnostics |
| `npm run build` | passed | Next.js 16.2.6 webpack production build |
| `git diff --check` | passed | no whitespace errors |

## 执行记录

- 创建：2026-08-28，基于 origin/main `3403a37bf002c55871e845b5cfc7844e2b898de9`
- 批准：用户已批准“完成后推送到 main 并进行部署”
- 开始：2026-08-28
- review：2026-08-28，主组件、契约测试、财务字段边界复核通过
- verified：2026-08-28，局部/发布候选验证全部通过
- released：pending，待父代理执行 main push 与 Vercel production 发布门
- closed：pending

## 结果

已完成三步式到货费用 UI 简化与契约测试扩充。仅修改指定组件、UI 契约测试和本任务卡；无 API、数据库、migration、Supabase 或财务数据变更。未启动独立审查代理（单组件 UI 调整，按 R2 轻量策略由实现代理自检并由主代理终审）；未做哈希检查（普通源码/样式修改不需要）。当前候选已通过 build/lint/typecheck，待发布门完成 main push、Vercel READY 和线上 smoke。
