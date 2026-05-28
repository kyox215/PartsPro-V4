# 后台商品管理 UI 重做交接稿

这份文档导出现有 PartsPro 后台商品管理的功能、数据字段和业务逻辑，可直接交给 GPT 生成新的 React/Next.js UI 组件页面。目标是重做 UI，但保留现有数据契约和操作流程。

## 可直接给 GPT 的提示词

你要为 PartsPro B2B 后台重做“商品管理”页面 UI。请只重做组件结构和视觉交互，不改变现有 API 契约、字段名、状态流、权限逻辑和业务规则。

技术栈和上下文：
- Next.js App Router，React client component。
- 现有组件入口是 `src/components/partspro/admin-products-panel.tsx`，挂载在后台 `catalog` tab。
- UI 使用现有 shadcn/Radix 风格组件：`Button`, `Input`, `Select`, `Table`, `Badge`, `Sheet`, `Dialog`, `Tabs`, `Textarea`, `Checkbox`。
- 图标使用 `lucide-react`。
- 后端通过 `/api/admin/products` 及其子路由访问，不要直接访问 Supabase。

页面必须包含：
- 顶部指标卡：查询总数、已上架、草稿、隐藏、阻塞、低库存、缺主图、缺价格。
- 商品列表工具栏：同步、导出当前视图、新建商品。
- 筛选区：搜索、品牌、系列、型号、发布状态、库存状态、品质、排序、重置。
- 品牌/系列/型号四级级联选择：手机配件根节点 -> 品牌 -> 系列 -> 型号。
- 桌面表格和移动卡片两套展示。
- 批量选择和批量隐藏。
- 行操作菜单：详情、编辑、复制为草稿、查看前台列表、前台商品页预览、发布、恢复草稿、阻塞、库存动作、隐藏。
- 右侧抽屉详情页：顶部图像和关键指标，Tabs 包含基础信息、价格、库存、媒体、适配型号、审计记录。
- 新建/编辑表单：基础信息、价格、库存、发布目录、媒体字段。
- 库存动作弹窗。
- 图片上传模块。
- 审计记录列表。
- 分页和页大小切换。
- 加载、空状态、成功/错误提示。

不要把库存、发布状态、图片、权限等逻辑做成纯前端假数据。所有保存操作必须调用现有 API。列表刷新要保留当前筛选状态，保存成功后要用返回的商品替换本地列表中的对应行。

## 当前文件入口

- 后台页面路由：`src/app/admin/page.tsx`
- 后台总框架：`src/components/partspro/admin-dashboard.tsx`
- 商品管理组件：`src/components/partspro/admin-products-panel.tsx`
- API 路由：`src/app/api/admin/products/**`
- 仓库层：`src/lib/partspro-repository.ts`
- 权限：`src/lib/partspro-admin-auth.ts`, `src/lib/partspro-permissions.ts`
- 数据库迁移：`supabase/migrations/20260525233226_admin_product_management.sql`, `supabase/migrations/20260527181136_fix_product_model_series_edges.sql`

## 页面状态模型

列表筛选字段：

```ts
type ProductListFilters = {
  q: string;
  brand: string;
  modelSeries: string;
  model: string;
  catalogStatus: "all" | "active" | "draft" | "hidden" | "blocked";
  stockStatus: "all" | "In Stock" | "Low Stock" | "Out of Stock";
  grade: "all" | "A+" | "A" | "B" | "Refurbished";
  sort: "updated_desc" | "created_desc" | "stock_desc" | "name";
  page: number;
  pageSize: number;
};
```

默认筛选：

```ts
{
  q: "",
  brand: "all",
  modelSeries: "all",
  model: "all",
  catalogStatus: "all",
  stockStatus: "all",
  grade: "all",
  sort: "updated_desc",
  page: 0,
  pageSize: 20
}
```

主要本地状态：
- `products`: 当前页商品。
- `dataSource`: `{ source, label, syncedAt, total, returned, error? }`。
- `modelGroups`: 品牌/系列/型号级联数据。
- `selectedSkus`: 批量选择。
- `notice`: 成功、信息、警告、错误提示。
- `isLoading`: 列表读取中。
- `isMutating`: 保存或操作中。
- `drawerMode`: `view | edit | create | null`。
- `drawerProduct`: 当前抽屉商品。
- `stockAdjustProduct`: 当前库存动作商品。

