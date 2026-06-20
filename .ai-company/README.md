# AI Company OS

> 一套让“老板只下达目标，AI 决策层自动拆解、分配、执行、审核和复盘”的项目治理规则。

版本：v1.0
适用范围：软件产品、SaaS、内部系统、自动化平台、网站、移动应用、数据项目及其他可拆解的知识工作项目。

---

## 1. 目标

AI Company OS 的目标不是制造更多角色名称，而是建立一套可审计、可复用、可扩展的工作制度：

1. 老板只需要说明目标、约束和期望结果。
2. CEO Agent 负责组织工作，而不是把所有工作自己做完。
3. 各部门 Agent 按职责分工，使用统一输入、输出和交接协议。
4. 所有重要决策都有依据、负责人、风险和记录。
5. 所有交付必须经过质量门禁，不以“看起来完成”代替真实验收。
6. 系统能够在每次任务后沉淀经验，持续改进制度。

---

## 2. 目录说明

| 文件 | 用途 |
|---|---|
| [MASTER_PROMPT.md](MASTER_PROMPT.md) | 可直接放入 Codex、Claude Code、Cursor 或多 Agent 系统的总控提示词 |
| [AGENTS.md](AGENTS.md) | 部门、角色、职责、权限与输出标准 |
| [PROJECT_RULES.md](PROJECT_RULES.md) | 全项目不可违反的基本制度 |
| [TASK_FLOW.md](TASK_FLOW.md) | 从老板下达任务到关闭任务的完整流程 |
| [GOVERNANCE.md](GOVERNANCE.md) | 公司治理、自治等级、升级与审计规则 |
| [DECISION_RIGHTS.md](DECISION_RIGHTS.md) | 谁能决定什么、什么情况必须请示老板 |
| [AGENT_PROTOCOL.md](AGENT_PROTOCOL.md) | Agent 之间的通信、交接、冲突处理协议 |
| [RACI_MATRIX.md](RACI_MATRIX.md) | 常见工作的负责、批准、咨询和知会矩阵 |
| [CONTEXT_MEMORY.md](CONTEXT_MEMORY.md) | 项目上下文、长期记忆和事实来源规则 |
| [ENGINEERING_STANDARDS.md](ENGINEERING_STANDARDS.md) | 架构、代码、依赖、版本控制与评审标准 |
| [PRODUCT_DESIGN_STANDARDS.md](PRODUCT_DESIGN_STANDARDS.md) | 产品需求、UX、可访问性和设计系统标准 |
| [DATA_API_STANDARDS.md](DATA_API_STANDARDS.md) | 数据库、API、迁移、兼容性和数据质量标准 |
| [SECURITY_POLICY.md](SECURITY_POLICY.md) | 权限、秘密、供应链、隐私与安全审查规则 |
| [QA_QUALITY_GATES.md](QA_QUALITY_GATES.md) | 测试策略、质量门禁和发布准入条件 |
| [RELEASE_OPERATIONS.md](RELEASE_OPERATIONS.md) | 发布、回滚、监控、值守与运行制度 |
| [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) | 故障和安全事件的响应流程 |
| [DOCUMENTATION_POLICY.md](DOCUMENTATION_POLICY.md) | 文档同步、决策记录和知识交接规则 |
| [METRICS_CONTINUOUS_IMPROVEMENT.md](METRICS_CONTINUOUS_IMPROVEMENT.md) | 指标、复盘、制度改进和 Agent 绩效规则 |
| [PROMPTS_LIBRARY.md](PROMPTS_LIBRARY.md) | 老板常用命令和不同场景的提示词 |
| [STRATEGY_PORTFOLIO.md](STRATEGY_PORTFOLIO.md) | 战略、OKR、路线图与项目组合治理 |
| [BUSINESS_OPERATIONS.md](BUSINESS_OPERATIONS.md) | 业务流程、SOP、队列、交接和连续性 |
| [FINANCE_PROCUREMENT_POLICY.md](FINANCE_PROCUREMENT_POLICY.md) | 预算、采购、支付、订阅与 FinOps |
| [LEGAL_COMPLIANCE_POLICY.md](LEGAL_COMPLIANCE_POLICY.md) | 合同、隐私、知识产权与合规审查 |
| [PEOPLE_ACCESS_POLICY.md](PEOPLE_ACCESS_POLICY.md) | 人员与 Agent 身份、权限生命周期 |
| [SALES_MARKETING_CUSTOMER_SUCCESS.md](SALES_MARKETING_CUSTOMER_SUCCESS.md) | 销售、市场、客户支持与成功流程 |
| [VENDOR_MANAGEMENT.md](VENDOR_MANAGEMENT.md) | 供应商尽调、接入、监控和退出 |
| [AI_MODEL_TOOL_GOVERNANCE.md](AI_MODEL_TOOL_GOVERNANCE.md) | 模型、提示词、工具权限和 AI 风险治理 |
| [MEETING_COMMUNICATION_POLICY.md](MEETING_COMMUNICATION_POLICY.md) | 会议、决策、状态报告和升级沟通 |
| [ADOPTION_GUIDE.md](ADOPTION_GUIDE.md) | 在 Codex、多 Agent 和真实仓库中的落地步骤 |
| [templates/](templates/) | 任务、PRD、技术方案、ADR、测试、发布和事故模板 |

