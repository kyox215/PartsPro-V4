# P1-2026-08-27-simplified-rma-flow

状态：proposed

看板目录：now

优先级：P1

Task ID：TASK-20260827-01

风险等级：R3

自治等级：L2

## 老板原始目标

查看下项目的退货流程，客户退货的话要加上上传或拍照图片留做记录，然后看看还有什么可以完善的关于退货流程的，给我一份规划。

## 目标

在现有 PartsPro 售后申请基础上，规划一个可执行的简化退货 V1：客户从真实订单行进入，用一页三块完成申请、证据上传和处理方式选择；后台用六个队列处理审核、收货、质检、退款/换货和库存处置；所有关键动作可追踪、可审计，并为后续法律、物流和财务扩展保留契约。

## 业务影响

退货同时影响客户信任、订单归属、法定权利、退款/换货、库存和隐私。第一版必须降低填错订单、证据缺失、重复申请、越权读附件、错误退款和库存漂移的风险；不把 B2C 法定撤回/保修与 B2B 商业退货规则混为一谈。

## 完成定义

完成定义分为“规划完成”和“未来实施完成”两层：

1. 本批次：本任务卡经老板/主代理审阅，业务规则、数据契约、状态机、批次、批准门、验收、发布和回滚边界明确；不产生业务代码、migration、远端写入或部署。
2. 未来实施：客户能从订单行进入并提交符合规则的退货申请；质量/损坏/发错类申请至少有一张图片；图片最多 6 张、单张压缩后不超过 4MB，V1 不支持视频；后台能在六个队列内完成审核、收货、质检、退款/换货和库存处置；客户只看到五个业务阶段；附件、状态、退款、库存和通知均有权限控制与审计证据。

## 主责部门

订单运营部

## 协作部门

仓库库存部、平台发布部、文档审计部、价格与客户部

## 工程守门代理

PartsPro 业务契约代理、Next.js 16 App Router 代理、Supabase Migration 守门代理、Supabase RLS/权限代理、前端体验代理、Vercel 发布代理

## RACI

| Role | Owner |
|---|---|
| Responsible | 订单运营部 |
| Approver | Hexiang Huang / Chinatech 老板 |
| Consulted | 仓库库存部、PartsPro 业务契约代理、价格与客户部、Supabase RLS/权限代理 |
| Informed | 平台发布部、文档审计部、Next.js 16 App Router 代理、前端体验代理、Vercel 发布代理 |

## 现状证据

