# PartsPro AI Company OS 接入规划

状态：active
创建日期：2026-06-19
全量接入日期：2026-06-19
主责部门：总调度/项目经理
协作部门：文档审计部、平台发布部、各业务部门按任务参与
输入来源：`/Users/kyox215/Downloads/AI_Company_OS/`

## 目标

把 `AI_Company_OS` 中的任务治理、角色分工、风险控制、质量门禁和复盘机制，吸收到 PartsPro 现有项目管理体系里，让老板可以继续用一句业务目标派单，而代理系统能稳定完成拆解、执行、验证和沉淀。

本规划不替换当前 `AGENTS.md`。PartsPro 已经有项目专用的 Next.js、Supabase、业务契约、migration 和发布护栏，这些规则优先级更高。`AI_Company_OS` 已完整接入 `.ai-company/`，作为治理能力来源；真正执行时使用 PartsPro 的项目章程、任务流、风险登记、决策日志和 runbook。

## 接入原则

- `AGENTS.md` 继续作为 PartsPro 仓库内代理协作的默认真相源。
- `AI_Company_OS` 整包保存在 `.ai-company/`，但不作为高于 `AGENTS.md` 的项目规则。
- 先落地低风险文档和流程，再选择真实任务试点，最后才考虑自动化门禁。
- 默认自治等级保持 L2：可做低风险、可回滚变更；数据库、发布、权限、价格、订单、库存等高风险动作仍需按 `AGENTS.md` 申请批准。
- 所有新制度必须有可复验证据，不用“角色名称变多”代替交付质量提升。

## 当前 PartsPro 基础

| 能力 | 当前状态 | 缺口 |
|---|---|---|
| 项目级规则 | 已有 `AGENTS.md` 和 `CLAUDE.md` 引用关系 | 缺少正式项目章程和自治等级声明 |
| 部门角色 | 已有 `docs/agents/` 下的业务部门和工程守门代理 | 缺少 RACI/批准权边界的集中索引 |
| 任务看板 | 已有 `docs/tasks/`、模板和 urgent/now/backlog/done | 缺少工作包、风险分级、决策记录字段 |
| 数据库护栏 | 已有 Supabase migration 安全门 | 需要把 dry-run、风险扫描、应用后验证纳入任务关闭证据 |
| 发布护栏 | 已有 Vercel 发布代理和不自动绑定 migration 的规则 | 缺少发布清单和观察窗口模板 |
| 决策沉淀 | 已有部分长期计划文档 | 缺少统一 decision log / ADR / risk register |

## 已接入文件

- `.ai-company/`：完整 AI Company OS 原包和 `PARTSPRO_INTEGRATION.md`。
- `AGENTS.md`：新增 AI Company OS 接入层、优先级和任务要求。
- `README.md`：新增治理包、章程、风险、决策和 runbook 入口。
- `docs/project-charter.md`：PartsPro 项目章程。
- `docs/roadmap.md`：项目路线图。
- `docs/risks/risk-register.md`：风险登记。
- `docs/decisions/decision-log.md`：决策日志。
- `docs/adr/`：架构决策记录入口和 ADR-0001。
- `docs/runbooks/release-checklist.md`：发布清单。
- `docs/tasks/TEMPLATE.md` 和 `docs/tasks/WORK_ORDER_TEMPLATE.md`：任务与工作包模板。
- `docs/tasks/backlog/P2-2026-06-19-ai-company-os-pilot-validation.md`：后续试点验证任务。

## AI Company OS 到 PartsPro 的映射

| AI Company OS 文件 | PartsPro 落地方式 |
|---|---|
| `MASTER_PROMPT.md` | 保留在 `.ai-company/`，不直接覆盖 root 指令 |
| `PROJECT_RULES.md` | 通过 `AGENTS.md`、章程、任务模板和 runbook 吸收 |
| `AGENTS.md` | 保留在 `.ai-company/` 作为通用角色参考；PartsPro 角色仍在 `docs/agents/` |
| `TASK_FLOW.md` | 已扩展到 `docs/tasks/TEMPLATE.md` 和 `docs/tasks/README.md` |
| `DECISION_RIGHTS.md` | 已落到章程批准矩阵、决策日志和 ADR 规则 |
| `RACI_MATRIX.md` | 已落到任务模板 RACI 和规划 RACI |
| `CONTEXT_MEMORY.md` | 已落到文档账本、决策日志和证据规则 |
| `QA_QUALITY_GATES.md` | 已落到任务模板和发布清单 |
| `RELEASE_OPERATIONS.md` | 已落到 `docs/runbooks/release-checklist.md` |
| `templates/` | 全量保留在 `.ai-company/templates/`，常用模板已适配进 `docs/` |

## 分阶段路线

### Phase 0：规划入库（已完成）

目标：把接入方案变成仓库内可追踪计划。

交付物：
- `docs/ai-company-os-adoption-plan.md`
- `docs/tasks/now/P2-2026-06-19-ai-company-os-adoption.md`

退出条件：
- 文档通过 `git diff --check`。
- 未修改业务代码、migration、环境变量或发布配置。

### Phase 1：建立项目治理骨架（已完成）

目标：补齐 PartsPro 的项目章程、风险、决策和路线图入口。

已新增：
- `docs/project-charter.md`
- `docs/roadmap.md`
- `docs/risks/risk-register.md`
- `docs/decisions/decision-log.md`
- `docs/runbooks/README.md`

