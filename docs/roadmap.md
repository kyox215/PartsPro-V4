# PartsPro Roadmap

Period: 2026 H2
Owner: 总调度/项目经理
Last reviewed: 2026-06-19

## Now

| Outcome | Why now | Owner | Evidence / exit criteria | Risk |
|---|---|---|---|---|
| AI Company OS 全量接入 | 让老板一句话派单能进入可追踪流程 | 总调度/项目经理 | `.ai-company/`、章程、风险、决策、runbook、任务模板就绪 | 低 |
| Storefront 交易链路稳定 | 商品、价格、购物车和订单是收入主链路 | 订单运营部 | lint/build、API smoke、业务契约检查 | 高 |
| Supabase migration 安全门稳定 | linked 项目按生产敏感处理 | 平台发布部 | migration list、dry-run、风险扫描和应用后查询证据 | 高 |
| 客户等级与价格规则收敛 | B2B 价格错误直接影响利润与信任 | 价格与客户部 | 前后端字段、RPC/API DTO、UI 文案一致 | 高 |

## Next

| Candidate outcome | Dependency | Validation needed | Priority rationale |
|---|---|---|---|
| 项目 runbook 补全 | 治理接入完成 | 发布清单、事故响应、供应商导入 SOP 通过一次真实任务 | 降低重复操作风险 |
| 后台商品与库存管理增强 | 业务契约和 schema 状态清楚 | admin UI smoke、库存动作审计、权限检查 | 提升店铺运营效率 |
| 供应商到货导入闭环 | 到货声明规则和数据库写入路径稳定 | preflight、声明确认、写库后数量/金额/库存/审计核对 | 降低人工录入成本 |
| eBay 渠道试点 | 商品资料、库存和价格规则稳定 | sandbox 或受控真实刊登、队列失败恢复 | 扩大销售渠道 |

## Later

| Direction | Opportunity | Uncertainty |
|---|---|---|
| 自动补图和商品资料质量评分 | 提升目录质量，减少人工整理 | 图片版权、供应商数据质量、匹配准确度 |
| 客户信用、钱包退款和售后自动化 | 提升 B2B 客户体验 | 资金、税务、审计和权限复杂度 |
| 更完整的 BI 与经营分析 | 帮老板看库存、利润、热销和缺货 | 数据质量和指标口径 |
| 多语言客服和营销自动化 | 支持意大利语、中文、英语客户沟通 | 文案准确性、合规和人工审核 |

## Not Planned / Stopped

| Item | Reason | Revisit trigger |
|---|---|---|
| 代理自动执行生产破坏性 SQL | 数据风险不可接受 | 用户明确批准且有备份、dry-run、回滚和独立验证 |
| 把 Vercel 发布与 Supabase migration 绑定为一个自动动作 | 发布和数据变更风险不同 | 有成熟 CI、预发环境和回滚演练后再评估 |
| 用通用 AI Company OS 覆盖 PartsPro `AGENTS.md` | 会破坏现有业务和数据库护栏 | 只有在全部 PartsPro 专用规则迁移完并经批准后才可讨论 |

## Capacity And Portfolio Balance

- 60% 核心交易、数据正确性和生产风险控制。
- 25% 运营效率、供应商导入和后台工具。
- 10% 文档、runbook、质量门禁和复盘。
- 5% 探索性自动化和渠道试点。