## 商品 DTO 字段

API 返回给前端的商品字段应按下面兼容：

```ts
type AdminProductRow = {
  id?: string;
  sku: string;
  slug: string;
  name: string;
  category: string;
  brand: string;
  grade: "A+" | "A" | "B" | "Refurbished";
  price: number;
  b2bPrice?: number;
  retailPrice: number;
  costPrice?: number;
  margin?: number;
  stock: number;
  stockQty?: number;
  availableQty?: number;
  lockedQty?: number;
  actualQty?: number;
  status: "In Stock" | "Low Stock" | "Out of Stock";
  stockStatus?: "In Stock" | "Low Stock" | "Out of Stock";
  catalogStatus: "active" | "draft" | "hidden" | "blocked";
  storefrontVisible?: boolean;
  storefrontUrl?: string | null;
  catalogUrl?: string;
  visual: "screen" | "battery" | "cover" | "port" | "camera" | "flex" | "speaker" | "frame";
  warehouse: "Milano";
  moq: number;
  vatMode?: string;
  vatRate: number;
  rmaDays: number;
  warrantyDays?: number;
  leadTime: string;
  weightGram?: number;
  model?: string | null;
  modelSeries?: string | null;
  modelCode?: string | null;
  modelCodes?: string[];
  batchCode?: string | null;
  supplier?: string | null;
  compatibleWith: string[];
  tags: string[];
  imagePath?: string | null;
  imageUrl?: string;
  imageAlt?: string | null;
  galleryImagePaths?: string[];
  galleryImageUrls?: string[];
  updatedAt: string;
  createdAt?: string;
};
```

注意：
- `sku` 对外展示使用 public SKU，会经过 `toPublicSku` 清洗。
- `status` 是库存状态，UI 显示为 `In Stock`, `Low Stock`, `Out of Stock`。
- `catalogStatus` 是发布状态，UI 显示为 `active`, `draft`, `hidden`, `blocked`。
- `storefrontUrl` 只有 `catalogStatus === "active"` 时返回 `/prodotto/{sku}`，否则是 `null`。
- `catalogUrl` 按品牌和第一个适配型号生成 `/catalogo?brand=...&model=...`。

## API 契约

### 读取列表

`GET /api/admin/products`

Query：
- `limit`: 1 到 100，前端页大小为 10/20/50/100。
- `offset`: `page * pageSize`。
- `sort`: `updated_desc | created_desc | stock_desc | name`。
- `q`: 至少 2 个字符才传。
- `brand`, `modelSeries`, `model`, `catalogStatus`, `stockStatus`, `grade`。

返回：

```json
{
  "data": [/* AdminProductRow */],
  "meta": {
    "source": "supabase",
    "total": 123,
    "limit": 20,
    "offset": 0,
    "returned": 20,
    "storefrontLinkage": "products -> catalog_public_summary/catalog_buyer_prices"
  }
}
```

### 品牌/系列/型号

`GET /api/admin/products/model-groups`

返回 `data` 为：

```ts
type DeviceModelGroup = {
  brand: string;
  models: string[];
  series?: { series: string; models: string[] }[];
};
```

### 创建草稿

`POST /api/admin/products`

Body：

```json
{ "product": { /* ProductWritePayload */ } }
```

创建后后端强制 `catalogStatus = "draft"`，前台不可见。初始库存会同时创建 `inventory_items` 行。

### 更新商品内容

`PATCH /api/admin/products` 或 `PATCH /api/admin/products/{sku}`

Body：

```json
{ "sku": "SKU", "product": { /* ProductPatchPayload */ } }
```

限制：
- 不能通过 PATCH 改 SKU。
- 不能通过 PATCH 改库存数量或库存状态。
- 不能通过 PATCH 改发布状态。
- 库存必须走 stock-adjustments。
- 发布状态必须走 publish/hide/block/restore。

### 批量隐藏

`DELETE /api/admin/products`

Body：

```json
{ "skus": ["SKU1", "SKU2"] }
```

不是物理删除，只把商品状态改为 `hidden`。

