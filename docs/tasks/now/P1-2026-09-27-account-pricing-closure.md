# P1-2026-09-27-account-pricing-closure

Task ID：TASK-20260927-01。风险：R3；自治：L2。项目状态以 `docs/roadmap.md` 为准。

## 目标与授权

老板要求实施已选定的完整价格制度修复计划。主责价格与客户部，协作商品目录、订单运营、平台发布。主代理负责应用，数据库工作包拥有本次新增 migration/SQL 测试；审查按业务契约、Migration、RLS、Next/UI 顺序进行。

RACI：主代理 Responsible；老板 Approver（生产迁移/发布）；专项审查代理 Consulted；平台发布部 Informed。

## 确定规则

- 保留零售/批发原价、七等级门槛与固定减额、REMAX/保护膜免折扣。
- 人工等级有效时作为基础，否则按消费计算；员工自购保留其基础等级；促销取高、到期恢复基础。
- 退款不额外扣等级累计；不重算历史消费。不处理15%毛利问题。
- 继续注册赠送三个月 King，增加活动管理；已发权益不变。
- 统一实际客户、SKU、数量报价；失败不猜价；切换身份清旧报价；保持订单快照。

## 范围与工作包

| 包 | 交付 | 验收 |
| --- | --- | --- |
| DB | 兼容报价RPC、等级修复、活动及审计/异常RPC | 隔离行为测试与权限审查 |
| 应用 | 数量报价、故障关闭、身份失效、价格解释 | 定向测试、lint/build、UI |
| 后台 | 活动开关、恢复自动等级、分类报价预览、异常检查 | 权限与操作流程验证 |
| 交付 | 影响清单、迁移安全门、回退/补偿方案 | 生产操作单独批准 |

涉及 catalog、cart、orders preview/create、admin accounts/pricing API；customers、products、价格RPC及新增私有活动配置。唯一外部目标 PartsPro-V4 / yiuxrjqexlfjtxxrkqvi。

## 禁止事项与审批

不得覆盖既有未提交修改；不得自动调整原价/客户类型；不得恢复暂停客户资格；不得改写历史订单。具体两个账号编号未提供，仅该项个体归因待核对，不阻断通用修复。

代码实施已授权。生产 migration 必须展示目标、精确 dry-run 清单、风险与补偿，取得本次 db push 明确批准；发布单独审批。存在旧 pending/远端分叉、权限异常或验证失败则暂停对应生产动作。

## 验证

相关 `node --test tests/<定向文件>.test.mjs`；`npm run test:storefront`；`npm run lint`；`npm run build`；`git diff --check`。SQL 行为仅隔离数据库执行；线上只读核对不替代交易E2E。

## 完成定义

兼容实现、定向和专项审查完成；清楚区分本地验证、未应用迁移、未发布及真实UI缺口。上线后才可声称线上修复。

## 本地交付与验收（2026-09-27）

实现与本地验收完成，保留在 now 以跟踪生产安全门；项目唯一状态源仍为 roadmap。

- 应用：统一客户/SKU/数量报价、不可报价故障关闭；账号关联只认 ownership/active membership、拒绝歧义；目录/首页/详情/购物车/结算身份与到期刷新；订单预览总额权威显示、数量重报、同 UID 刷新保留表单。
- 管理：权限 `pricing.manage_policy` 仅默认授予 admin；注册活动、审计、价格异常、单客户价格解释、分类前后价预览、恢复自动等级。免折扣商品仍有独立零售/批发原价。
- DB：`20260927141646_account_pricing_authority.sql`，SHA256 `bc022f9b7ae02680d95046dd72d215ff89c3926611b246477bd1b38c40cbec20`。保留旧 RPC 列契约；新 DTO 无成本/毛利，旧 margin 列返回 NULL；已有领取证据只补 eligibility ledger，不改客户原价、已发权益或历史订单。
- 专项审查：独立 Migration/RLS 和 Next/UI/业务契约复核完成。发现并修正旧返回列缺失、NULL 所有权漏拒绝、毛利字段泄漏、历史领取遗漏、报价请求循环及表单重挂等问题。

实际验证命令及结果：