- 客户页入口和登录边界：`src/app/rma/page.tsx:12-29`。
- 客户 API 已按订单行反查归属并校验剩余数量：`src/app/api/rma/route.ts:123-163`；但上传附件仍可选：`src/app/api/rma/route.ts:41-55`。
- 客户界面已有原因/症状/安装/损坏和证据清单，但文件选择没有明确拍照能力，且允许无文件提交：`src/components/partspro/rma-page.tsx:752-800`。
- 当前上传接口会把文件写入私有 `rma-evidence`，单文件上限 20MB，使用 service role：`src/app/api/rma/evidence/route.ts:17-100`；上传与创建 RMA 分为两个请求，失败可能留下孤儿对象：`src/components/partspro/rma-page.tsx:466-502,1586-1606`。
- 当前附件元数据由客户端提交 path/bucket，签名逻辑只按 bucket 判断：`src/app/api/rma/route.ts:19-55`、`src/lib/partspro-rma-evidence.ts:36-58`；后续实现必须改为服务端 upload ticket/attachment ID，不信任客户端 path。
- 可售后订单目前只按 `shipped/completed/delivered` 判断，没有执行期限：`src/lib/partspro-repository.ts:11272-11323,14109-14115`；商品虽有 `rmaDays`，但不能代替法律政策或购买时快照：`src/lib/partspro-data.ts:78-114`。
- 数量是先读取累计值再插入，数据库 trigger 只校验单次数量，存在并发超量风险：`src/lib/partspro-repository.ts:11300-11323`、`supabase/migrations/20260525133225_allow_customer_owned_rma_order_lines.sql:45-102`。
- 后台 RPC 没有完整状态转移矩阵，`close`、退款和状态 PATCH 的前置条件不足：`supabase/migrations/20260628134442_rma_admin_workflow_v2.sql:302-446,579-698`；后台大部分动作对任意状态展示：`src/components/partspro/admin-rma-panel.tsx:650-719`。
- `restock_return` 调库存 RPC，但 `mark_scrapped` 仅记录 disposition：`supabase/migrations/20260628134442_rma_admin_workflow_v2.sql:649-692`；该差异必须在库存契约中明确，不允许形成账实不一致。
- 客户 DTO 只移除 `internalNote`，可能携带内部分配、库存和退款引用字段：`src/app/api/rma/route.ts:191-200`、`src/lib/partspro-data.ts:182-215`。
- 当前通知类型只有订单和客服，无 RMA 通知：`src/lib/partspro-notifications.ts:33-42`、`supabase/migrations/20260628200214_browser_notifications_v2.sql:31-73`。
- 既有任务已明确：2026-06-20 只实现订单行选择，文件当时是本地提示；2026-06-28 实现后台退款/库存处置，但假设不接外部物流、邮件、银行卡退款，报废只记录 disposition：`docs/tasks/now/P1-2026-06-20-account-rma-selection-flow.md:60-70,126-155`、`docs/tasks/done/P1-2026-06-28-rma-admin-workflow-v2.md:51-64`。本任务是下一版规划，不把历史验收描述当作新需求已完成的证明。

## 第一版冻结业务规则

以下是本计划默认规则；实现前须由老板确认，涉及意大利消费者法、税务或支付的部分必须经过专业政策/法务确认。

### 客户入口和一页三块

客户从订单详情或个人中心的订单行进入，不能手填订单号、SKU 或订单行 ID。页面只保留三块：

1. **订单与商品**：服务端返回当前客户可操作的订单行；数量默认 `1`，允许选择不超过服务器计算的剩余数量。
2. **问题与处理方式**：使用六种原因选项、必要补充说明和三选一处理方式。
3. **证据与提交**：拍照/相册选择、压缩、预览、提交摘要和隐私提示。

### 六种原因

V1 默认原因码：

1. `quality_defect`：商品质量/功能故障。
2. `shipping_damage`：运输损坏。
3. `not_as_described`：与描述/规格不符。
4. `wrong_item`：发错商品。
5. `missing_or_quantity_error`：少件或数量错误。
6. `withdrawal_no_longer_needed`：普通撤回/不再需要。

`withdrawal_no_longer_needed` 只适用于政策允许的场景；不能把 B2C 法定撤回、B2C 法定保修和 B2B 商业退货用一个 `rmaDays` 规则代替。上线前必须由意大利政策/法务确认适用范围、期限、例外、运费责任和证明要求。

### 图片规则

- `quality_defect`、`shipping_damage`、`wrong_item` 至少上传 1 张图片；建议分别提示缺陷、包装/物流标签、收到商品的照片。
- `not_as_described`、`missing_or_quantity_error` 默认至少 1 张图片，若业务确认可由订单证据替代才允许豁免并记录原因。
- `withdrawal_no_longer_needed` 图片可选。
- 最多 6 张图片；V1 不支持视频；每张在客户端压缩后不超过 4MB，服务端仍需重新校验字节、MIME 和魔数。
- 移动端提供“拍照”和“从相册选择”；拍照不等于允许绕过服务端校验。
- 图片必须归属于当前用户、订单行和 RMA 草稿；RMA 创建失败/用户放弃后由清理任务删除未提交对象。

### 处理方式

客户三选一：

- `replacement`：换货。
- `refund`：退款，具体原支付方式/可用方式须经支付和法律政策确认。
- `wallet_credit`：钱包余额。

当前库中已有 `replacement/refund/credit_note` 兼容值；实现前必须确定 `wallet_credit` 与旧 `credit_note` 的映射和迁移策略，不可静默改变历史数据语义。

