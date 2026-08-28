# P1-2026-08-27-simplified-rma-flow

状态：in_progress

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

1. 批次 0：本任务卡经老板/主代理审阅，业务规则、数据契约、状态机、批次、批准门、验收、发布和回滚边界明确。
2. 当前批次 1：在隔离 worktree 中实现 additive Migration A、共享 RMA 契约、opaque draft/upload/complete/submit Route Handlers、服务端证据校验、admin v3 action ledger 和专项源契约测试；保留严格守卫的 legacy 双协议桥接，不改客户/后台 UI 或 i18n，不进行远端写入或部署。
3. 未来实施：客户能从订单行进入并提交符合规则的退货申请；质量/损坏/发错类申请至少有一张图片；图片最多 6 张、单张压缩后不超过 4MB，V1 不支持视频；后台能在六个队列内完成审核、收货、质检、退款/换货和库存处置；客户只看到五个业务阶段；附件、状态、退款、库存和通知均有权限控制与审计证据。

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
- 当前上传接口会把文件写入私有 `rma-evidence`，单文件上限 20MB，使用 service role：`src/app/api/rma/evidence/route.ts:17-100`；上传与创建 RMA 分为两个请求，失败可能留下孤儿对象：`src/components/partspro/rma-page.tsx:466-502,1586-1606`。本批保留该历史图片/视频能力作为临时桥接，新 draft 路径另行强制图片/4MB/6张。
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

- `quality_defect`、`shipping_damage`、`wrong_item` 至少上传 1 张图片；建议分别提示缺陷、包装/物流标签、收到商品的照片。对 `policy_scope = statutory_b2c_withdrawal`，法定无理由撤回可不填原因且照片可选；若客户仍选择缺陷/损坏/发错等原因，仍执行对应证据门槛。
- `not_as_described`、`missing_or_quantity_error` 默认至少 1 张图片，若业务确认可由订单证据替代才允许豁免并记录原因。
- `withdrawal_no_longer_needed` 仅在明确激活的 `statutory_b2c_withdrawal` 政策下图片可选；当前 PartsPro 章程是 B2B，canonical scope 为 `b2b_commercial`，所以 legacy、warranty 和 B2B（包括“不再需要”）均至少一张图片。法定撤回代码保留但未激活，不能由 retail/wholesale 价格类型推断。
- 新 draft/ticket/complete/submit 路径最多 6 张图片；V1 新流程不支持视频；每张在客户端压缩后不超过 4MB，服务端仍需重新校验字节、MIME、魔数和 SHA-256。Migration A 不收紧既有 `rma-evidence` bucket，legacy 双协议临时保留 20MB 图片/视频；bucket 收紧留给 Migration B。
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
- 当前批次新增 `POST /api/rma/drafts`、`POST /api/rma/drafts/:draftId/uploads`、`POST /api/rma/drafts/:draftId/attachments/:attachmentId/complete`：先签发短期、用户/订单行绑定的 upload ticket；上传后服务端重新读取 Storage 校验并返回 opaque `attachmentId`。旧 multipart evidence route 继续严格生成当前用户前缀下的兼容对象，保留 20MB 图片/视频能力，不接受客户端自选 path。
- 当前批次新增 `POST /api/rma/submit`，并让 `POST /api/rma` 进入同一严格 handler：新协议要求 `draftId`，接受 `orderLineId`、数量、原因码、处理方式、补充说明、attachment IDs、`idempotencyKey`；由服务端从订单行推导订单/客户/SKU，事务内完成资格、数量、附件归属和必填证据校验。`POST /api/rma` 同时仅在识别为旧字段集合时进入严格过滤的 legacy 分支，旧 path/bucket/signedUrl 不作为服务端事实。
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

- 规划范围页面：客户订单详情、`/account`、`/rma`；后台 RMA panel、收货/质检/库存处置工作区。当前批次不改页面。
- 当前批次 API：客户 RMA draft/upload/complete/submit、兼容 GET/旧 POST 边界、后台 RMA action v3/legacy wrapper；通知接口和完整 UI 仍属后续批次。
- 当前批次数据表/RPC：`rma_requests`、`rma_request_events`、`rma_drafts`、`rma_attachments`、`rma_action_executions`、Storage、库存 movement、钱包退款和通知兼容字段；Migration A 仅在隔离分支生成，不应用远端。
- 文档：本任务卡、后续 ADR、政策确认、runbook、验收记录和风险登记。
- 外部系统：V1 不接第三方物流/邮件/WhatsApp；支付原路退款可行性、意大利法定政策和税务处理需在上线前确认。

## 非目标

- 当前批次 1 只实现服务端契约/API 与 additive Migration A；不改现有客户/后台 UI 或 i18n，不应用远端数据库，不部署 Vercel。
- 新 V1 流程不支持视频（legacy 兼容桥暂保历史图片/视频）；不支持自动打印物流标签、第三方承运商 API、自动现金/银行卡退款、自动库存回补或自动批准。
- 不用 `rmaDays` 削弱 B2C 法定撤回/保修；不把 B2C 和 B2B 规则合并成一个无条件窗口。
- 不通过客户端 path、service role key、绕过 RLS 或临时权限扩大来实现上传/查看。
- 不覆盖主工作区或其他代理的未提交改动。