### 单品状态动作

`POST /api/admin/products/{sku}/publish`
`POST /api/admin/products/{sku}/hide`
`POST /api/admin/products/{sku}/block`
`POST /api/admin/products/{sku}/restore`

Body 可选：

```json
{ "reason": "Product publish from admin products panel." }
```

返回保存后的商品。`publish` 成功后 `storefrontVisible = true`。

### 库存动作

`POST /api/admin/products/{sku}/stock-adjustments`

Body：

```ts
{
  action: "receive" | "cycle_count" | "release" | "scrap" | "rma_return";
  quantity: number;
  reason: string;
  batchCode?: string;
  supplier?: string;
}
```

规则：
- `quantity` 必须是 0 到 100000 的整数。
- `reason` 必填。
- `receive`, `rma_return`, `release`: 增加库存。
- `scrap`: 减少库存。
- `cycle_count`: 把库存校准为指定数量。
- 调整后库存不能小于 0。
- 会同步更新 `products.stock_qty`, `products.stock_status` 和 `inventory_items`。

### 图片

`POST /api/admin/products/{sku}/images`

用于上传文件，`multipart/form-data`：
- `file`: 必填，JPEG/PNG/WebP，最大 10MB。
- `imageAlt`: 可选。
- `reason`: 可选。
- `setPrimary`: 默认 true。

存储路径：

```txt
product-images/products/{lowercase-sku}/{uuid}.{jpg|png|webp}
```

上传后会把路径写入 `galleryImagePaths`，如果 `setPrimary !== "false"`，同时写入 `imagePath`。

`PATCH /api/admin/products/{sku}/images`

用于直接更新图片元数据：

```json
{
  "imagePath": "products/sku/file.webp",
  "imageAlt": "alt",
  "galleryImagePaths": ["products/sku/file.webp"],
  "reason": "..."
}
```

后端要求 `imagePath` 和 `galleryImagePaths` 必须位于 `products/{sku}/` 前缀下。

### 审计

`GET /api/admin/products/{sku}/audit?limit=30`

返回：

```ts
type ProductAuditEvent = {
  id: string;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  reason: string | null;
  createdAt: string;
};
```

## 表单字段

```ts
type ProductFormValues = {
  sku: string;
  name: string;
  category: string;
  brand: string;
  grade: "A+" | "A" | "B" | "Refurbished";
  price: string;
  retailPrice: string;
  costPrice: string;
  stock: string;
  moq: string;
  leadTime: string;
  compatibleWith: string;
  tags: string;
  model: string;
  modelCode: string;
  batchCode: string;
  supplier: string;
  imagePath: string;
  imageAlt: string;
};
```

新建默认值：

```ts
{
  sku: "",
  name: "",
  category: "Schermi",
  brand: "OEM",
  grade: "A+",
  price: "",
  retailPrice: "",
  costPrice: "",
  stock: "0",
  moq: "1",
  leadTime: "24/48h Italia",
  compatibleWith: "",
  tags: "",
  model: "",
  modelCode: "",
  batchCode: "",
  supplier: "",
  imagePath: "",
  imageAlt: ""
}
```

前端验证：
- `name`, `category`, `brand`, `leadTime` 必填。
- 新建时 `sku` 至少 2 个字符。
- `compatibleWith` 至少 1 个条目。
- `price` 必须是有效且不小于 0 的数字。
- `moq` 必须是大于等于 1 的整数。
- 新建时 `stock` 必须是大于等于 0 的整数。

列表字符串解析：
- `compatibleWith` 和 `tags` 支持逗号或换行分隔。
- 保存前去空白并过滤空项。

写入 payload 映射：

```ts
{
  sku,               // 仅 create
  name,
  category,
  brand,
  grade,
  price,             // 映射到 b2b_price
  retailPrice,       // 空则默认 price * 1.35
  costPrice,
  stock,             // 仅 create
  moq,
  warehouse: "Milano", // 仅 create
  compatibleWith,
  tags,
  model,
  modelCode,
  batchCode,
  supplier,
  imagePath,
  imageAlt
}
```

## 发布状态逻辑

状态枚举：
- `active`: 已上架，前台可见。
- `draft`: 草稿，前台不可见。
- `hidden`: 已隐藏，前台不可见。
- `blocked`: 已阻塞，前台不可见。