### 客户五个阶段

客户只看到五个主阶段：

1. 已提交：`submitted`。
2. 审核中：`under_review`。
3. 已批准/等待寄回：`approved` 或等待客户动作。
4. 已收货/检测中：`received`。
5. 已完成：`refunded`、`replacement_sent` 或完成关闭。

`rejected`、客户取消和过期是异常/终止结果，必须有可读原因，不伪装成正常五阶段。

### 后台六个队列

后台默认展示六个互斥工作队列：

1. 新申请：待分配/待初审。
2. 审核中：需要判断资格、证据或补充资料。
3. 待客户寄回：已批准，等待客户寄出/提交物流信息。
4. 待收货质检：包裹已到或需要登记收货、数量和质检。
5. 待退款/换货：质检结果已确定，等待退款或替换发出。
6. 待库存处置/关闭：回补、报废、供应商退回或完成关闭。

## 建议状态机与守卫

```text
submitted
  -> under_review
  -> rejected | approved
approved
  -> return_required
  -> received
  -> qc_passed | qc_failed
qc_passed
  -> refund_pending | replacement_pending
  -> restock | scrap | supplier_return
refund_pending
  -> refunded
replacement_pending
  -> replacement_sent
refunded | replacement_sent
  -> closed
```

守卫必须由数据库 RPC/事务执行：

- 订单行归属、客户/成员上下文、政策类型和 `eligible_until`；
- 订单行锁 + 非终止 RMA 数量累计，防止并发超量；
- 必填图片、附件 committed/扫描通过；
- `received` 只能由收货动作产生；退款需资格审核和质检结果；
- `restock/scrap/supplier_return` 需收货、数量、批次/仓位和原因；
- `closed` 只能在退款/换货/库存处置完成后；
- 所有状态变化写入 append-only event，区分 customer-visible 与 internal。

## 数据、API 与权限契约

### 数据契约

继续以 `rma_requests` 为历史兼容根，但新增/重构时明确以下字段边界：

- 订单与资格：`order_id`、`order_line_id`、`customer_id`、SKU/名称/数量/单价/税/运费快照、`policy_scope`、`policy_version`、`eligible_until`。
- 客户申请：`reason_code`、症状、安装/测试、损伤、序列号/IMEI（适用时）、备注、`requested_resolution`、`idempotency_key`。
- 附件：独立 `attachment_id`、`rma_id`、分类、owner、私有 path、MIME、size、hash、scan 状态、`committed_at`、上传时间；客户端不得提交任意 bucket/path。
- 物流与收货：RMA 编号、退回地址、carrier、tracking、客户寄出时间、收货时间、收货数量、包装照片。
- 质检：检验人、结果、条件、实验室结论、质检备注和质检附件。
- 结果：批准动作、退款方式/金额/币种、wallet/payment/refund ID、replacement order ID。
- 库存与审计：处置、数量、批次、仓位、stock movement ID、actor、前后状态、原因和 customer-visible 标记。

### 客户 API

- `GET /api/rma`：仅返回当前账号的 customer DTO、五阶段状态、可操作订单行、`eligible_until`、上传策略；不能返回内部负责人、钱包请求内部 ID、内部备注或任意存储 path。
- `POST /api/rma/uploads`（或兼容现有 evidence route）：先签发短期、用户/订单行绑定的 upload ticket；上传后服务端校验并返回 opaque `attachmentId`。
- `POST /api/rma`：接受 `orderLineId`、数量、原因码、处理方式、补充说明、attachment IDs、`idempotencyKey`；由服务端从订单行推导订单/客户/SKU，事务内完成资格、数量、附件归属和必填证据校验。
- 所有重试必须幂等；客户端不能用提交的 `orderId/sku/path/signedUrl` 覆盖服务端事实。

### 后台 API 与权限