```sh
node --test tests/account-pricing-policy.test.mjs tests/protective-film-pricing-contract.test.mjs tests/remax-commerce-contract.test.mjs tests/checkout-state-contract.test.mjs tests/storefront-i18n-contract.test.mjs
npm run lint
npm run build
git diff --check
# 指向本机已安装的 Playwright 包；脚本使用全新 Chrome 会话与模拟 API。
PLAYWRIGHT_MODULE=/path/to/playwright node scripts/verify-account-pricing-ui.mjs
```

- Node 24/24 通过（含 storefront 的两份合同测试）；lint/build 成功；diff whitespace 检查通过。
- 浏览器 14 项通过：报价空闲稳定、同 UID 刷新保留备注、改数量、确认保持、转预购清钱包、失败禁止提交、换身份阻断旧表单、活动保存、解释、异常、分类预览、目录 focus 重置、已过期＋未来报价边界刷新、目录身份隔离。真实组件＋模拟认证/接口，**不代表真实客户交易 E2E**；未提交真实订单。
- SQL：仅隔离 `postgres:17 --network none`、无端口容器中，以 `psql -v ON_ERROR_STOP=1` 依次执行 `supabase/tests/account_pricing_fixture.sql` → 完整 migration → `account_pricing_behavior.sql` → `account_pricing_access_boundaries.sql`，全通过且容器删除。覆盖七等级、促销边界、数量协议价、免折扣、领取去重、活动配置、旧列兼容和真实 authenticated 角色访问拒绝。fixture 为最小 schema，不覆盖完整生产库存/钱包/订单事务。
- 证据：`outputs/pricing/2026-09-27/verification.json`、`browser-result.json`、日志和手机截图。构建最初遇到既有 `.next` 重复生成文件，保留旧目录于 `/tmp/partspro-pricing-next-backup-1790519648` 后干净构建通过，未修改用户源码来绕开构建。

## 生产安全门与具体阻塞

目标：`yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`，production-sensitive。

本次 CLI `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked` 及 `supabase db push --linked --dry-run` 因 access token 未提供而失败。只读 MCP 查询确认远端独有迁移 `20260926110808` / `rma_v4_wallet_negotiation_split_closure`，本地未找到；不能以本地 `.temp` 或文件数量假定同步。

**未应用迁移、未发布、未写生产业务数据。无成功 dry-run 清单，因此尚不满足向老板请求本次 db push 最终批准的前提。** 上线后还须完成：

1. 恢复 CLI 登录；由相关负责人核清远端独有 RMA 迁移并提供准确本地记录。不得静默 migration repair、include-all、db pull 或覆盖他人改动。
2. 重新 linked list 确認无 remote-only；dry-run 必须仅列本次 `20260927141646_account_pricing_authority.sql`。任何其他 pending 停止；展示真实清单和下述风险，再申请本次 db push 明确批准。
3. 应用后核对函数返回签名、权限、默认活动、领取账本，以及两个测试账号的 retail/wholesale × 7 等级、promo 到期、MOQ 9/10/11、免折扣、预购、钱包、最终订单快照。用受控测试档案，不改真实客户原价或历史交易。
4. 通过独立发布审查后，单独批准应用发布。**不能先发布新应用**：缺少新 RPC 时故障关闭会导致已登录商品无法报价。迁移和部署仍是两个操作。
5. 线上使用指定客户编号验证账号归属、1.4/1.9解释及预览/提交；观察报价失败与 PRICE_CHANGED 错误。没有提供两个客户编号的个体归因仍待核对。

风险与回退/补偿：

- 迁移替换定价、下单/预购函数，新增私有配置/领取账本、权限及审计 RPC；已有订单函数仅变更等级/数量定价上下文与快照，仍需完整 schema 场景验收。现有商品原价、毛利公式、退款累计和历史订单不回填。
- 上线前保留当前部署 ID 与受影响函数原定义。新旧报价 RPC 列兼容，可先回滚应用到已验证上一部署；不要直接删除新表或领取账本，不自动逆转新发促销。
- DB 出现问题采用经独立审查、重新批准的前向修复；如需恢复函数，使用保存的准确原定义，明确可能重新出现旧等级/报价问题。活动可经授权停发未来权益，已发权益和幂等账本保留；任何客户补偿单独列精确清单审批。
- SKU 3667075243373 的 €14/€15 倒挂只列异常，不擅自纠正；5 个毛利不足目标商品按用户选择不在本次处理。