验收重点：
- 项目使命、核心业务域、老板批准事项、自治等级、生产敏感资源写清楚。
- 风险登记至少包含价格、订单、库存、权限、Supabase migration、Vercel 发布六类。
- 决策日志能记录“为什么这么做”，而不是只记录结果。

### Phase 2：升级任务流（已完成）

目标：让每个非微小任务有更清晰的输入、分工和关闭证据。

已完成：
- 扩展 `docs/tasks/TEMPLATE.md`，增加 Task ID、风险等级、自治等级、工作包、批准要求、验证证据。
- 增加 `docs/tasks/WORK_ORDER_TEMPLATE.md`，用于复杂任务的子工作包。
- 更新 `docs/tasks/README.md`，说明 proposed / in_progress / review / verified / closed 的使用方式。

验收重点：
- 老板一句话派单后，代理可以直接产出任务卡。
- 任务关闭必须写明实际运行过的命令、结果和残余风险。
- 不让数据库、发布、权限、价格、订单任务绕过现有工程守门代理。

### Phase 3：选择两个试点任务（已建 backlog）

目标：用真实低到中风险任务验证制度是否有效。

跟踪任务：`docs/tasks/backlog/P2-2026-06-19-ai-company-os-pilot-validation.md`

推荐试点：
1. 文档试点：整理一个现有长期计划或 runbook，不改代码。
2. 业务试点：选择一个 P2 级 storefront/admin 体验优化，涉及页面但不涉及生产数据库迁移。

验收重点：
- 试点任务能从任务卡进入执行、审查、验证和关闭。
- 老板需要回答的问题变少，而不是更多。
- 交付报告包含证据，不只包含计划。

### Phase 4：自动化质量门禁

目标：把重复验证动作变成脚本或 CI 检查。

候选门禁：
- 文档变更：`git diff --check`。
- Next/API/UI 变更：`npm run lint`，尽量 `npm run build`。
- Supabase schema 变更：migration dry-run、风险扫描、应用后 linked 状态核对。
- 发布任务：发布清单、smoke test、观察窗口、回滚阈值。

验收重点：
- 自动化只辅助判断，不替代老板批准和生产敏感动作确认。
- 失败时能明确指出阻断原因和下一步，而不是给出模糊失败。

### Phase 5：复盘后再扩大自治

目标：只有当任务流和门禁经试点有效后，才把部分流程提升到 L3。

可提升范围：
- 文档账本维护。
- 低风险 UI 文案和布局修正。
- 不涉及生产数据的只读审计和任务卡生成。

不得自动提升：
- Supabase migration 应用。
- Vercel production 发布。
- 价格、库存、订单、权限、客户资料、支付、RMA 相关破坏性变更。
- 任何会修改真实客户或订单数据的动作。

## 首批工作包

| 工作包 | 主责 | 输出 | 验收 |
|---|---|---|---|
| WP-01 项目章程 | 总调度/项目经理 | `docs/project-charter.md` | 项目使命、业务边界、批准人、自治等级完整 |
| WP-02 风险登记 | 文档审计部 | `docs/risks/risk-register.md` | 覆盖核心交易、数据库、发布和权限风险 |
| WP-03 决策日志 | 文档审计部 | `docs/decisions/decision-log.md` | 有统一记录格式和引用规则 |
| WP-04 任务模板升级 | 总调度/项目经理 | `docs/tasks/TEMPLATE.md` | 支持风险、自治、工作包和证据 |
| WP-05 发布清单 | 平台发布部 | `docs/runbooks/release-checklist.md` | 明确 migration 与 Vercel 发布分离 |
| WP-06 试点复盘 | 总调度/项目经理 | 试点任务关闭报告 | 形成保留、修改或取消制度的结论 |

## RACI 草案

| 工作类型 | Responsible | Approver | Consulted | Informed |
|---|---|---|---|---|
| 老板一句话派单整理 | 总调度/项目经理 | 老板，必要时 | 相关业务部门 | 文档审计部 |
| 文档与任务制度 | 文档审计部 | 总调度/项目经理 | 文档账本代理 | 各部门 |
| 价格/客户/订单/库存规则 | 对应业务部门 | PartsPro 业务契约代理 | 相关工程守门代理 | 总调度/项目经理 |
| Supabase migration | 相关业务部门 | Supabase Migration 守门代理 | RLS/权限代理，业务契约代理 | 平台发布部 |
| Vercel 发布 | 平台发布部 | Vercel 发布代理 | Next.js 16 App Router 代理 | 老板，相关业务部门 |
| 安全或权限例外 | 相关主责部门 | 老板 | Supabase RLS/权限代理，平台发布部 | 文档审计部 |

## 禁止事项

- 不把 `/Users/kyox215/Downloads/AI_Company_OS/` 当成仓库运行时依赖。
- 不修改业务代码、数据库 migration、生产环境变量或部署设置。
- 不用 AI Company OS 的通用规则覆盖 PartsPro 已有的 Supabase migration 安全门。
- 不让任何代理自行提高自治等级到 L3/L4。
- 不用模板数量衡量进展；每个模板必须服务于真实任务闭环。

## 验收标准

- PartsPro 仓库内存在清晰的 AI Company OS 接入路线和当前任务卡。
- 每个后续阶段都有交付物、负责人、退出条件和禁止事项。
- 规划明确保留 `AGENTS.md` 的最高项目规则地位。
- 文档没有声明未执行的测试、发布或数据库操作。
- 文档验证通过 `git diff --check`。