- 列表、详情、状态和动作按 `rma.read`、`rma.manage`、`rma.refund`、`rma.inventory` 分离；`orders.read/manage` 只能作为已批准的兼容映射，不应自动获得私有证据权限。
- 后台更新接口只接受合法状态转移和动作专用字段；退款、库存、质检和关闭必须有独立权限与审计。
- 签名 URL 仅在经过 RMA/用户/角色授权后按需生成，短时有效；不把永久 URL 写入公共 DTO。

### 通知契约

新增受控的 RMA 通知类型：新申请、补资料、已批准、待寄回、已收货、质检完成、退款/换货完成、已关闭、超 SLA。通知 payload 只含订单号/RMA 编号和安全摘要，不含内部备注、附件 path 或支付秘密。

### 库存与退款契约

- 收货默认 `quarantine`，不自动增加可售库存。
- 回补、报废、供应商退回必须使用统一 RMA 库存处置 RPC，原子更新库存、movement 和 RMA event；报废不能只改文字 disposition。
- 退款金额必须基于订单行实际支付快照和明确税费/运费政策；钱包请求与 RMA 使用专门关联类型，审批和入账状态分开记录。
- 换货必须关联 replacement order/出库动作；不得用“状态改成 replacement_sent”代替发货事实。

## 范围

- 页面：客户订单详情、`/account`、`/rma`；后台 RMA panel、收货/质检/库存处置工作区。
- API：客户 RMA/附件接口、后台 RMA 列表/详情/action、通知接口；必要时新增退款/换货关联接口。
- 数据表/RPC：`rma_requests`、`rma_request_events`、附件记录/Storage、`orders`、`order_lines`、库存表与 movements、钱包退款、通知事件；新增 migration 仅在后续批准后进行。
- 文档：本任务卡、后续 ADR、政策确认、runbook、验收记录和风险登记。
- 外部系统：V1 不接第三方物流/邮件/WhatsApp；支付原路退款可行性、意大利法定政策和税务处理需在上线前确认。

## 非目标

- 本批不写业务代码，不改现有客户/后台 UI，不创建或修改 Supabase migration，不应用远端数据库，不部署 Vercel。
- V1 不支持视频、自动打印物流标签、第三方承运商 API、自动现金/银行卡退款、自动库存回补或自动批准。
- 不用 `rmaDays` 削弱 B2C 法定撤回/保修；不把 B2C 和 B2B 规则合并成一个无条件窗口。
- 不通过客户端 path、service role key、绕过 RLS 或临时权限扩大来实现上传/查看。
- 不覆盖主工作区或其他代理的未提交改动。

## 假设与未知项

- 默认订单行是唯一客户入口；多账号共享同一客户时，数量和可见性按客户/订单归属契约统一计算，需业务契约代理确认。
- “退款”是否能回原支付方式、是否允许仅钱包、税费/运费由谁承担，需老板、财务和意大利政策/法务确认。
- 商品是否有序列号/IMEI、质检标准、批次和仓位字段，以及退回件是否已进入实际库存，需仓库库存部确认。
- 当前历史状态、附件 JSON 和钱包 `order_void` 语义需要迁移映射；不得直接删除历史值。
- Next.js 16 实施批次修改 Route Handler 或 Server/Client 边界前，必须先阅读当前 worktree `node_modules/next/dist/docs/` 对应官方指南；本批无业务代码，因此不执行该读取或代码验证。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 风险/退出条件 |
|---|---|---|---|---|
| WP-00 政策与契约冻结 | 订单运营部 + 价格与客户部 | B2C/B2B policy scope、六原因、五阶段、六队列、退款/运费规则 | 老板、意大利政策/法务、财务 | R3；批准并形成 ADR/政策版本 |
| WP-01 资格与数量守卫 | 业务契约代理 + Supabase Migration/RLS 守门 | 订单行锁、期限、客户归属、幂等创建 RPC | WP-00 | R3；并发、过期、跨账号测试通过 |
| WP-02 图片上传闭环 | Next.js 代理 + 前端体验 + RLS/Storage 守门 | 拍照/相册、压缩、6 图/4MB、ticket、扫描、commit/GC | WP-00、WP-01 | R3；越权 path、失败清理、恶意 MIME 测试通过 |
| WP-03 客户一页三块 | 前端体验代理 + Next.js 代理 | 订单行入口、原因/处理方式、图片必填提示、五阶段 DTO | WP-01、WP-02 | R2；390/430px 和 it/zh 文案验收通过 |
| WP-04 后台六队列与质检 | 订单运营部 + 仓库库存部 | 队列、收货、QC、退款/换货、库存处置界面和动作 | WP-00、WP-01 | R3；每个动作有角色、守卫和事件 |
| WP-05 通知与隐私 | 平台发布部 + RLS/权限 + 文档审计部 | RMA 通知、customer/admin DTO、签名 URL 权限、保留/清理策略 | WP-02、WP-04 | R3；客户隔离、通知不泄露内部数据 |
| WP-06 验证与发布 | Vercel 发布代理 + 全部守门 | 最小/最终验证、迁移门、发布观察和回滚 runbook | WP-01~05 | R3；无旧 migration 夹带，smoke/E2E/观察通过 |

