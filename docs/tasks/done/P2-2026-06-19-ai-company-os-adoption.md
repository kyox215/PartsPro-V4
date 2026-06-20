# P2-2026-06-19-ai-company-os-adoption

状态：closed

优先级：P2

Task ID：TASK-20260619-01

风险等级：R1

自治等级：L2

## 目标

将 `/Users/kyox215/Downloads/AI_Company_OS/` 的治理体系完整接入 PartsPro 项目，让老板派单、AI 部门分工、质量门禁、风险登记、决策日志、发布 runbook 和复盘形成可追踪流程。

## 业务影响

提升 PartsPro 后续开发和运营任务的组织效率，减少口头需求散落、重复确认、绕过 Supabase/发布护栏和“看似完成但缺少验证”的风险。

## 主责部门

总调度/项目经理

## 协作部门

文档审计部、平台发布部、相关业务部门按试点任务参与。

## 工程守门代理

文档账本代理、PartsPro 业务契约代理；后续若涉及代码、Supabase、RLS 或发布，再按 `AGENTS.md` 加入对应守门代理。

## 涉及范围

- 页面：无
- API：无
- 数据表/RPC：无
- 文档：`.ai-company/**`、`AGENTS.md`、`README.md`、`docs/ai-company-os-adoption-plan.md`、`docs/project-charter.md`、`docs/roadmap.md`、`docs/risks/**`、`docs/decisions/**`、`docs/adr/**`、`docs/runbooks/**`、`docs/tasks/**`
- 外部系统：`/Users/kyox215/Downloads/AI_Company_OS/` 已复制到 `.ai-company/`，不再作为运行时依赖

## 验收标准

- 建立 AI Company OS 到 PartsPro 的完整接入规划，明确不替换当前 `AGENTS.md`。
- 规划包含分阶段路线、工作包、RACI、禁止事项和验证要求。
- 完成 `.ai-company/` 全量导入和 PartsPro 专属桥接说明。
- 新增项目章程、风险登记、决策日志、ADR、路线图和发布清单入口。
- 建立低到中风险试点任务来验证任务流，而不是一次性扩大自治。
- 不修改业务代码、Supabase migration、生产环境变量或部署配置。
- 文档类验证通过 `git diff --check`。

## 禁止事项

- 不把 AI Company OS 复制到仓库根目录并覆盖 PartsPro 规则；全量包只能位于 `.ai-company/`。
- 不把通用 `MASTER_PROMPT.md` 直接提升为高于 `AGENTS.md` 的规则。
- 不自动提高代理自治等级到 L3/L4。
- 不在本任务中执行 Supabase linked 写入、Vercel 发布或生产配置修改。
- 不声明未实际运行的测试、构建、dry-run 或发布结果。

## 验证命令

```bash
git diff --check
```

## 执行记录

- 创建：2026-06-19，老板要求“为我规划到项目当中”。
- 开始：2026-06-19，先完成只读梳理和规划入库。
- 完成：2026-06-19，老板要求“全部接入”后完成全量导入和 PartsPro 执行层接线。

## 结果

已完成：

- `.ai-company/` 全量导入 AI Company OS。
- 新增 `.ai-company/PARTSPRO_INTEGRATION.md` 说明优先级和使用方式。
- 更新 `AGENTS.md` 和 `README.md`，让后续代理能发现治理包和 PartsPro 执行层。
- 新增 `docs/project-charter.md`、`docs/roadmap.md`、`docs/risks/risk-register.md`、`docs/decisions/decision-log.md`、`docs/adr/`、`docs/runbooks/release-checklist.md`。
- 升级 `docs/tasks/TEMPLATE.md`、`docs/tasks/README.md`，新增 `docs/tasks/WORK_ORDER_TEMPLATE.md`。
- 新增 `docs/tasks/backlog/P2-2026-06-19-ai-company-os-pilot-validation.md` 作为真实任务流试点。

残余风险：

- `.ai-company/` 是完整通用规则包，后续代理必须遵守 `AGENTS.md` 中的优先级，不能用通用规则覆盖 PartsPro 专用护栏。
- 真实试点尚未执行，制度是否过重需要通过 backlog 试点任务验证。