## 假设与未知项

- 默认订单行是唯一客户入口；多账号共享同一客户时，数量和可见性按客户/订单归属契约统一计算，需业务契约代理确认。
- “退款”是否能回原支付方式、是否允许仅钱包、税费/运费由谁承担，需老板、财务和意大利政策/法务确认。
- 商品是否有序列号/IMEI、质检标准、批次和仓位字段，以及退回件是否已进入实际库存，需仓库库存部确认。
- 当前历史状态、附件 JSON 和钱包 `order_void` 语义需要迁移映射；不得直接删除历史值。
- 本批修改了 Route Handler、server-only RMA helper 和 Supabase RPC 契约；已先读取主仓库 `node_modules/next/dist/docs/` 中 Next.js 16 Route Handler 与 Server/Client 指南，并执行定向测试/lint。worktree 本身无独立 `node_modules`，不得用 npm install 规避依赖缺失。

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

- 本卡位于 `docs/tasks/now/`，状态为 `in_progress`，包含范围、非目标、契约、工作包、批准、验收、验证、发布/回滚和残余风险。
- 冻结规则明确：一页三块、默认数量 1、六原因、图片规则、最多 6 张/4MB、新 V1 无视频（legacy 桥暂保历史视频）、退款/换货/钱包三选一、客户五阶段、后台六队列。
- 明确 B2C 法定撤回/保修与 B2B 商业退货分离，以及上线前意大利政策/法务确认门。
- 任务卡提交仅包含该文件，主工作区未提交改动未被修改。

### 当前批次 1 验收

- Migration A 只扩展表、约束、兼容 RPC 和关系字段；不修改既有 bucket、不撤销 `rma_requests/events` 旧 direct grants/RLS。新 draft/attachment/action ledger 启用 RLS 且不给客户端直接写；bucket 收紧和最终撤权均留给 Migration B，生产上线前为 NO-GO。
- 客户新提交使用严格 allowlist、必需 `draftId` 和 opaque attachment ID；服务端绑定登录用户、客户、订单行、可退订单状态、累计数量、六原因、六图/4MiB、MIME/魔数/SHA-256 和幂等键。当前 canonical `b2b_commercial` 包括“不再需要”也必须有图片；法定 B2C 分支仅保留为未来经批准配置启用的可选 reason/photo 例外。
- 旧 multipart evidence 与旧 JSON POST 仅作为严格 owner/bucket/path 过滤的滚动兼容桥；GET 关系表附件返回 opaque ID + 临时签名 URL，无法证明归属的旧 signed URL 不回显。
- 管理员动作经 `admin_perform_rma_action_v3` 和 legacy wrapper 进入锁定/ledger；review PATCH 不能确认退款金额，收货只记 quarantine，显式 QC 后商业结果与库存处置分轴执行；restock 需明确 batch/location 且只执行一次，报废/供应商退回不错误扣可售库存，钱包请求使用 `rma_return` 并受明确批准数量的订单行快照金额上限。

### 批次 1b 阻断项修正记录（2026-08-28）

- 恢复 `/api/rma/evidence` 与旧 `/api/rma` POST 的双协议兼容，旧上传继续使用私有 `rma-evidence` 的历史 20MB 图片/视频能力；服务端只生成当前用户专属前缀，旧 path/bucket/signedUrl 不作为可信事实。客户 GET 优先从 `rma_attachments` 关系表按 owner 查询并返回 opaque ID + 临时签名 URL，无法重新证明归属的旧 signed URL 被移除。
- 新 submit schema 与实现均要求 `draftId`；草稿只能从 `open` 提交，过期/取消/已关闭草稿不能重新提交。附件失败可调用取消 RPC，释放有效配额，Storage 删除失败保留可观测补偿风险。
- `admin_update_rma_request` 收紧为 `rma.manage` 审核接口，仅允许 `submitted -> under_review -> approved|rejected` 与安全备注；v3 增加 `record_qc`，商业结果与库存处置独立，库存动作不自动关闭；收货只允许 approved，退款/换货/库存处置均需收货和明确 QC。
- 钱包采用新 `rma_return` 类型，并在请求/批准前按订单行单价快照 × 实收/批准数量 − 已退款 RMA 与整单可退余额双重封顶；不自动原路退款或生成税务 credit note。换货要求不同且已 shipped 的同客户订单、同 SKU/足量并建立唯一关联；restock 缺少明确 batch/location 时拒绝。
- `policy_scope = statutory_b2c_withdrawal` 独立允许法定 B2C 无理由撤回不填原因/照片；缺陷、损坏、发错等原因仍要求至少一张图，B2B 规则不合并。意大利政策/法务、Migration B 撤权及生产应用仍是上线 NO-GO。

### 批次 1c 复审修正记录（2026-08-28）

- 商业结果数据库级防双赔：`request_wallet_refund` 与 `mark_replacement_sent` 由 RMA 行锁、action ledger 唯一守卫、RMA 钱包唯一索引和 wallet approval BEFORE guard 互斥；钱包被拒后保持 fail-closed，不自动改选换货。review PATCH 保留旧 `refundAmount` 签名但只记录“已忽略”，金额只能由受权限的退款 action 确认。
- draft/submit 使用同一显式归属函数：普通 customer 必须 active membership，历史 `orders.user_id` 不再授权；employee 只能是 `profiles.account_type = employee` 且绑定本人 `customers.profile_kind = employee_self` 的订单，employee 不复用 membership。新 draft 固定 `policy_scope = b2b_commercial`、`policy_version = partspro-b2b-v1`。
- 上传配额在用户 advisory lock 内先过期 pending/verified，再计算每草稿 6 张与每用户 24 张活动附件；取消会释放数据库额度并 best-effort 删除 Storage；增加 service-role-only batch GC 函数，生产 cron 仍未启用。
- 共享可执行规则覆盖 policy×reason×0/1 图、QC/双轴 close、商业互斥和退款上限；submit 保存包含 draft/orderLine/quantity/reason/resolution/note/排序附件 ID 的 fingerprint，draft/submit/action 幂等冲突不依赖裸 23505。
- inventory disposition 只写 `inventory_disposition`，商业动作与库存终态可独立完成；已收货 RMA 只有在商业终态与库存终态都完成后关闭，QC 成功 exactly-once。替换明确使用实收数量并校验同客户已发货订单同 SKU 足量。
- 复审补充：legacy POST 也必须带至少一份经过当前用户专属 path/bucket 校验的证据；新/旧附件失败均先取消数据库额度，再 best-effort 删除 Storage。无不可变单价快照的历史 RMA 不允许直接发起钱包退款，需受控人工补建快照或后续迁移方案。

### 批次 1d 最后核心修正（2026-08-28）

- 历史 `partspro_rma_order_line_guard` 使用的 `private.enforce_rma_order_line()` 已在 Migration A 中 `CREATE OR REPLACE`，订单归属与 legacy INSERT policies 统一调用 `private.rma_user_can_access_order`；净数量统一调用 `private.rma_order_line_returnable_quantity`。普通 customer 仅 active membership，employee 仅 employee-self 分支，历史 `orders.user_id` 不再构成授权。
- V1 不支持拆分商业/库存 ledger：收货、退款、换货、restock、scrap、supplier_return 省略数量时取完整 RMA 数量，传部分数量直接拒绝；close 复核完整 received/commercial/inventory 数量。部分收货和拆分处置留待未来数量 ledger，本版本 fail-closed。
- 退款上限统一为 `min(本 RMA 批准数量×不可变单价, 订单行净可退数量×单价−历史该行退款, 整单剩余可退余额)`，submit、退款请求和 wallet approval BEFORE guard 均在订单行锁/行 advisory lock 下使用同一净数量 helper；`P0001` 幂等 payload 冲突映射为 409。
- ticket 失败补偿现在检查 `rma_cancel_attachment` 的 `{ error }` 并输出服务端可观察信号；原始上传错误不被清理失败覆盖，孤儿由受门禁 GC 兜底。修复旧库存调整函数错误访问不存在的 `input.location`，RMA action 仍保留独立 location。

### 批次 1e P1 收口（2026-08-28）

- 历史 `private.enforce_rma_order_line()` 在锁定订单行后累计同一订单行所有非 `rejected` RMA；新建时计入已有请求，更新时排除 OLD/NEW 自身，统一与 `private.rma_order_line_returnable_quantity()` 比较，因此 legacy direct INSERT 也不能绕过多 RMA 数量上限，并保留现有 owner/归属校验。
- 后台 `RmaRequest`/mapper 仅新增必要的流程数量快照：RMA 总量、已收货量、按实际退款或换货结果择一的 `resolutionQuantity`、库存终态处置量。客户 DTO 仍显式 allowlist，不暴露这些后台数量或任何内部字段。
- JS/TS 共享 `isRmaActionAvailable` 现在要求收货、商业结果和库存处置在各自需要的阶段达到完整 RMA 数量；close 同时校验完整数量、QC、双轴终态和退款/换货互斥。纯行为测试覆盖收货、退款结果、换货结果和库存处置的部分/全量数量矩阵。
- 本批未连接本地或远端 PostgreSQL/Supabase，也未应用 migration；双事务并发 trigger 验证留给最终本地数据库门禁。生产仍 NO-GO，Migration B 撤权、兼容直写切换和数据库链路验证不得提前打开。

### 批次 1f close 契约收口（2026-08-28）

- close 的可执行规则现在明确要求 `receivedAt`/`received_at` 非空；终态 status 或完整数量不能单独证明已经收货。已收货 RMA 的退款完成条件同时要求 `status=refunded`、`resolution_action=refund_wallet`、完整退款数量、同一 RMA 的 `rma_return` wallet request 已批准且没有 replacement order；pending/rejected wallet 请求不能关闭。
- replacement 完成条件同时要求 `status=replacement_sent`、`resolution_action=replacement`、完整替换数量、已关联不同的 replacement order 且没有 wallet refund request；退款和换货混合状态、缺 linkage 或缺明确收货时间均 fail-closed。未收货 rejected 的既有终止关闭例外仍保留，不把它当作已收货流程。
- 后台 `RmaRequest` 与 mapper 输出最小 admin-only `qcStatus`、`replacementOrderId`、`walletRefundStatus`；admin 列表和 RPC 详情通过一次按 RMA ID 批量查询读取 `wallet_refund_requests` 状态，客户 DTO 继续不暴露这些字段及其他内部字段，避免 N+1 与信息越界。
- Migration A close guard 与 JS 规则成对收紧；未修改客户/后台 UI、未撤权、未收紧历史 bucket，生产仍 NO-GO。wallet 状态关系/替换单状态的实际数据库验证留给本地 PostgreSQL/linked 安全门。

### 批次 2a 客户图片准备与新协议上传客户端（2026-08-28）

- 新增 `src/lib/partspro-rma-upload-client.mjs`，并由共享 TS contract 复用同一组 `rmaMaxAttachments`、`rmaMaxAttachmentBytes` 和 `rmaAttachmentContentTypes`；选择器拒绝视频/不支持 MIME，限制最多 6 张，HEIC/HEIF 超过 4MB 直接给出可理解的错误，栅格图片可在浏览器按需无放大缩放并逐级压缩到 4MB 内。
- 客户端编排严格使用新 opaque 协议：创建 draft、逐张领取 ticket、以 `FormData(cacheControl=3600, 空字段名文件)` 对签名 URL `PUT`（`x-upsert:false`）、对实际 Blob 计算 SHA-256、调用 complete，再以显式 allowlist payload 提交 `/api/rma/submit`；每张图片的 ticket 流程最多自动重试一次，失败 ticket best-effort DELETE，最终 payload 不包含 bucket/path/signed URL/order/SKU。
- 新增 `tests/rma-upload-client.test.mjs`，实际覆盖六张上限、MIME/视频拒绝、4MB/HEIC 边界、SHA-256、FormData/header、complete、重试与补偿删除、opaque payload 和 legacy endpoint 排除。尚未改动 `rma-page.tsx` 或其它客户 UI；浏览器 canvas/真实 Storage 签名上传仍留后续 UI/预览门禁。

### 批次 2b 客户一页式 RMA 接线（2026-08-28）

- `rma-page.tsx` 已替换旧五步/技术检查清单，收敛为订单与商品、原因与处理、照片记录三个块；仅使用共享六原因，并只展示 `replacement` 与 PartsPro `wallet_credit` 两种当前可兑现选择。数量默认 1，剩余数量大于 1 才显示紧凑选择器；`?order=`、`?line=` 自动选中，`?requestId=` 聚焦并高亮历史申请。
- 拍照/相册各自使用隐藏 input（`capture=environment`、`multiple`），仅接受图片；最多 6 张、缩略图/单张删除、上传进度/重试/验证状态和对象 URL 清理均在客户端完成。无照片、B2B“不再需要”无简短说明、订单行或数量无效时不可提交；无确认弹窗，不调用 legacy evidence endpoint，不展示视频或内部状态。
- 单次提交接入 2a `submitRmaWithAttachments`，失败保留本地预览；成功使用安全 `CustomerRmaDto` prepend 最近申请并扣减本地可退数量，客户历史只展示五阶段和关系附件临时链接。现有 storefront locale 仅含 `it-IT`/`zh-CN`，本批文案已补齐两者；英文 locale 尚未存在，需后续单独国际化批次确认。
- UI contract 测试覆盖三块、query 参数、camera/gallery、无视频/legacy、一次提交、无确认 modal 和安全 DTO。真实浏览器 canvas/HEIC 解码、移动端相机权限、CORS signed PUT、网络离线重试及端到端 RMA 结果仍未验证。

### 批次 2c 客户上传恢复与订单显示（2026-08-28）

- 上传客户端新增内存 checkpoint/resume：保存 draft、按图片 identity 的 verified attachment IDs、待确认取消 ticket IDs 和最终 opaque submit payload；最终提交响应丢失时重试只调用 `/api/rma/submit`，不重复创建 draft、ticket 或 complete。
- 失败 ticket 的 DELETE 必须确认 `response.ok`；恢复时先逐个完成待取消动作，取消失败则停止并不发新 ticket。部分图片成功会跳过已 verified 图片；另提供无确认弹窗的安全“重新开始上传”路径，只有全部取消成功才清空 checkpoint。
- 页面用同步 `submittingRef` 防止 React state flush 前双击，checkpoint 或提交期间锁定订单、商品、数量、原因、处理方式、备注、相机/相册和删除入口；“不再需要”备注改为可选，B2B 仍按照片规则处理。Customer DTO 明确增加安全 `orderNumber`，canonical flow 通过同 customer 的订单行读取，legacy DTO 使用既有展示 `orderId` 兼容。
- 2c 测试实际使用内存 fetch mock 覆盖响应丢失只提交、5+1 图片恢复、DELETE 500 后零新 ticket、取消清理、双协议安全边界和 orderNumber 源契约。浏览器刷新后的 File 会话恢复、跨标签并发、真实 Storage/CORS 与移动端相机仍留最终门禁。

### 批次 2d 客户上传放弃清理单向状态（2026-08-28）

- checkpoint 新增 `phase = active | abandoning`。一旦客户选择重新开始，先清空本地 final payload，再把已验证/待取消 attachment ID 进入清理队列；因此即使服务端此前已成功提交，旧 payload 也不会在“重新开始”路径被重放。
- `abandoning` checkpoint 的所有重试只允许继续 opaque attachment DELETE；任一 DELETE 非 2xx 时保留未清理 ID 并停止，不创建新 draft、不领取 ticket、不 PUT、不 complete、也不 POST `/api/rma/submit`。只有全部清理成功才回调清空 checkpoint；下一次提交才是全新的上传流程。
- 客户页在存在 final payload 时把“确认提交”作为推荐恢复动作，并明确提示“重新开始”会放弃恢复并启动清理；清理未完成时按钮改为“继续清理”，避免把清理失败误导成普通重试。意大利语/中文文案同步补齐。
- 新增实际内存 fetch 回归测试覆盖 DELETE `204 -> 500 -> 再次提交`：第二次只继续清理、绝不调用 submit/draft/upload，清理成功后才允许清空恢复状态。真实刷新/跨标签持久化、浏览器/Storage/CORS 和移动端相机仍留最终门禁。

### 批次 2e 后台 RMA 队列派生（2026-08-28）

- 新增 canonical `partspro-rma-workflow-rules.mjs` 与严格 TypeScript wrapper；服务端统一派生 `review`、`awaiting_return`、`receiving`、`qc`、`resolution`、`inventory_close`、`archive` 七个队列和固定动作码。
- 动作按明确的 `manage`、`inventory`、`refund`、`adjustStock` 能力过滤；收货、质检、退款/换货、库存处置和关闭复用 `isRmaActionAvailable`，`assign` 仅在未分配时可选且永不推荐，钱包 pending 保持等待并不自动改选。
- 对缺少 `receivedAt`、完整收货数量或 QC 的历史记录 fail-closed，落到最早安全队列并隐藏下游动作；库存 quarantine/未处分提供 `choose_inventory_disposition` 伪推荐，终态处分且底层 close 合法时才推荐关闭。未连接 PostgreSQL/Supabase，真实 RPC/RLS/并发和后台 E2E 仍留后续门禁。
- `tests/rma-admin-workflow.test.mjs` 覆盖七队列、权限矩阵、钱包 pending、库存三选、close/archive、assign 和历史异常；本批只修改 canonical 规则、wrapper、测试与本任务卡。

### 批次 3 服务端工作台契约、客户一键寄回与 Migration B 候选（2026-08-28）

- 后台列表/详情/动作响应统一由服务端投影 `workflowQueue`、`availableActions`、`recommendedAction`、`blockedReason`；能力只从 `hasAdminPermission` 的 `rma.manage`、`rma.inventory`、`rma.refund`、`product.adjust_stock` 派生。七个 canonical 队列支持查询与兼容旧筛选，列表返回 `queueCounts` 和受 200 条读取上限约束的 `countsComplete`，不把分页计数伪装为全量。
- 后台附件和事件经过 allowlist，附件只保留 opaque ID、必要元数据和短期 signed URL，不回传 Storage path、owner 或事件 metadata；详情增加 staff-only 退款预览及服务端筛选的 `replacementCandidates`（同客户、不同原订单、已发货、同 SKU 足量且未被其他 RMA 关联）。
- review 动作 `start_review`/`approve`/`reject` 分流到 review-only RPC，其余动作继续走 v3；PATCH 仍受数据库审核状态守卫。Migration B 候选以最小 trigger 自动认领首个真实审核/收货/QC/退款/换货/库存/关闭动作，并只为审核状态变化生成客户通知，避免复制 v3 终态通知。
- 客户新增 `POST /api/rma/:requestId/shipped` 与行锁幂等 RPC；carrier/tracking 可选，只有当前 active member 或 employee-self 能对 approved RMA 生效，写 `customer_shipped_at` 和 customer-visible event，客户阶段显示 `return_in_transit`。未声明寄回时库存员工仍可用次要 `mark_received`，寄回后 receiving 队列推荐收货。
- 新增 Migration B 候选 `supabase/migrations/20260828092050_rma_workflow_finalize.sql`：切换后关闭 legacy POST/evidence 写协议、撤销浏览器 direct insert/update、保留授权读取、私有 evidence bucket 收紧为 4MiB/JPG/PNG/WebP/HEIC/HEIF（不删历史对象），并对新增函数显式 search_path、revoke public/anon 后最小 grant。本候选未连接/应用，仍需 linked dry-run、权限专项审查和老板确认。
- 本批未修改客户/后台 UI，未写入 linked Supabase/Vercel。`node --test tests/rma-admin-workflow.test.mjs tests/rma-rules.test.mjs` 33/33、相关 RMA contract/admin-contract 12/12；受影响 TS/MJS 定向 ESLint 和 `git diff --check` 通过。`tsc --noEmit --incremental false` 仍只报既有 `src/app/api/admin/restock-requests/[id]/route.ts:17:12 RouteContext`。

### 批次 4 客户与后台 RMA 工作台 UI（2026-08-28）

- 后台面板默认展示六个服务端队列 tab（`review`、`awaiting_return`、`receiving`、`qc`、`resolution`、`inventory_close`），`archive` 作为历史入口；队列徽标直接使用 `queueCounts`，`countsComplete=false` 时显示“至少”并保留不完整提示，不按当前分页重算。搜索输入 260ms 防抖，点击记录后再读取 exact detail。
- 后台详情只突出服务端 `recommendedAction`，其余动作由 `availableActions` 过滤；`assign` 收入高级区且永不推荐，拒绝/QC/退款/替换/库存处置使用聚焦对话，动作统一 POST `/actions`、同步 ref 防双击并携带幂等键和完整数量。退款预览缺失时禁用，替换只显示服务端候选订单号，附件只用 signed URL 缩略图。
- 客户历史申请在 `canMarkShipped` 时提供无需确认弹窗的一键“我已寄回/Ho spedito il reso”，物流信息可选；按申请同步 ref 防重复提交，成功原位更新安全 DTO 并显示寄回时间/物流，错误保留重试。received/refunded/closed 等后续阶段不显示寄回按钮。
- 新增 `tests/rma-admin-ui-contract.test.mjs` 并扩展 customer UI contract，覆盖队列/count honesty、服务端动作、退款/替换候选、完整数量、照片缩略图、一键寄回和无确认弹窗；真实浏览器视觉、相机权限、signed PUT/CORS 和后台 E2E 仍未验证。
- 本批未写入 linked Supabase、未 push、未部署；TypeScript 检查仍仅报既有 `RouteContext` 基线错误。

### 批次 4a 生产后 RMA ACL 收口候选（2026-08-28）

- 新增候选 migration `supabase/migrations/20260828095944_rma_acl_lockdown.sql`，仅撤销 `anon`/`authenticated` 对五张 RMA 表和 `rma_request_no_seq` 的直接权限，并撤销两个私有 zero-arg trigger function 对 `PUBLIC`/浏览器角色的 EXECUTE；不修改 RLS、policy、函数定义、service_role 权限或数据。
- 候选 migration 尚未应用到 linked Supabase；需通过 migration list、仅本 migration 的 dry-run、权限/grant probe 和专项批准后独立应用，任务状态保持 `in_progress`，不得据此声明生产已收口。

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

当前批次 1 自动化集合：

- `node --test tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs`
- `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc' --noEmit --incremental false --project '<worktree>/tsconfig.json'`（当前仅剩基线 `RouteContext` 错误）
- `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint' <worktree absolute TS/TSX files>`
- `git diff --check`

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

- Migration B 仅生成候选 SQL，不应用、不撤回线上权限；所有服务端契约/API、候选 migration 和本批 UI 仅在隔离 worktree 内实现，不写生产数据或环境变量。
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
| Next.js 16 Route Handler 与 Server/Client 指南读取 | passed | 写 Route Handler 前读取本地 `node_modules/next/dist/docs/` 对应文档 |
| Supabase migration 创建 | passed | 使用 `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration new rma_simple_flow_expand` 创建 Migration A |
| 当前批次 1 代码/migration/远端写入 | passed | 仅隔离 worktree 生成服务端契约/API 与 Migration A；未访问/写入 linked Supabase、Vercel、GitHub |
| `node --test tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs` | passed | 批次 1c 共享纯规则与 SQL/API 源契约 14/14 通过 |
| 主仓库 `node_modules/.bin/eslint` 定向检查 | passed | 批次 1b RMA contract/http/helper、客户/后台 routes、repository 均通过 |
| 主仓库 `node_modules/.bin/tsc --noEmit --incremental false --project <worktree>/tsconfig.json` | blocked by baseline | 1d 复跑仅报既有 `src/app/api/admin/restock-requests/[id]/route.ts:17:12 RouteContext`；`AdminProductStockAdjustmentInput.location` 已修复且无新增诊断 |
| 主仓库 `node_modules/.bin/eslint` 定向检查 | passed | 本批所有 RMA TS/TSX 受影响文件通过，无输出 |
| `git diff --check` | passed | 批次 1c 当前 diff 无空白错误 |
| `node --test tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs` | passed | 批次 1d 纯规则与 SQL/API 源契约 16/16 通过 |
| 主仓库 `node_modules/.bin/eslint` 定向检查 | passed | 批次 1d 修改的 repository、RMA contract、RMA simple-flow 通过 |
| `git diff --check` | passed | 批次 1d 当前 diff 无空白错误 |
| `node --test tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs` | passed | 批次 1e 规则、历史 trigger SQL 契约和后台 DTO 源契约 18/18 通过；包含收货/退款/换货/库存处置部分与全量 close 行为 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint <本批 RMA TS/MJS 文件>` | passed | 批次 1e 定向 ESLint 无输出 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc --noEmit --incremental false --project <worktree>/tsconfig.json` | blocked by baseline | 仅有既有 `src/app/api/admin/restock-requests/[id]/route.ts:17:12 RouteContext`；本批无新增 TypeScript 诊断 |
| `git diff --check` | passed | 批次 1e 当前 diff 无空白错误 |
| `node --test tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs` | passed | 批次 1f close 规则、wallet/replacement linkage 反例与 SQL close 静态契约 18/18 通过 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint <1f RMA data/repository/contract/rules/tests>` | passed | 定向 ESLint 无输出 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc --noEmit --incremental false --project <worktree>/tsconfig.json` | blocked by baseline | 仅报既有 `src/app/api/admin/restock-requests/[id]/route.ts(17,12): Cannot find name 'RouteContext'`；1f 未引入新增诊断 |
| `git diff --check` | passed | 1f 当前差异无空白错误 |
| `node --test tests/rma-upload-client.test.mjs tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs tests/storefront-i18n-contract.test.mjs` | passed | 批次 2a 图片选择/准备、SHA、新协议重试补偿与既有 RMA/i18n 契约 26/26 通过 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint src/lib/partspro-rma-upload-client.mjs src/lib/partspro-rma-contract.ts src/i18n/dictionaries/storefront.ts tests/rma-upload-client.test.mjs` | passed | 批次 2a 定向 ESLint 无输出 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc --noEmit --incremental false --project <worktree>/tsconfig.json` | blocked by baseline | 仅剩既有 `src/app/api/admin/restock-requests/[id]/route.ts(17,12): Cannot find name 'RouteContext'`，无本批新增诊断 |
| `git diff --check` | passed | 批次 2a utility/test/contract/i18n 当前差异无空白错误 |
| `node --test tests/rma-customer-ui-contract.test.mjs tests/rma-upload-client.test.mjs` | passed | 批次 2b UI 静态契约与上传编排 10/10 通过 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint src/components/partspro/rma-page.tsx src/app/rma/page.tsx src/i18n/dictionaries/storefront.ts` | passed | 批次 2b 客户页、路由参数和中意文案定向 ESLint 无输出 |
| `/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc --noEmit --incremental false --project <worktree>/tsconfig.json` | blocked by baseline | 仅剩既有 `src/app/api/admin/restock-requests/[id]/route.ts(17,12): Cannot find name 'RouteContext'`，2b 无新增诊断 |
| `git diff --check` | passed | 批次 2b 客户页、路由、i18n 和测试当前差异无空白错误 |
| `node --test tests/rma-customer-ui-contract.test.mjs tests/rma-upload-client.test.mjs tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs tests/storefront-i18n-contract.test.mjs` | passed | 2b 收口复跑 31/31 通过 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint' src/components/partspro/rma-page.tsx src/app/rma/page.tsx src/i18n/dictionaries/storefront.ts src/lib/partspro-rma-upload-client.mjs tests/rma-customer-ui-contract.test.mjs tests/rma-upload-client.test.mjs` | passed | 正确引用主仓库 ESLint 二进制，无输出；首次未加引号的路径解析失败不属于代码错误 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc' --noEmit --incremental false --project tsconfig.json` | blocked by baseline | 仅有既有 `src/app/api/admin/restock-requests/[id]/route.ts(17,12): Cannot find name 'RouteContext'` |
| `git diff --check` | passed | 2b 收口复跑无空白错误 |
| `node --test tests/rma-upload-client.test.mjs tests/rma-customer-ui-contract.test.mjs tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs tests/storefront-i18n-contract.test.mjs` | passed | 批次 2c 上传恢复、DTO/UI 与既有 RMA/i18n 契约全套通过；包含响应丢失只 `/submit`、5+1 断点恢复、DELETE 非 2xx、备注可选和 orderNumber 契约 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint' <2c RMA client/page/DTO/contract/i18n/test files>` | passed | 2c 定向 ESLint 无输出；React 事件入口使用同步 ref guard，render 仅读取 state |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc' --noEmit --incremental false --project tsconfig.json` | blocked by baseline | 2c 仅剩既有 `src/app/api/admin/restock-requests/[id]/route.ts(17,12): Cannot find name 'RouteContext'`，无新增诊断 |
| `git diff --check` | passed | 2c 当前变更无空白错误 |
| `SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase status` | blocked by local environment | Docker daemon 不可用；无本地 PostgreSQL/Supabase，双事务并发 trigger 验证留最终本地数据库门禁；未访问远端 |
| Supabase linked/local lint、migration dry-run、build/E2E | skipped by gate | 本批禁止远端/数据库写入；worktree 无需启动本地数据库，按范围不跑完整 build/E2E |
| `node --test tests/rma-upload-client.test.mjs` | passed | 批次 2d abandonment 单向清理与既有上传编排 10/10 通过，含 DELETE `204 -> 500 -> retry` 且无 submit/draft/upload |
| `node --test tests/rma-upload-client.test.mjs tests/rma-customer-ui-contract.test.mjs tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs tests/storefront-i18n-contract.test.mjs` | passed | 批次 2d 最终相关集合 37/37 通过 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint' src/components/partspro/rma-page.tsx src/lib/partspro-rma-upload-client.mjs src/i18n/dictionaries/storefront.ts tests/rma-upload-client.test.mjs tests/rma-customer-ui-contract.test.mjs` | passed | 批次 2d 客户页、上传客户端、i18n 和测试定向 ESLint 无输出 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc' --noEmit --incremental false --project tsconfig.json` | blocked by baseline | 仅有既有 `src/app/api/admin/restock-requests/[id]/route.ts(17,12): Cannot find name 'RouteContext'`；2d phase 类型未引入新增诊断 |
| `git diff --check` | passed | 批次 2d 当前差异无空白错误 |
| `node --test tests/rma-admin-workflow.test.mjs tests/rma-rules.test.mjs` | passed | 批次 2e 后台七队列、权限/推荐、钱包 pending、库存三选、close/archive 与共享底层规则 29/29 通过 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint' src/lib/partspro-rma-workflow-rules.mjs src/lib/partspro-rma-workflow-rules.ts tests/rma-admin-workflow.test.mjs` | passed | 批次 2e canonical MJS、TypeScript wrapper 与行为测试定向 ESLint 无输出 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc' --noEmit --incremental false --project tsconfig.json` | blocked by baseline | 仅报既有 `src/app/api/admin/restock-requests/[id]/route.ts(17,12): Cannot find name 'RouteContext'`，本批无新增诊断 |
| `git diff --check` | passed | 批次 2e 规则、wrapper、测试和任务卡无空白错误 |
| `node --test tests/rma-admin-ui-contract.test.mjs tests/rma-customer-ui-contract.test.mjs` | passed | 批次 4 后台/客户 UI contract 11/11 通过，覆盖六队列、计数诚实、动作入口、退款/候选、缩略图、一键寄回和重试 |
| `node --test tests/rma-admin-workflow.test.mjs tests/rma-rules.test.mjs tests/rma-contract.test.mjs tests/admin-rma-workflow-contract.test.mjs tests/rma-upload-client.test.mjs tests/rma-customer-ui-contract.test.mjs tests/rma-admin-ui-contract.test.mjs` | passed | 批次 4 相关 RMA 行为、SQL/API、上传和 UI 集合 66/66 通过 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/eslint' src/components/partspro/admin-rma-panel.tsx src/components/partspro/rma-page.tsx src/i18n/dictionaries/storefront.ts tests/rma-admin-ui-contract.test.mjs tests/rma-customer-ui-contract.test.mjs` | passed | 批次 4 受影响 UI、i18n 和 contract 测试定向 ESLint 无输出 |
| `'/Users/kyox215/Documents/partspro v4/node_modules/.bin/tsc' --noEmit --incremental false --project tsconfig.json` | blocked by baseline | 仅报既有 `src/app/api/admin/restock-requests/[id]/route.ts:17:12 RouteContext`，本批 UI 无新增诊断 |
| `git diff --check` | passed | 批次 4 UI、i18n、测试和任务卡无空白错误 |

## 执行记录

- 创建：2026-08-27
- 批准：2026-08-27；用户已批准本轮开始实现/推送/部署，当前 worker 仍按范围不 push、不部署、不应用远端 migration
- 开始：2026-08-27
- review：pending；Migration A/RLS/权限/支付/库存需专项守门
- verified：2026-08-28；批次 3 工作台/客户 shipped/Migration B 源契约及批次 4 UI 集合 `66/66`、定向 ESLint、`git diff --check` 通过；`tsc --noEmit --incremental false` 仅剩基线 `RouteContext`；本地 Docker 不可用，Migration B linked dry-run、wallet/replacement 关系、数据库触发器并发、真实浏览器与后台 E2E 仍待最终门禁
- released：不适用，本批不发布
- closed：pending

## 结果

当前批次在隔离分支交付服务端 RMA 工作台契约、客户一键寄回、精确退款预览、replacement candidate 读取、Migration B 候选及客户/后台工作台 UI；不声明远端数据库已应用、不声明生产上传/退款/库存或真实浏览器流程已验证。意大利政策、法定撤回分类、Migration B 危险撤权、linked migration dry-run、Vercel 发布和最终 E2E 仍需专门门禁。

## 残余风险与后续任务

- 意大利 B2C 撤回/保修、B2B 商业退货、退款方式、运费承担和税务处理尚未由专业人员确认。
- 当前历史 RMA 状态、附件 JSON、wallet `order_void` 语义和库存处置数据需要迁移前盘点。
- 当前批次已收口服务端附件上传/校验、legacy 双协议隔离、核心状态/QC 守卫、active membership/employee-self 归属、并发数量锁、统一订单行净可退数量、V1 完整数量闭环、customer DTO 隔离、商业互斥、双轴关闭、显式收货时间、approved wallet/replacement linkage close guard、批量 GC 函数和基础通知事件，并交付客户三块 UI、后台队列/动作 UI 与一键寄回 UI；历史无单价快照 RMA 需人工/迁移补建后才能安全退款。真实浏览器视觉/相机/Storage/CORS、法定期限与 policy 激活、GC 调度、Migration B 危险撤权、生产联调和完整退款/税务确认仍待后续批次。
- V1 明确拒绝部分收货/部分退款/部分库存处置；未来若需拆分，必须新增数量 ledger、库存批次分配和逐行退款对账，不得只放宽当前 action 参数。
- Migration A 保留旧 `rma_requests/events` direct grants/RLS，并未收紧历史 bucket；在新客户端完全切换、兼容读取验证和正式 Migration B 审批前，禁止打开新写流程生产流量。
- Migration B 仍是危险权限/Storage 收口候选，需在 linked 目标明确且无旧 pending migration 夹带时 dry-run；真实 PostgreSQL 需验证首动作自动认领、review 通知不重复、客户 active-member 隔离、shipped 幂等、退款余额/订单行上限和 replacement candidate 排除条件。
- 后续应分别创建政策 ADR、RMA data/RPC migration 任务、图片上传安全任务、后台 QC/库存任务、退款/换货任务和发布观察 runbook。
