# PartsPro AI 员工任务看板

`docs/tasks/` 是老板派单、AI 员工分工和长期交接的任务账本。聊天中可以先讨论，但一旦任务需要长期跟踪、跨部门协作或以后复盘，就必须落到这里。

AI Company OS 已完整接入 `.ai-company/`。任务流参考 `.ai-company/TASK_FLOW.md`，但执行优先遵守根目录 `AGENTS.md` 和 PartsPro 专用护栏。

## 目录

- `urgent/`：P0/P1，生产、付款、订单、库存、权限、数据安全等必须优先处理的问题。
- `now/`：当前正在推进，已经确认主责部门和验收标准。
- `backlog/`：以后要做，暂不执行或等待业务确认。
- `done/`：已完成，保留验收结果、验证命令和残余风险。
- `examples/`：派单 dry-run 示例，不代表真实待办。

## 状态

任务正文中的 `状态` 使用 AI Company OS 状态词：

- `proposed`：已记录但未批准或未排期。
- `approved`：已确认可以执行。
- `in_progress`：正在执行。
- `blocked`：阻塞，必须写明事实、影响、选项和推荐方案。
- `review`：等待业务、技术、安全或文档审查。
- `verified`：验收证据已记录。
- `released`：需要发布的任务已发布并通过 smoke test。
- `closed`：已关闭，残余风险和后续任务已记录。
- `rejected`：不做或废弃。

目录和状态不是同一件事：`now/` 代表看板位置，`状态` 代表任务生命周期。

## 优先级

- `P0`：生产事故、资金或数据安全风险、订单/库存严重损坏。必须立即处理，默认放 `urgent/`。
- `P1`：核心交易链路受阻，例如 checkout、付款、订单、库存、登录、权限。默认放 `urgent/` 或 `now/`。
- `P2`：重要功能缺陷、管理效率问题、批量运营任务。默认放 `now/` 或 `backlog/`。
- `P3`：优化、文案、文档、体验微调。默认放 `backlog/`。

## 文件命名

使用：

```text
P1-2026-06-08-checkout-cart-sync.md
```

不要使用：

```text
4.md
4.mad
urgent-task.md
todo.md
```

命名必须包含优先级、日期和短 slug，方便搜索和排序。

## 流程

1. 总调度/项目经理代理先把老板需求整理成任务卡。
2. 每个任务指定一个主责部门，只能有一个。
3. 按风险添加协作部门和工程守门代理。
4. 标注风险等级 R0-R4 和自治等级 L0-L4。
5. 执行前确认禁止事项、批准要求和验收标准。
6. 复杂任务拆成 `docs/tasks/WORK_ORDER_TEMPLATE.md` 格式的工作包。
7. 完成后移动到 `done/`，记录验证结果、残余风险、后续任务和证据。

## 风险等级

- `R0`：几乎无风险，例如纯文案或只读整理。
- `R1`：低风险，可自主执行并验证。
- `R2`：中风险，需要相关专业代理复核。
- `R3`：高风险，需要明确批准、回滚或补偿方案。
- `R4`：关键风险，需要老板批准、分阶段执行和独立验证。

价格、订单、库存、客户资料、权限、支付、RMA、Supabase migration 和生产发布任务不得低估风险。

## 自治等级

- `L0`：只分析建议。
- `L1`：只规划，不执行变更。
- `L2`：受控执行低风险、可回滚变更；PartsPro 默认等级。
- `L3`：委托执行开发、测试和文档；发布及破坏性动作仍需批准。
- `L4`：运营自治；PartsPro 不默认启用。

任何代理不得自行提高自治等级。

## 主责部门

- 总调度/项目经理
- 商品目录部
- 价格与客户部
- 订单运营部
- 仓库库存部
- 采购到货部
- 电商渠道部
- 平台发布部
- 文档审计部

## 工程守门代理

- Next.js 16 App Router 代理
- Supabase Migration 守门代理
- Supabase RLS/权限代理
- PartsPro 业务契约代理
- 前端体验代理
- 供应商到货导入代理
- Vercel 发布代理
- 文档账本代理

## 验收

文档类任务至少运行：

```bash
git diff --check
```

代码、API、Supabase 或发布任务按 `AGENTS.md` 中验证要求执行。任何任务涉及价格、订单、库存、权限、客户资料或支付，都必须有业务契约验收。

## 关联治理文件

- `.ai-company/TASK_FLOW.md`
- `.ai-company/QA_QUALITY_GATES.md`
- `docs/project-charter.md`
- `docs/roadmap.md`
- `docs/risks/risk-register.md`
- `docs/decisions/decision-log.md`
- `docs/runbooks/release-checklist.md`