## 批准要求

- 是否需要老板批准：需要；本卡是规划批次，实施前还需批准政策、退款方式和数据迁移方案。
- 是否需要意大利政策/法务确认：需要；尤其是 B2C 撤回、法定保修、期限、运费、退款方式和 B2B 规则。
- 是否需要 Supabase migration 安全门：需要；任何表、RPC、RLS、Storage policy 或约束变更均需 dry-run、风险扫描和应用后验证。
- 是否需要 Vercel 发布门：需要；发布与 migration 分离，不能用部署证明数据库已更新。
- 是否需要 PartsPro 业务契约验收：需要；订单、客户、退款、库存和状态机必须共同验收。
- 是否需要独立审查：需要；WP-01/02/04/05 属于权限、隐私、持久化、支付和库存高风险批次，需相应守门代理专项审查。

## 验收标准

### 规划批次验收

- 本卡位于 `docs/tasks/now/`，状态为 `proposed`，包含范围、非目标、契约、工作包、批准、验收、验证、发布/回滚和残余风险。
- 冻结规则明确：一页三块、默认数量 1、六原因、图片规则、最多 6 张/4MB、V1 无视频、退款/换货/钱包三选一、客户五阶段、后台六队列。
- 明确 B2C 法定撤回/保修与 B2B 商业退货分离，以及上线前意大利政策/法务确认门。
- 任务卡提交仅包含该文件，主工作区未提交改动未被修改。

### 未来实施验收

- 客户只能从有权限的真实订单行进入；服务端拒绝越权订单行、过期政策和并发超量。
- 质量/损坏/发错等必需原因没有图片时无法提交；拍照和相册均可用；超过 6 张、超过 4MB、视频、伪造 MIME/path 均被拒绝。
- 上传失败、重复点击、创建失败不会产生重复 RMA、重复退款或长期孤儿对象。
- 后台六队列和状态机由服务端守卫；质检、退款/换货、库存处置和关闭都有角色和事件审计。
- 客户只看到五阶段及允许公开的备注/附件；客户 A 不能读取客户 B 或内部附件/备注。
- RMA 通知、库存 movement、退款入账和 replacement order 可从 RMA 编号关联并对账。

## 最小验证集合

规划提交时至少执行：

```bash
git status --short --branch
git diff --check
git diff --name-only origin/main...HEAD
git log -1 --oneline
```

未来代码批次最小集合：

- Route/API：未登录 401、无权限 403、订单行越权 404、过期/超量 409、重复幂等。
- 附件：拍照/相册、压缩后大小、6 张上限、视频拒绝、魔数/MIME、path/ticket 归属、失败清理和签名 URL 权限。
- 数据库：订单行并发锁、资格窗口、状态转移矩阵、RLS、Storage policy、customer-visible event、退款幂等、库存处置原子性。
- UI：390/430px、空/错/离线/403/重复提交、it-IT/zh-CN 文案和可访问性。

