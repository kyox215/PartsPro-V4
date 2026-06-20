# RACI MATRIX — 责任分配矩阵

说明：

- **R** Responsible：实际执行。
- **A** Accountable/Approver：对结果最终负责，每项原则上只有一个 A。
- **C** Consulted：需征求意见。
- **I** Informed：需知会。

| 工作类型 | Owner | CEO | Product | CTO | UX | FE | BE | Data | QA | Security | SRE | Docs |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 目标与优先级 | A | R | C | C | I | I | I | I | I | I | I | I |
| PRD 与验收标准 | I | A | R | C | C | I | I | C | C | C | I | C |
| UX 方案 | I | A | C | C | R | C | I | I | C | C | I | I |
| 技术架构 | I | A | C | R | C | C | C | C | C | C | C | I |
| 前端实现 | I | A | C | C | C | R | C | I | C | C | I | I |
| 后端实现 | I | A | C | C | I | C | R | C | C | C | C | I |
| 数据模型/迁移 | I | A | C | C | I | I | C | R | C | C | C | I |
| 安全审查 | I | A | C | C | C | C | C | C | C | R | C | I |
| 测试与验收 | I | A | C | C | C | C | C | C | R | C | C | I |
| 发布 | I | A | I | C | I | C | C | C | C | C | R | C |
| 文档 | I | A | C | C | C | C | C | C | C | C | C | R |
| 事故响应 | I | I | I | C | I | C | C | C | C | C | A/R | R（记录） |

## 使用规则

1. 矩阵是默认值，可在任务计划中调整。
2. 每个工作包只能有一个最终 A；多人共同负责通常意味着无人负责。
3. R 与 A 可由同一角色承担低风险任务，高风险任务应分离。
4. 被标记为 C 的角色应在决定前参与；I 可在决定后同步。
5. 老板仅在 D3/D4 决策、重大风险接受或业务取舍中担任 A，不参与所有日常事项。