状态动作：
- `publish`: 目标状态 `active`。
- `hide`: 目标状态 `hidden`。
- `block`: 目标状态 `blocked`。
- `restore`: 目标状态 `draft`。

发布前后端校验必须满足：
- `sku_code` 非空。
- `name` 非空。
- `brand` 非空。
- `category` 非空。
- `moq > 0`。
- `b2b_price > 0`。
- `vat_mode` 非空。
- `warranty_days > 0`。
- `location` 非空。
- `supplier` 非空。
- `compatibility_models` 至少一个。
- `image_path` 非空。

## 库存状态逻辑

数据库状态：
- `in_stock`
- `low_stock`
- `out_of_stock`
- `incoming`

前端展示状态：
- `In Stock`
- `Low Stock`
- `Out of Stock`

后端库存状态规则：
- `stock_qty <= 0`: `out_of_stock`
- `stock_qty <= 5`: `low_stock`
- 其他：`in_stock`

前端指标中的低库存规则：
- `0 < product.stock < 10` 计为低库存。

表格库存显示：
- 状态 Badge。
- `availableQty / actualQty`。
- `lockedQty`。

## 权限逻辑

页面级：
- `/admin` 先调用 `getAdminAuthState()`，无权限跳转 `/login?next=/admin`。
- 商品管理挂在后台 `catalog` panel。

API 级权限：
- 读取列表/详情/型号组/审计：`product.read_admin`。
- 新建草稿：`product.create_draft`。
- 发布：`product.publish`。
- 隐藏：`product.hide`。
- 阻塞：`product.block`。
- 恢复草稿：`product.restore_draft`。
- 图片管理：`product.image_manage`。
- 库存动作：`product.adjust_stock`。
- 改价格：`product.edit_price`。
- 改成本：`product.edit_cost`。
- 改内容：`product.edit_content`。

兼容权限别名：
- `product.read_admin` 可由 `products.read_admin` 满足。
- 内容、发布、隐藏、图片等可由 `products.manage` 满足。
- 价格/成本可由 `products.pricing` 或 `products.manage` 满足。
- 库存动作可由 `inventory.manage` 满足。

## 数据库字段

核心表：`public.products`

关键字段：
- 身份：`id`, `sku_code`, `name`
- 分类：`brand`, `model`, `model_series`, `model_code`, `model_codes`, `category`
- 品质：`quality_grade`
- 库存：`stock_status`, `stock_qty`, `location`, `batch_code`, `supplier`
- 价格：`cost_price`, `retail_price`, `b2b_price`, `vat_mode`
- 售后/物流：`warranty_days`, `weight_gram`, `is_battery`, `is_dangerous_goods`, `msds_url`
- 适配：`compatibility`, `compatibility_models`, `alternative_skus`, `add_on_skus`, `highlights`
- 发布：`status`
- 媒体：`image_path`, `image_alt`, `gallery_image_paths`
- 时间：`created_at`, `updated_at`

关联表：
- `public.inventory_items`: 聚合 `actual_qty`, `available_qty`, `locked_qty`。
- `public.admin_audit_events`: 保存商品所有管理动作审计。
- `storage.objects` bucket `product-images`: 商品图片。

## 指标逻辑

基于当前页商品和 `meta.total` 计算：
- `total`: 后端查询总数。
- `active/draft/hidden/blocked`: 当前页按 `catalogStatus` 计数。
- `lowStock`: 当前页 `stock > 0 && stock < 10`。
- `missingImage`: 当前页无 `imagePath` 且无 `imageUrl`。
- `missingPrice`: 当前页 `price <= 0`。

注意：除 `total` 外，现有 UI 的状态计数是“当前页”计数，不是全库计数。

## 图片展示逻辑

优先候选：
- `imageUrl`
- `imagePath` 转 Supabase public URL
- `galleryImageUrls`
- `galleryImagePaths` 转 Supabase public URL

Supabase public URL：

```txt
{NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/{imagePath}
```

外部兜底：
- 如果路径或 URL 包含 `-{number}.jpg/png/webp/gif`，提取数字作为 Mobilax 图片 ID。
- 兜底 URL：`https://apiv2.mobilax.fr/v1.0/assets/images/products/id-image/{id}?size=bg`

如果全部失败，显示本地 `PartVisual` 占位图。

## CSV 导出

导出当前视图或所选商品，文件名：

```txt
partspro-prodotti-{view|selected}-{YYYY-MM-DD}.csv
```

字段：
- `sku`
- `name`
- `category`
- `brand`
- `grade`
- `catalogStatus`
- `stock`
- `stockStatus`
- `price`
- `retailPrice`
- `updatedAt`

## UI 文案和本地化

现有页面内置中文和意大利语两套商品管理文案。通用枚举从 `getAdminDictionary(locale).admin.enums` 读取：
- `catalogStatus.active/draft/hidden/blocked`
- `stockStatus.In Stock/Low Stock/Out of Stock`
- `productGrade.A+/A/B/Refurbished`

新 UI 可以重排布局，但建议继续使用现有文案 key 和枚举映射，避免状态文本漂移。

## 交互细节

列表刷新：
- 筛选变化后约 180ms 防抖刷新。
- 请求使用 `AbortController`，切换筛选时取消旧请求。
- 成功后清空选择和 notice。
- 失败后清空列表，写入 error notice。

保存后局部更新：
- 新建、更新、状态动作、库存动作、图片保存都使用 API 返回的商品替换当前列表中的同 SKU 商品。
- 如果新建商品不在列表中，把商品插到当前页最前面。
- 保存后更新 `syncedAt`。

复制为草稿：
- SKU 默认 `{原SKU}-COPY`。
- 如果当前页已有同名 SKU，递增为 `{原SKU}-COPY-2`, `{原SKU}-COPY-3`。
- 名称追加 `副本`。
- 新商品创建为 `draft`。

详情抽屉：
- 宽度约 `min(960px, 100vw)`。
- 详情模式支持 inline edit。
- 编辑时 SKU 只读。
- 编辑时库存只读，必须点击库存动作。

库存动作弹窗：
- 默认 action 为 `receive`。
- 默认 quantity 为 `1`。
- reason 初始为空且必填。

审计 Tab：
- 打开后请求 `GET /api/admin/products/{sku}/audit?limit=30`。
- 支持 loading、error、empty 三种状态。

## 新 UI 需要避免的错误

- 不要在前端直接改 `catalogStatus` 后假装保存，必须调用对应 action API。
- 不要在编辑表单里直接改库存，库存必须走库存动作弹窗。
- 不要把隐藏当作删除，删除 API 实际是隐藏。
- 不要把 `status` 和 `catalogStatus` 混淆，前者是库存状态，后者是发布状态。
- 不要只做桌面表格，现有功能有移动卡片。
- 不要丢掉审计、图片上传、批量隐藏、CSV 导出、级联型号筛选。
- 不要改变图片路径前缀规则。
- 不要把发布校验只做前端提示，后端已经会拒绝不可发布商品。

## 主要源码参考

- `src/components/partspro/admin-products-panel.tsx`: UI、状态、表单、请求、CSV、图片兜底。
- `src/app/api/admin/products/route.ts`: 列表、创建、更新、批量隐藏。
- `src/app/api/admin/products/_schemas.ts`: query/write/patch/action/stock/images 的 zod schema。
- `src/app/api/admin/products/_dto.ts`: 后端商品到前端 DTO。
- `src/app/api/admin/products/[sku]/_actions.ts`: publish/hide/block/restore。
- `src/app/api/admin/products/[sku]/stock-adjustments/route.ts`: 库存动作。
- `src/app/api/admin/products/[sku]/images/route.ts`: 图片上传和元数据更新。
- `src/app/api/admin/products/[sku]/audit/route.ts`: 审计读取。
- `src/lib/partspro-repository.ts`: Supabase RPC 调用、字段映射、错误转换。
- `src/lib/partspro-admin-auth.ts`: admin session 和权限判断。
- `supabase/migrations/20260525233226_admin_product_management.sql`: 商品管理 RPC、审计、库存、图片权限。
- `supabase/migrations/20260527181136_fix_product_model_series_edges.sql`: 最新商品列表 RPC 和型号系列筛选。
