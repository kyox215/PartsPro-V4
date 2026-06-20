# PartsPro Decision Records

`docs/decisions/decision-log.md` 记录轻量决策，`docs/adr/` 记录需要长期解释的架构决策。

## When To Record

- 影响价格、订单、库存、客户、权限、售后申请、数据库、发布或成本的决定。
- 选择一种方案并放弃其他合理方案。
- 接受风险、设立例外、推迟修复或改变自治等级。
- 文档与实际实现冲突后确定哪个是真相。

## Levels

- D1：低风险流程或文档决定，部门负责人可定。
- D2：影响一个业务域或多个页面/API，需要总调度/项目经理批准。
- D3：影响数据库、权限、发布或核心交易链路，需要工程守门代理批准。
- D4：生产数据、资金、安全、法律、破坏性操作或自治等级提升，需要老板明确批准。

## Format

Use:

```text
DEC-YYYYMMDD-01
```

Each entry must include context, alternatives, rationale, risks, and revisit trigger.