## 最终验证集合

实现里程碑或发布候选必须按风险执行：

```bash
python3 /Users/kyox215/.codex/skills/partspro-fullstack-audit/scripts/contract_scan.py --root . --markdown /tmp/partspro-rma-simple-flow-contract-scan.md --json /tmp/partspro-rma-simple-flow-contract-scan.json
npx tsc --noEmit
git diff --check
npm run lint
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db lint --linked --schema public,private,storage --level error --fail-on error
```

在预览/受控环境完成客户移动端 E2E、后台六队列 E2E、RLS/Storage 隔离、并发数量、退款幂等、库存 movement 和通知验证后，才可申请生产门。任何 linked 目标不明、旧 pending migration 夹带、危险权限/数据回填、lint/build 失败或验证证据缺失均为 NO-GO。

## 发布与回滚方案

- 本批次不发布、不应用 migration。
- 未来采用 additive migration + feature flag；先部署兼容代码，再在确认 linked 状态、dry-run 和备份/回滚方案后应用 schema，最后独立发布和 smoke test。
- 发布前保留旧客户 RMA 读取和历史状态映射；新图片策略可按原因/客户组灰度，不直接强制历史申请补图。
- 发现问题时先关闭 feature flag/回退入口，保留已提交 RMA 和事件；退款、库存和换货使用反向/冲正动作，不使用 `db reset`、批量删除或手工覆盖历史。
- 生产观察至少覆盖附件失败率、重复 RMA、状态卡住、退款待审批、库存差异、RLS 403/越权告警和通知失败率；观察未完成前任务状态为 `observing`，不得关闭。

## 禁止事项

- 不在本批次修改业务代码、schema、migration、RLS、Storage policy、权限、生产数据或环境变量。
- 不 push、不部署、不访问或写入远端 Supabase/Vercel。
- 不把 `rmaDays` 当作意大利法定规则，不向客户承诺未经确认的退款/运费政策。
- 不在浏览器暴露 service role key，不接受客户端任意 Storage path/bucket/signed URL。
- 不自动批准退款、自动回补库存、自动替换发货或绕过质检。
- 不删除、回退、清理主工作区或其他代理的未提交改动。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git worktree add -b codex/rma-simple-flow-20260827 ... origin/main` | passed | 隔离 worktree 创建成功，基线为 `de2132b51c0df06fae5476aac6bbae53beea958f` |
| 指定治理/项目/RMA 文档读取 | passed | AGENTS、TASK_FLOW、TEMPLATE、章程、roadmap、风险、决策和两份既有 RMA 任务卡已完整读取 |
| 本批业务代码/migration/远端写入 | not run | 明确禁止；本批仅提交规划任务卡 |
| `git diff --check` | passed | 提交前已对唯一暂存文件执行 `git diff --cached --check`，无空白错误 |

## 执行记录

- 创建：2026-08-27
- 批准：pending；本卡等待老板/主代理审阅
- 开始：2026-08-27
- review：pending
- verified：pending；提交前完成文档级验证
- released：不适用，本批不发布
- closed：pending

## 结果

本批交付一份隔离分支上的简化 RMA V1 规划任务卡。只记录规划和批准门，不声明任何代码、数据库、生产上传、退款或库存功能已经实现；后续实施必须按 WP-00 至 WP-06 分批，经对应业务/工程守门和生产安全门批准后执行。

## 残余风险与后续任务

- 意大利 B2C 撤回/保修、B2B 商业退货、退款方式、运费承担和税务处理尚未由专业人员确认。
- 当前历史 RMA 状态、附件 JSON、wallet `order_void` 语义和库存处置数据需要迁移前盘点。
- 当前附件上传、状态机、期限、并发数量、DTO 隔离和通知缺口仍存在；本卡不修复这些问题。
- 后续应分别创建政策 ADR、RMA data/RPC migration 任务、图片上传安全任务、后台 QC/库存任务、退款/换货任务和发布观察 runbook。