---

## 3. 推荐接入方式

### 方式 A：支持仓库规则文件的工具

将整个目录复制到项目根目录，并让总控 Agent 在每次任务开始前读取：

1. `MASTER_PROMPT.md`
2. `PROJECT_RULES.md`
3. `AGENTS.md`
4. `TASK_FLOW.md`
5. 与当前任务有关的专业规则文件

### 方式 B：只支持单条系统提示词的工具

使用同目录下的 `AI_COMPANY_OS_MASTER.md`。该文件由本套规则合并生成，适合作为系统提示词或项目长期上下文。

### 方式 C：已有项目

首次接入时先下达：

```text
执行“项目接管与制度初始化”。
读取当前仓库，不修改业务代码；先建立项目地图、风险清单、技术债清单、角色权限表和分阶段整改计划。
所有结论必须附证据路径，按 P0/P1/P2 分级。
```

---

## 4. 老板最简下令格式

```text
任务目标：<希望最终发生什么>
业务价值：<为什么要做>
硬性约束：<不能违反的时间、成本、技术或业务条件>
完成定义：<怎样算完成>
自治等级：L2
```

信息不足时，CEO Agent 应先从项目现状中调查。只有缺失信息会导致不可逆错误、重大成本或安全风险时，才向老板提出最少数量的问题。

---

## 5. 自治等级

| 等级 | 行为 |
|---|---|
| L0 建议 | 只分析和建议，不修改任何内容 |
| L1 规划 | 可读取和制定计划，不执行变更 |
| L2 受控执行 | 可执行低风险、可回滚变更；高风险动作需批准 |
| L3 委托执行 | 可完成规划、开发、测试和文档；发布及破坏性动作需批准 |
| L4 运营自治 | 在预算、权限和策略边界内持续运行，并按周期汇报 |

默认等级为 **L2**。任何 Agent 都不得自行提高自治等级。

---

## 6. 不可妥协原则

- 不伪造已执行、已测试、已发布或已验证的事实。
- 不把猜测当成项目事实；所有假设必须显式标记。
- 不绕过权限、审批、安全或质量门禁。
- 不因追求速度而静默扩大范围或制造长期债务。
- 不在缺少回滚方案时执行高风险、不可逆变更。
- 不把秘密、个人数据或生产凭据写入提示词、代码、日志和文档。
- 不让同一个 Agent 在高风险任务中同时担任实施者与最终批准者。
- 不以长篇报告代替可验证的交付物和证据。

---

## 7. 最小落地顺序

1. 先启用 `MASTER_PROMPT.md`、`PROJECT_RULES.md`、`AGENTS.md` 和 `TASK_FLOW.md`。
2. 为项目填写 `templates/PROJECT_CHARTER_TEMPLATE.md`。
3. 运行一次项目体检，建立风险、架构和技术债基线。
4. 选择 L1 或 L2 试运行一到两个任务。
5. 确认质量门禁有效后，再逐步提升到 L3。

---

## 8. 维护规则

本制度不是不可修改的法律。任何规则变更必须：

1. 说明要解决的问题。
2. 评估对效率、质量、安全和角色权限的影响。
3. 记录在决策日志或 ADR 中。
4. 更新受影响文件和模板。
5. 通过至少一次真实任务验证。
