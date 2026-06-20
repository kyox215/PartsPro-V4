# PartsPro Risk Register

Status: active
Owner: 文档审计部
Last reviewed: 2026-06-19

| ID | Risk | Category | Probability | Impact | Level | Existing controls | Mitigation | Owner | Trigger | Due/Review | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| R-001 | 客户等级、批发价或零售价展示错误 | Pricing | Medium | High | R3 | PartsPro 业务契约代理、服务端重算 | 价格/API/前端文案同任务核对；关键路径加 smoke | 价格与客户部 | 改动价格、客户资料、catalog/order API | 每次价格相关任务 | open |
| R-002 | 订单金额、IVA、运费或 MOQ 被客户端篡改 | Orders | Medium | High | R3 | 服务端校验、未知金额字段拒绝 | 增加 API 契约测试；订单预览和创建保持同源逻辑 | 订单运营部 | 改动购物车、checkout、orders API | 每次订单相关任务 | open |
| R-003 | 库存锁定、扣减或回补不一致 | Inventory | Medium | High | R3 | 仓库库存部、业务契约验收 | 库存动作审计；RMA 和订单状态机统一 | 仓库库存部 | 改动库存、订单状态、RMA | 每次库存相关任务 | open |
| R-004 | Supabase linked migration 应用夹带旧 pending 或高风险 SQL | Database | Medium | Critical | R4 | migration 安全门、dry-run 要求 | dry-run 只允许本任务 migration；危险 SQL 停止询问 | 平台发布部 | 新增或修改 `supabase/migrations/*.sql` | 每次 schema 任务 | open |
| R-005 | RLS、service role 或 secret 暴露导致越权 | Security | Low | Critical | R4 | RLS/权限代理、禁止客户端 secret | 最小权限；权限例外写决策日志并设到期 | Supabase RLS/权限代理 | 改动 Auth、RLS、Storage、env | 每次权限任务 | open |
| R-006 | Vercel 发布与数据库状态不匹配 | Release | Medium | High | R3 | 发布代理、migration 与 release 分离 | 发布清单必须确认 schema 依赖和 smoke test | 平台发布部 | 发布、回滚、env 变更 | 每次发布任务 | open |
| R-007 | 供应商到货导入写错商品、金额、库存或批次 | Operations | Medium | High | R3 | 到货导入声明规则、只读预检 | 写库前确认声明；写库后核对数量、金额、库存和审计 | 采购到货部 | Mobilax/UTOPYA/发票导入 | 每次导入任务 | open |
| R-008 | AI Company OS 规则过重，低风险任务变慢 | Governance | Medium | Medium | R2 | 风险分级、默认 L2 | 低风险任务简化；试点后复盘删繁就简 | 总调度/项目经理 | 任务卡耗时超过实际工作 | 2026-07-19 | open |
| R-009 | 未提交用户改动被代理覆盖 | Collaboration | Medium | High | R3 | `git status --short`、禁止 reset/checkout | 每次编辑前查状态，只触碰任务范围文件 | 所有代理 | 工作区 dirty 或多人协作 | 每次任务 | open |

## Risk Acceptance Record

- Risk ID:
- Reason for acceptance:
- Accepted by:
- Compensating controls:
- Expiry:
- Reassessment trigger:
