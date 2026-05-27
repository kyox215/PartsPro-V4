# PartsPro 客户管理基础版重设计规划书

日期：2026-05-27

## 1. 目标

把当前偏 B2B 审批/商业条款/成员管理的客户工作台，收敛成一个基础、清晰、可先落地的客户管理功能：

- 用户注册或首次登录后，自动出现在后台客户管理列表。
- 管理员可以设置客户等级。
- 有客户等级权限的员工也可以设置客户等级，该权限由管理员分配。
- 管理员可以设置客户类型：零售、批发。
- 管理员可以设置客户是否活跃。
- 客户详情里显示订单历史，并且每个订单可以打开查看详情。
- 客户详情里显示最近操作历史，例如查看了哪个 SKU、哪个品牌/型号、搜索了什么。
- 去掉 B2B 申请、B2B 审核、商业授信、价格组、付款账期、成员转员工等不适合基础版的选项。

## 2. 当前项目流程结论

### 2.1 注册/登录到客户数据

现有账号链路已经具备基础能力：

- 密码登录成功后会调用 `ensureCurrentUserAccount()`：`src/app/login/actions.ts`。
- OAuth callback 成功后也会调用 `ensureCurrentUserAccount()`：`src/app/auth/callback/route.ts`。
- `ensureCurrentUserAccount()` 会调用 Supabase RPC `ensure_current_user_account`：`src/lib/partspro-account-context.ts`。
- RPC 会 upsert `profiles`，默认账号为 `customer`。
- 如果没有客户记录，RPC 会创建 `customers`，默认 `status='active'`、`customer_type='retail'`、`assignment_status='needs_review'`、`level='bronze'`，然后把 `profiles.customer_id` 指向该客户。

现有缺口：

- 项目里没看到站内密码注册表单，主要是登录和 OAuth 入口；如果要支持邮箱注册，需要新增 signUp 流程。
- 新创建客户不会自动插入 `customer_memberships` owner 记录；旧迁移只对已有客户做过一次 backfill。
- 当前新用户默认 `active + needs_review`，语义有点冲突。基础版建议不要再显示“归属/审核”状态，后台只显示“活跃/停用”。

### 2.2 后台客户管理

现有后台客户管理已经有：

- `GET /api/admin/customers` 列表。
- `GET /api/admin/customers/[id]` 详情，返回客户、成员、订单、RMA、审计日志。
- `PATCH /api/admin/customers/[id]/profile` 更新客户档案。
- `PATCH /api/admin/customers/[id]/classification` 更新状态、客户类型、归属状态等。
- `PATCH /api/admin/customers/[id]/commercial-terms` 更新等级、价格组、授信、付款条件等。
- 前端 `AdminCustomersPanel` 已有列表、详情、移动端弹窗、编辑弹窗、订单详情弹窗。

现有问题：

- 页面信息过重，包含 B2B 档案、商业条款、信用额度、应收、逾期、价格组、成员转员工、归属状态等。
- 列表依赖 `orders_count/revenue/last_order_at`，但当前只看到订单变更后重算 `lifetime_spend_net/level/tier`，未看到稳定维护 `orders_count/revenue/last_order_at` 的触发器。
- 账号转换 RPC 存在 `admin_update_account_type` 与 `admin_update_account` 两套语义相近实现，后续容易漂移。

### 2.3 订单历史与详情

后台订单详情链路可复用：

- `GET /api/admin/orders/[orderId]` 已能按订单 UUID 或订单号读取。
- Repository 里会组合 `orders + order_lines + order_events + customers + products`。
- DTO 已返回 `lines` 和 `operationHistory`。
- 客户详情当前已经读取最近 20 个订单并显示在订单 tab。

前台账号页当前只显示订单摘要，“详情”按钮是 disabled。基础版后台客户管理可以先复用管理端订单详情弹窗，后续再补客户自助订单详情接口。

### 2.4 最近操作历史

当前没有“用户查看了什么型号/商品”的持久化行为日志。

已有日志不适合直接复用：

- `order_events` 是订单事件。
- `admin_audit_events` 是管理端审计事件。

需要新增面向客户行为的事件表，例如 `customer_activity_events`。

## 3. 新版功能边界

### 3.1 保留

- `profiles`：账号身份。
- `customers`：客户主档。
- `orders / order_lines / order_events`：订单历史和订单详情。
- `admin_audit_events`：管理员修改客户资料的审计记录，可作为内部审计保留但不作为“最近操作历史”主数据源。
- `admin_permissions / admin_role_templates / admin_user_permission_overrides`：员工权限模型，继续用于控制谁能读取客户、编辑客户、修改客户等级。
- 客户等级：`bronze / silver / gold / emerald / diamond / master / king`。
- 客户类型：`retail / wholesale`。
- 客户状态：基础版 UI 用“活跃/停用”表达，底层继续映射到 `customers.status`。

### 3.2 去掉或隐藏

- B2B 申请入口、B2B 审核、B2B application API 在客户管理 UI 中不再出现。
- `assignment_status` 不在 UI 中展示，不再作为主筛选项。
- 客户成员列表、成员角色、成员转员工。
- 商业条款 tab。
- 信用额度、可用额度、应收、逾期、付款条件、月采购额、价格组。
- “B2B 档案”“B2B 客户工作台”等文案。

注意：批发客户类型不是要去掉。新版保留“零售/批发”，只是去掉 B2B 申请和复杂商业审批。

## 4. 数据模型规划

### 4.1 customers 表使用方式

基础版直接使用现有字段：

- `id`
- `user_id`
- `company_name`：基础版显示为客户名称；注册用户可用 display name 或 email 初始化。
- `contact_name`
- `email`
- `phone`
- `shipping_address`
- `status`
- `customer_type`
- `level`
- `level_source`：`automatic` 或 `manual`，用于区分消费额自动等级和员工手动等级。
- `manual_level_set_by`
- `manual_level_set_at`
- `manual_level_reason`
- `lifetime_spend_net`
- `orders_count`
- `last_order_at`
- `created_at`
- `updated_at`

建议基础版 UI 字段映射：

- 是否活跃：`status === 'active'`
- 停用：`status === 'suspended'`
- 新用户默认：`active + retail + bronze`
- `pending` 仅作为兼容旧数据展示，不作为主工作流。
- 员工手动修改等级后，`level_source='manual'`，后续订单聚合只更新消费额、订单数、最近订单时间，不再覆盖 `level/tier`。

### 4.2 注册后客户归属补齐

修改 `private.ensure_user_account()`：

- 创建或找到 customer 后，自动 upsert `customer_memberships(customer_id, user_id, member_role='owner', status='active')`。
- 保证 `profiles.customer_id`、`customers.user_id`、`customer_memberships` 三者一致。

这样新注册用户在客户列表、详情、后续多账号扩展中都不会断链。

### 4.3 客户聚合字段

二选一：

1. 推荐短期方案：新增订单 after trigger，同步更新 `customers.orders_count/revenue/last_order_at/lifetime_spend_net/level`。
2. 推荐长期方案：建立客户统计视图或 RPC，客户列表读取实时聚合，不依赖冗余字段。

基础版为了快速落地，建议先做触发器，减少前端和 API 改动。

### 4.4 最近操作历史表

新增表：`public.customer_activity_events`

建议字段：

- `id uuid primary key default gen_random_uuid()`
- `user_id uuid references auth.users(id) on delete set null`
- `customer_id uuid references public.customers(id) on delete cascade`
- `event_type text not null`
- `sku_code text`
- `product_name text`
- `brand text`
- `model text`
- `model_series text`
- `search_query text`
- `metadata jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

事件类型建议：

- `product_view`
- `model_view`
- `catalog_search`
- `catalog_filter`
- `order_detail_view`

RLS：

- 客户只能插入/读取自己的事件。
- 管理员有 `customers.read` 可以读取客户事件。
- 不复用 `admin_audit_events`，避免把用户行为和管理审计混在一起。

## 5. API 规划

### 5.1 客户列表

保留：`GET /api/admin/customers`

请求参数建议：

- `q`
- `status`
- `customerType`
- `tier` 或改名 `level`
- `hasOrders`
- `createdFrom`
- `createdTo`
- `sort`
- `limit`
- `offset`

移除或不再由 UI 调用：

- `assignmentStatus`
- `priceGroupId`
- `profileComplete`

返回字段建议：

- `id`
- `name`
- `email`
- `phone`
- `customerType`
- `status`
- `isActive`
- `level`
- `ordersCount`
- `lifetimeSpendNet`
- `lastOrderAt`
- `lastActivityAt`
- `createdAt`

### 5.2 客户详情

保留：`GET /api/admin/customers/[id]`

详情返回：

- `customer`
- `orders`
- `recentActivity`
- `auditEvents`，可选，仅内部审计 tab 使用

不再默认返回到 UI：

- `memberships`
- `rmas`，基础版可暂不展示，后续售后模块再接回
- 商业条款相关字段

### 5.3 客户编辑

保留分段接口，但前端收敛调用：

- `PATCH /api/admin/customers/[id]/profile`
  - 名称、联系人、邮箱、电话、收货地址。
- `PATCH /api/admin/customers/[id]/classification`
  - `status`
  - `customerType`
- `PATCH /api/admin/customers/[id]/commercial-terms`
  - 基础版短期只用来保存 `level`，但权限必须改为独立的 `customers.manage_level`。
  - 中期建议新增更清晰的 `/level` endpoint，避免继续把客户等级和商业条款绑定。

建议后续新增一个更贴合基础版的合并接口：

- `PATCH /api/admin/customers/[id]/basics`
  - `companyName/contactName/email/phone/shippingAddress/status/customerType/level/reason`
  - 如果请求包含 `level`，后端必须校验 `customers.manage_level`。

短期为了少改动，可以继续复用现有三个 endpoint。

### 5.4 订单详情

后台客户管理继续复用：

- `GET /api/admin/orders/[orderId]`

客户自助后台后续新增：

- `GET /api/orders/[orderId]`

权限必须限定为当前 `profiles.customer_id`、`customer_memberships` 或 `customers.user_id` 可访问的订单，不能直接开放 admin route。

### 5.5 最近操作历史

新增：

- `POST /api/customer-activity`
  - 客户登录后记录浏览/搜索/型号点击事件。
- `GET /api/admin/customers/[id]/activity`
  - 管理员读取客户最近行为。

也可以先把最近行为并入 `GET /api/admin/customers/[id]`，减少一次前端请求。

### 5.6 权限管理

新增独立权限：

- `customers.manage_level`
  - 中文含义：修改客户等级。
  - 英文标签建议：`Manage customer level`。
  - 权限组：`customers`。
  - 描述：允许员工修改客户 `level/tier`，但不允许修改信用额度、付款条件、价格组等商业条款。

权限边界：

- `customers.read`：查看客户列表、客户详情、订单历史、最近操作。
- `customers.manage`：编辑基础资料，如姓名/邮箱/电话/地址。
- `customers.classify`：修改客户类型和活跃状态。
- `customers.manage_level`：修改客户等级。
- `customers.manage_terms`：旧商业条款权限，基础版不再用于前端客户等级修改；保留兼容旧代码，后续下线或只给管理员。
- `employees.manage_permissions`：管理员或超级管理员权限，用于分配员工角色模板和单项权限。

管理员分配方式：

- 继续使用现有 `AdminPermissionsPanel` 的员工权限矩阵。
- 管理员进入“权限设置”，选择员工。
- 可通过角色模板继承权限，也可以用单项权限覆盖：
  - `grant customers.manage_level`：允许该员工修改客户等级。
  - `deny customers.manage_level`：即使角色模板包含该权限，也禁止该员工修改客户等级。
  - `inherit`：按角色模板继承。

角色模板建议：

- `admin`：默认拥有 `customers.manage_level`。
- `sales`：建议默认拥有 `customers.manage_level`，因为销售常需要调整客户等级。
- `sales_support`：默认只读，不默认拥有，管理员可按人单独 grant。
- `auditor`：不拥有，只读。
- 仓库、采购、目录、库存、定价角色默认不拥有，除非管理员单独 grant。

后端实现要求：

- 在 `admin_permissions` 中插入 `customers.manage_level`。
- 在 `admin_role_template_permissions` 中给 `admin` 和可选的 `sales` 分配默认权限。
- 在 `src/lib/partspro-permissions.ts` 的 `adminPermissions` 和角色模板集合中加入 `customers.manage_level`。
- 新增或调整 RPC：
  - 推荐新增 `public.admin_update_customer_level(p_customer_id uuid, p_level text, p_reason text)`。
  - 该 RPC 只更新 `level/tier`，只校验 `customers.manage_level`，并写入 `admin_audit_events`。
  - 旧 `admin_update_customer_terms` 继续兼容，但前端基础版不再调用它修改等级。
- 如果暂时继续复用 `/commercial-terms`，route 和 repository 必须在只更新等级时校验 `customers.manage_level`，不得要求 `customers.manage_terms`。

前端实现要求：

- 客户详情里等级 Select 只对有 `customers.manage_level` 的员工启用。
- 无权限时显示只读等级 Badge，并给按钮/控件 disabled 状态。
- 保存等级失败时显示“缺少修改客户等级权限”。
- 权限面板中必须能搜索和覆盖 `customers.manage_level`。
- 权限面板需要提供 `customers.manage_level` 的快捷 grant/deny/inherit 控制，管理员不需要在大量权限中手动翻找。
- `GET /api/admin/permissions` 必须要求 `employees.manage_permissions`，避免只有员工读取权限的人查看全量角色模板和个人覆盖矩阵。

审计要求：

- 每次修改客户等级都写入 `admin_audit_events`。
- action 建议为 `customer.level_update`。
- audit 内容包含旧等级、新等级、操作者、原因、时间。

## 6. 前端信息架构

### 6.1 客户列表

列表列：

- 客户：名称 + 邮箱/电话
- 类型：零售/批发
- 等级
- 活跃状态
- 订单数
- 累计消费
- 最近订单或最近操作
- 注册时间

顶部 KPI：

- 客户总数
- 活跃客户
- 零售客户
- 批发客户

筛选：

- 搜索
- 活跃状态
- 客户类型
- 等级
- 是否有订单
- 注册时间

去掉：

- 待审核 KPI
- 信用风险 KPI
- 归属状态筛选
- 价格组筛选

### 6.2 客户详情

建议 tabs：

1. 基础信息
   - 姓名/名称
   - 邮箱
   - 电话
   - 收货地址
   - 类型
   - 等级
   - 活跃状态
2. 订单历史
   - 最近订单列表
   - 状态、付款状态、金额、下单时间
   - 点击打开订单详情弹窗
3. 最近操作
   - 最近查看商品
   - 最近查看型号
   - 最近搜索关键词
   - 时间线排序
4. 内部审计，可选
   - 管理员修改等级、类型、状态、基础资料的记录

去掉：

- 账号成员 tab
- 商业条款 tab
- 金额明细/信用 tab
- 转为员工操作

### 6.3 编辑控件

- 等级：Select
  - 仅拥有 `customers.manage_level` 的员工可编辑。
  - 无权限员工只读显示等级。
- 客户类型：Segmented control 或 Select，值为零售/批发
- 是否活跃：Switch
- 基础信息：简单表单
- 停用客户：建议要求填写原因
- 普通保存：原因可选或自动生成，后端仍可写 audit

## 7. 埋点规划

### 7.1 商品详情浏览

位置：`src/app/prodotto/[sku]/page.tsx`

行为：

- 用户登录后，页面拿到 SKU、产品名称、品牌、型号、型号系列。
- 服务端或客户端调用 `POST /api/customer-activity`。
- 写入 `event_type='product_view'`。

### 7.2 目录型号点击

位置：`src/components/partspro/catalog-brand-tree.tsx`

行为：

- 用户点击品牌/型号/系列时记录。
- 写入 `event_type='model_view'`。

### 7.3 目录搜索和筛选

位置：

- `src/app/api/catalogo/route.ts`
- `src/app/catalogo/page.tsx`

行为：

- 记录搜索词、品牌、型号、型号系列、类目。
- 写入 `catalog_search` 或 `catalog_filter`。

### 7.4 去重策略

为了避免刷新页面刷爆日志：

- 同一用户、同一 SKU，5 分钟内只记录一次 `product_view`。
- 同一用户、同一型号，5 分钟内只记录一次 `model_view`。
- 搜索关键词可以按 1 分钟窗口去重。

## 8. 分期落地计划

### Phase 1：数据契约修正

- 新增 `customer_activity_events` 表、索引、RLS。
- 修改 `ensure_user_account()`，自动创建 owner membership。
- 新增或修正客户聚合字段触发器。
- 新增 `customers.manage_level` 权限，并写入 `admin_permissions`、角色模板默认权限和权限覆盖体系。
- 新增或规划 `admin_update_customer_level` RPC，避免等级修改继续依赖商业条款权限。
- 统一账号 RPC 命名，明确保留 `admin_update_account_type` 或迁到 `admin_update_account`。
- 更新 `supabase/schema.sql` 摘要。

验收：

- 新注册/首次登录用户生成 `profiles + customers + customer_memberships`。
- 新客户默认 `retail + bronze + active`。
- 新订单后客户订单数、累计消费、最近订单时间更新。
- 管理员和被授权员工可以修改客户等级；无权限员工不能修改客户等级。
- 手动修改后的客户等级不会被后续订单聚合自动覆盖。

### Phase 2：API 收敛

- 调整 `GET /api/admin/customers` 返回基础版字段。
- 调整 `GET /api/admin/customers/[id]` 增加 `recentActivity`。
- 调整客户等级保存 API：优先新增 `/api/admin/customers/[id]/level`，或让现有等级保存路径校验 `customers.manage_level`。
- 旧 `/commercial-terms` 和 `admin_update_customer_terms` 不再接受 `tier/level`，避免员工绕过 `customers.manage_level` 修改等级。
- 新增 `POST /api/customer-activity`。
- 新增或准备 `GET /api/admin/customers/[id]/activity`。
- 订单详情继续复用 `GET /api/admin/orders/[orderId]`。

验收：

- 列表能按活跃状态、类型、等级筛选。
- 详情能返回订单历史和最近操作。
- 只有拥有 `customers.manage_level` 的员工能成功保存等级。
- 无需 B2B application API 即可完成基础客户管理。

### Phase 3：前端重做客户管理

- 重构 `AdminCustomersPanel` 为轻量客户台账。
- 保留现有列表/详情/移动端弹窗/订单详情弹窗骨架。
- 删除或隐藏 B2B、商业条款、成员转员工、信用模型 UI。
- 文案改为“客户管理/客户资料/订单历史/最近操作”。
- UI 中保留等级、零售/批发、是否活跃。
- 等级编辑控件按 `customers.manage_level` 权限启用或只读。
- 权限设置页显示 `customers.manage_level`，管理员可对员工 grant/deny/inherit。

验收：

- 后台第一个屏幕就是客户列表，不出现 B2B 工作台语义。
- 点客户能看到基础信息、订单历史、最近操作。
- 等级、类型、活跃状态可以保存并刷新列表。
- 无等级权限的员工看得到等级，但不能打开或提交等级编辑。

### Phase 4：行为日志上线

- 商品详情页记录 `product_view`。
- 目录型号点击记录 `model_view`。
- 搜索/筛选记录 `catalog_search/catalog_filter`。
- 客户详情最近操作 tab 展示这些事件。

验收：

- 登录客户查看某 SKU 后，后台客户详情能看到该 SKU。
- 点击某型号后，后台能看到品牌/型号/时间。
- 未登录用户不写客户行为事件。

### Phase 5：清理和保护

- 客户管理 UI 不再调用 `/api/admin/b2b-applications/**` 和 legacy `/api/admin/customers/applications/**`。
- 去掉相关字典文案。
- 删除或隐藏无入口代码前先保留 API 兼容，避免线上旧链接报错。
- 后续确认无调用后再移除废弃 API。

## 9. 测试与验收清单

### 注册/登录

- 新用户注册或首次 OAuth 登录后，后台客户列表立即出现。
- 新用户客户类型为零售。
- 新用户等级为 bronze。
- 新用户状态为活跃。
- `profiles.customer_id` 指向 customer。

### 客户编辑

- 修改等级后列表和详情同步更新。
- 只有管理员或被授予 `customers.manage_level` 的员工可以修改等级。
- 手动设置等级后，新增或更新订单不会自动覆盖该客户的 `level/tier`。
- 旧商业条款接口传入 `tier/level` 会被拒绝，等级只能走 `customers.manage_level`。
- 管理员撤销 `customers.manage_level` 后，该员工立即不能保存等级变更。
- 修改客户类型为批发后保存成功。
- 停用客户后状态变为 suspended，UI 显示不活跃。
- 重新启用客户后状态变为 active。

### 订单历史

- 客户详情显示订单历史。
- 点击订单能打开详情弹窗。
- 详情包含订单行、SKU、数量、单价、订单状态、操作历史。

### 最近操作

- 查看商品详情后，客户详情出现 product_view。
- 点击型号后，客户详情出现 model_view。
- 搜索目录后，客户详情出现 catalog_search。
- 同一事件短时间重复访问不会刷屏。

### B2B 去除

- 客户管理页面不出现 B2B 申请、B2B 审批、商业条款、信用额度、账期、价格组、成员转员工。
- 批发/零售仍保留为客户类型，不被误删。

### 权限管理

- 权限设置页能看到 `customers.manage_level`。
- 权限设置页能搜索 `customers.manage_level` 或“修改客户等级”。
- 管理员可以给员工单独 grant `customers.manage_level`。
- 管理员可以给员工单独 deny `customers.manage_level`。
- 权限继承、授权、拒绝三种状态都能正确影响客户等级编辑。
- 修改客户等级会写入审计日志 `customer.level_update`。

## 10. 风险与注意事项

- 当前没有站内密码注册页面，若业务需要“注册后显示”，需要补注册入口或确认只使用 OAuth/后台创建账号。
- `customers.orders_count/revenue/last_order_at` 如果继续靠存储字段，必须补触发器，否则列表数据会旧。
- 多成员客户模型当前和下单 RPC 不完全一致；基础版可先隐藏成员功能，但数据库层最好仍保持一致。
- 最近操作历史涉及用户行为数据，需要避免记录敏感信息，只记录 SKU、型号、搜索词和必要上下文。
- 不要把用户行为写进 `admin_audit_events`，否则审计和行为分析会混乱。

## 11. 推荐实施顺序

1. 先做数据库补强：owner membership、客户聚合字段、行为日志表。
2. 再做 API：客户详情增加 recentActivity，新增行为上报。
3. 再重做客户管理 UI：列表、详情、编辑、订单详情、最近操作。
4. 最后清理 B2B 文案和旧入口。

这样做能最大限度复用当前项目已有客户/订单/权限基础，又能快速把功能变成你要的基础客户管理，而不是继续围绕 B2B 审批扩展。

## 12. 当前执行状态

已按本规划启动三条子代理并完成第一轮基础落地：

- 数据库线：新增 `customers.manage_level`、`customer_activity_events`、注册/首次登录客户 owner membership 自动补齐、客户订单聚合触发器、`admin_update_customer_level` RPC。
- 数据库线补强：客户等级新增 `level_source/manual_level_*` 元数据，手动等级不会被订单聚合覆盖。
- 权限线补强：旧商业条款 RPC 和 API schema 不再允许 `tier/level`，避免绕过 `customers.manage_level`。
- API 线：新增 `PATCH /api/admin/customers/[id]/level`、`POST /api/customer-activity`，客户详情 DTO 增加 `recentActivity`。
- 订单线：新增客户自助订单详情接口 `/api/account/orders/[orderId]`，账户页订单详情按钮可打开订单行和操作历史。
- 前端线：客户管理页收敛为基础台账，隐藏 B2B/商业条款/成员转员工/RMA 等基础版不需要的入口；等级编辑按 `customers.manage_level` 权限启用；订单历史可打开详情；最近操作展示客户行为日志。
- 前端线补强：客户详情只保留“客户资料 / 订单历史 / 最近操作”三个 tab，删除成员晋升、金额/授信明细、商业条款残留 UI，内部等级编辑状态改为独立 `level` 流程。
- 行为日志线：商品详情页记录 `product_view`，目录搜索记录 `catalog_search`，目录选择型号/筛选记录 `model_view/catalog_filter`，客户打开订单详情记录 `order_detail_view`，并做 5 分钟浏览器端去重。
- 行为日志线补强：`recordCustomerActivity` 在 repository 层按客户、用户、事件类型和核心字段做 5 分钟去重，避免前端漏去重或订单详情重复打开导致最近操作刷屏。
- 权限/数据隔离补强：`readCurrentCustomerId` 会拒绝 `account_type='employee'`，避免员工浏览或后台操作写入客户最近操作，也避免员工误走客户自助订单详情接口。
- 安全验收补强：B2B 审核 API/schema 不再接受 `tier`；数据库 `admin_review_b2b_application` 会拒绝 `tier/level/priceList/customer_level`，商业条款字段需 `customers.manage_terms`，不能绕过 `customers.manage_level`。
- RLS 补强：`customer_activity_events` 限制事件类型，禁止员工账号直接写客户行为；订单/订单行/订单事件读取从 `is_staff()` 改为 `orders.read` 权限或客户本人链路。
- 搜索验收补强：`/catalogo?q=...` 首屏会按 `q` 查询并记录 `catalog_search`；搜索/筛选去重包含搜索词和筛选摘要，后台最近操作能显示筛选上下文。
- 订单验收补强：客户管理订单详情弹窗会渲染后端返回的 `operationHistory`，包含时间、事件、操作人、状态变化和备注。
- 基础版收口：客户查询/分类 API 不再接受 `assignmentStatus`、成员字段、价格组筛选、资料完整度筛选；客户列表状态筛选只保留“全部/活跃/停用”，dashboard 不再拉“待审核客户”角标。
- 注册入口补强：登录页新增邮箱注册表单；注册后若 Supabase 返回 session 会立即执行 `ensureCurrentUserAccount()` 建客户，需邮件确认时在确认/首次登录链路继续建档；普通客户登录默认进入 `/account`。
- 第二轮子代理已启动：
  - Confucius：复查权限分配闭环，重点看 `customers.manage_level` 是否可由管理员 grant/deny/inherit。
  - Locke：复查客户管理主流程是否仍暴露 B2B、商业条款、成员、RMA、待审核等基础版无关入口。
  - Carson：复查注册客户、订单详情、最近操作、等级权限等验收矩阵和剩余风险。
- 权限管理 UI 补强：`AdminPermissionsPanel` 新增权限搜索，并给 `customers.manage_level` 提供快捷继承/允许/拒绝控制；展示文案统一为“修改客户等级”。
- 权限接口补强：`GET /api/admin/permissions` 改为要求 `employees.manage_permissions`，只有管理员或被授权员工可读取全量权限矩阵和个人覆盖记录。
- 权限安全补强：服务端读取后台权限失败时不再回退到本地角色模板；数据库 `partspro_effective_permissions` 只给 employee/staff 账号计算后台权限，权限覆盖 RPC 也禁止把 override 写到普通客户账号。
- 基础版 API 收口：后台 B2B 审核、legacy customer applications、商业条款写入、成员转员工接口均返回基础版禁用响应；通用客户 PATCH 不再接受授信、账期、价格组、月采购额等商业条款字段。
- 状态收口：旧 `pending` 客户状态在迁移中归并为 `active`，前端和 repository 基础客户状态只按 `active/suspended` 显示。

待后续确认或继续深化：

- 已补最小邮箱注册入口；如果 Supabase 项目启用邮箱确认，新客户记录会在确认回调或首次登录时创建。
- 本地 Supabase/Postgres 未启动，数据库 migration 还需要在可用环境中执行一次真实迁移验证。
- TypeScript 全量检查已通过；此前 `.next/types/* d 4.ts` 重复声明文件已清理。
- 本轮权限 UI/API/基础版收口变更已通过目标 lint 和 `npx tsc --noEmit`。
