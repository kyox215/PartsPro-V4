# P1-2026-08-09-compatibility-review-prevention-hardening

状态：in_progress

看板目录：now

优先级：P1

Task ID：TASK-20260809-01

风险等级：R2

自治等级：L1

## 老板原始目标

“在后台商品新建/编辑及 Excel/CSV/TSV 预览中，检测商品标题包含多个品牌或多个机型、但 `compatibility_models` 或标准化兼容关系疑似不完整的情况；只生成 candidate warning，不自动推断、批准、拆分 SKU 或修改库存；必须人工确认后才能继续保存或导入。”

## 目标

建立一个可复用、只产生候选提示的兼容性完整度检查，覆盖后台商品新建/编辑和 Excel/CSV/TSV 导入预览。检测到“标题多品牌/多型号，但结构化兼容字段或 normalized relation 不完整”时，展示可追溯的 `candidate_warning`，要求操作者逐条人工确认后才允许继续保存/导入；系统不得借此自动推断兼容、自动 approval、拆 SKU，或新增库存数量、图片、PDC、订单和锁货动作。

导入 v1 的业务契约保持不变：仅允许 product-master create/update；本任务不新增库存数量、图片、`product_device_compatibilities`（PDC）、订单或锁货动作。当前导入 create 仍按 `stock=0` 调用既有 RPC，而该 RPC 会创建 0 数量 `inventory_items` 行；当前导入 update 仍调用既有 RPC，而该 RPC 会刷新既有 inventory metadata/`last_movement_at`；product-master 导入现有 contract 允许价格字段。这些是既有契约残余，不是本任务扩张，兼容关系审批和后续 migration 必须另立 owner-approved 任务。

## 业务影响

降低新商品和供应商导入再次出现“商品标题写有 Redmi 13C 等机型，但左侧菜单/筛选找不到”的概率，及时暴露结构化目录缺口，同时避免把不确定的标题解析直接变成生产兼容关系或库存动作。保持一商品一 SKU 一库存的业务身份和导入 v1 的安全边界。

## 完成定义

- 后台新建/编辑与导入预览使用同一检测契约，能够展示标题证据、当前 `compatibility_models`、已存在 normalized relation 状态和 warning 原因。
- 触发候选 warning 的保存/导入操作在人工确认前不可继续；确认只代表操作者核对候选，不等于系统自动 approval，也不新增兼容关系、PDC、库存数量、图片、订单或锁货动作。
- 导入 v1 仍只有 product-master create/update。本任务的代码路径和针对性测试验证新增的是 gate；apply 仍调用既有 create/update RPC，不能把测试/spy 结果表述为数据库不存在既有库存行、metadata 刷新或价格字段行为。
- 误报/漏报、取消确认、重复预览、刷新和失败重试均有针对性验证；未修改当前 dirty worktree 中无关 hunk。
- 完成证据包括本地 lint/build/类型和针对性测试；若需要上线，Vercel 发布、观察和回滚单独记录。任务在这些证据齐全前不得标记 verified/released/closed。

## 主责部门

商品目录部

## 协作部门

采购到货部、前端体验部、平台发布部、PartsPro 业务契约部

## 工程守门代理

Next.js 16 App Router 代理、前端体验代理、PartsPro 业务契约代理；若实际进入线上发布，再加入 Vercel 发布代理。当前不新增 Supabase migration；本阶段验证未执行数据库写入，apply 仅保留既有 product-master RPC 契约。

## RACI

| Role | Owner |
|---|---|
| Responsible | 商品目录部 |
| Approver | 老板（鹤祥） |
| Consulted | 采购到货部、前端体验部、平台发布部、PartsPro 业务契约部 |
| Informed | 文档审计部、仓库库存部 |

## 涉及范围

- 页面：后台商品新建、商品编辑、Excel/CSV/TSV 导入预览和导入确认页。
- API/模块：商品 master create/update、导入解析/预览/确认路径、共享的 compatibility completeness detector；只读读取结构化兼容字段，不扩展导入写入范围。
- 数据表/RPC：detector 只对 `products.compatibility_models` 及现有 `compatibilityManaged`/approved projection 做读取比较，不声称读取 live relation count；`device_models`、`product_device_compatibilities` 仅作为既有结构化关系契约边界。apply 仍按既有 product-master create/update RPC 执行。本任务不新增或修改 migration，不新增库存数量、图片、PDC、订单或锁货动作；既有 create RPC 在导入 `stock=0` 时会创建 0 数量 `inventory_items` 行，既有 update RPC 会刷新 inventory metadata/`last_movement_at`，product-master 导入允许价格字段，均列为残余契约而非本任务扩张。
- 文档：本任务卡、导入 v1 契约和候选 warning 验证记录；不把候选 warning 当成最终兼容账本或批准记录。
- 外部系统：detector/preview 使用现有 Supabase 读路径；apply 若经操作者确认仍只调用既有 product-master create/update RPC，不新增本任务的 DB 动作；Vercel 只有明确批准线上发布时才参与，且与数据库动作分离。

## 已知事实

- 现有目录逻辑依赖结构化兼容字段/normalized relations，不会可靠地从商品标题实时补齐左侧机型菜单；因此标题与结构化字段不一致会形成可见缺口。
- 后台商品编辑和供应商文件导入是两个独立入口；若只修一个入口，下一次到货仍可能重新引入不完整数据。
- PartsPro 导入 v1 已限定为 product-master create/update；库存、图片、PDC 等后续动作不在该版本契约内。
- 本任务 gate 的当前结构化证据是 `compatibilityManaged` 加上既有 approved compatibility projection/legacy fields；不能把它写成 live `product_device_compatibilities` relation count 查询。
- 当前工作区存在大量未提交的后台、首页、分析、PWA、REMAX、migration 等并行改动；本任务必须按 hunk 级别保护，不能格式化、回退或覆盖无关文件。
- 候选 warning 的证据只能说明“需要人工复核”，不能证明真实硬件兼容；标题中的品牌/型号、斜杠和代码均可能含歧义。

## 假设与未知项

- detector 可以复用已有品牌/机型词典和结构化关系读取，但不会以相似名称、连接器、外观或型号代码自动建立关系。
- 已核对保存契约：create 仅按 legacy product-master 字段写入；managed 商品的通用兼容字段 patch 被 API/import gate hard-block；本任务不改变专用兼容关系写入权限。
- 已确认前端采用逐行、可取消、不可静默跳过的人工确认；中/意双语 warning 文案、alert 证据和 checkbox 入口已落地，authenticated 浏览器 smoke 仍受本地登录态限制。
- 已确认采用保守标题证据规则（跨品牌/多型号触发，型号代码、年份和网络版本作例外过滤）；detector 20 tests 已覆盖代表样本，不自动放行不确定关系。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP1：检测契约与候选证据 | 商品目录部 + 业务契约部 | 定义 `candidate_warning` 字段、触发条件、标题/结构化字段差异、`compatibilityManaged` + approved projection 状态和可审计 reason code；不产生 approval | 现有 products/catalog/import DTO 只读盘点 | 同一输入在商品表单和 Excel/CSV/TSV 导入预览得到一致结果；型号代码不会被当作新设备 |
| WP2：后台新建/编辑门禁 | 商品目录部 + 前端体验部 | 新建/编辑页显示 warning、证据和人工确认；未确认前阻止保存继续；确认只放行 master payload | WP1；Next.js/前端审查 | 无自动兼容推断/approval/PDC/库存数量动作新增；取消、返回、重试状态可验证 |
| WP3：导入预览门禁 | 采购到货部 + 商品目录部 | Excel/CSV/TSV（含 TSV 解析）逐行 warning、人工确认和导入 v1 范围校验；只允许 product-master create/update | WP1；既有导入 v1 core/preview | warning 行未确认不能导入；验证本任务未新增库存数量、图片、PDC、订单或锁货动作，并记录既有 RPC 残余 |
| WP4：验证、发布与回滚准备 | 平台发布部 + PartsPro 业务契约部 | lint/build/类型/针对性测试、dirty hunk 审查、部署 smoke（若批准）和可执行回滚记录 | WP2/WP3；发布授权 | 证据区分本地验证与生产发布；任何失败可回到上一稳定部署/本任务 hunk，不触碰数据库数据 |

## 批准要求

- 是否需要老板批准：需要。批准本任务的 warning 规则、人工确认门槛和导入 v1 不扩范围；任何最终兼容关系审批仍必须进入独立 owner-approval 账本。
- 是否需要 Supabase migration 安全门：本任务不新增、不修改、不应用 migration，不直接写 Supabase；现有 product-master RPC 的既有副作用不因本任务扩张。若实现过程中需要 schema、PDC、RLS、grant 或数据回填，必须暂停、重新分级并新建 migration 任务。
- 是否需要 Vercel 发布门：只有老板明确授权发布代码时需要；发布与任何未来 migration 分开执行。未授权时只做本地验证。
- 是否需要 PartsPro 业务契约验收：需要，确认 product-master create/update 与库存、图片、PDC、订单边界没有扩大。
- dirty worktree 批准：只允许提交本任务相关 hunks；不得把并行后台、REMAX、PWA、分析或其他 migration 改动混入本任务。

## 验收标准

- 标题包含多个品牌/多个机型，而 `compatibility_models` 或 normalized relation 明显不完整时，后台新建/编辑和 Excel/CSV/TSV 预览均展示 `candidate_warning`，包含 SKU/行号、标题片段、当前结构化值、relation 状态和 reason code。
- 单品牌单机型、已有完整 approved relation、或仅含型号代码别名的输入不会被无依据拆成多个兼容模型；测试需覆盖跨品牌、斜杠、括号、年份/网络版本和代码例外。
- warning 未被操作者逐条人工确认时，保存/导入按钮不能继续；取消、返回、解析错误、重复确认和刷新不会绕过门禁。人工确认只改变当前操作的 gate 状态，不自动写 approved relation。
- 确认后后台只按原有 product master contract 保存；导入 v1 只执行 product-master create/update。代码审查与针对性测试验证本任务未新增库存数量、图片、PDC、订单或锁货动作，但不把它写成 spy 证明不存在既有 RPC 副作用：导入 create 仍以 `stock=0` 创建 0 数量 inventory row，update 仍刷新 inventory metadata/`last_movement_at`，且现有导入 contract 允许价格字段。
- 不创建第二商品、SKU、库存池或菜单设备；不修改既有 approved/rejected compatibility relation；不把 warning 数量当成 approved 数量。
- 相关测试、lint、build、TypeScript 检查通过；本任务 diff 只包含任务卡（及后续获批的实现 hunks），当前 dirty worktree 其他改动保持原样。
- 若获发布授权，Vercel deployment READY、关键表单/预览 smoke 通过，观察期和回滚阈值记录完整；否则不得声称线上已修复。

## 禁止事项

- 禁止根据标题、相似名称、连接器/外观或型号代码自动推断、approve、创建 `device_models`、写 PDC 或更新 `compatibility_models`。
- 禁止以 warning 机制为理由拆 SKU、复制商品、改变库存/锁货/价格/成本/订单/图片/批次或发布状态；禁止把既有 RPC 的库存行/metadata 或价格字段行为错误写成“零写入”事实。
- 禁止绕过人工确认继续保存/导入；禁止把“已看过 warning”默认为批准；禁止静默丢弃 warning 行。
- 禁止扩大导入 v1 为库存、图片或兼容关系导入；禁止在本任务创建或应用 Supabase migration、RLS、grant 或生产回填。
- 禁止覆盖、格式化、回退当前 dirty worktree 的无关文件或混入其他代理的 hunks；禁止使用 broad formatter 造成不可审计噪音。
- 禁止未经明确授权推送 Vercel、修改线上环境变量或将发布和未来数据库 migration 绑定执行。

## 验证命令

任务卡和后续实现均应按范围运行：

```bash
git diff --no-index --check /dev/null docs/tasks/now/P1-2026-08-09-compatibility-review-prevention-hardening.md
git diff --check -- docs/tasks/now/P1-2026-08-09-compatibility-review-prevention-hardening.md
```

若 WP2/WP3 获批进入代码实现，再运行：

```bash
npm run lint
npm run build
npx tsc --noEmit --incremental false
node --test tests/partspro-product-import-core.test.mjs
```

并补充 detector、表单保存 gate、导入预览 gate、managed 保护、TSV 解析、取消/重试和代表性浏览器 smoke。验证应记录本任务未新增库存数量、图片、PDC、订单或锁货动作，并单独说明既有 create/update RPC 的 inventory/price 残余；不要声称 spy 证明不存在这些既有行为。若发布获批，另行记录 Vercel deployment、回滚版本和观察指标；本任务不运行 `supabase db push`。

## 回滚计划

- 本任务默认无 migration、无生产数据写入，因此首选回滚是撤销本任务实现 hunks或关闭独立 feature flag，恢复上一版表单/预览行为。
- 若代码已发布，平台发布部将上一稳定 Vercel deployment 提升为正式版本；回滚不得触发 Supabase migration 或库存/订单回填。
- 已被操作者人工确认的 product-master 操作不自动反向删除；如发现业务数据错误，必须另立数据修复任务并保留审计，不在本任务中做破坏性回滚。
- detector 规则误报只回滚规则/文案，不把候选直接升级为 approved；保留失败样本用于下一轮规则修订。

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| AGENTS.md、任务模板、TASK_FLOW、Next.js route docs 与两项 PartsPro skill 阅读 | passed | 已读取仓库守则、任务模板、Route Handler/动态 params 契约、`partspro-fullstack-audit` 与 `partspro-compatibility-review`；状态保持合法的 `in_progress` |
| 当前 dirty worktree 基线与 scoped diff stat | passed | 并行后台、REMAX、PWA、分析、migration 等改动已识别；只核对本任务实现文件与本任务卡，未格式化、回退或混入无关 hunks |
| scoped `git diff --check`（tracked + untracked guard/task card） | passed | 实现文件和任务卡无 whitespace error；新 guard 与任务卡用 `git diff --no-index --check /dev/null ...` 检查 |
| detector/TSV targeted tests | passed | `npm run test:product-import`：20/20 通过；包含 Excel-style TSV 解析、跨品牌/斜杠/括号/年份/网络版本与型号代码例外、fingerprint 覆盖 |
| API/import/UI gate 与 managed 保护只读复核 | passed (static) | collection/[sku] route 在 Zod/RPC payload 外读取顶层 confirmation；apply 逐行校验 missing/duplicate/unexpected/malformed/fingerprint；表单与导入逐条 checkbox gate，managed compatibility 字段只读/拒绝直接 patch |
| `npx eslint` scoped implementation files | passed | detector、guard、collection/[sku] routes、import core/apply、import dialog、admin panel、targeted test 无 lint error |
| `npx tsc --noEmit --incremental false` | passed | TypeScript 全量检查通过 |
| `npm run lint` | passed | 全仓 ESLint 通过 |
| `npm run build` | passed | Next.js 16.2.6 webpack production build、TypeScript、静态页和 route manifest 全部通过 |
| `partspro-fullstack-audit` contract scan | passed | 只读扫描完成；当前 Next checkout 无 service/type 文件可供该扫描进一步关联，未执行写入 |
| Supabase migration / production write | not applicable / not executed | 本任务无 migration、无直接 DB 写入、无 `supabase db push`；既有 RPC inventory/price 残余已在本卡记录 |
| route-level static review / browser smoke | route static passed; browser blocked | Next 16 Route Handler params/envelope 契约静态复核通过；本地 `http://127.0.0.1:3210/admin` 与 `/login?next=/admin` 加载正常，但浏览器处于未认证 Supabase 会话，未读取或使用凭据，无法进入 authenticated 表单/导入交互 |
| Vercel publish/smoke | not executed | 未获发布授权；不声称线上已修复 |

## 执行记录

- 创建：2026-08-09，建立 compatibility review prevention hardening 任务卡。
- 批准：2026-08-09，老板“开始规划下一阶段并开始执行”，作为本阶段 warning 规则、人工确认门槛和导入 v1 边界的实施批准；最终兼容关系审批仍需独立 owner-approval。
- 开始：2026-08-09，进入 in_progress 规划/执行阶段并完成本地实现验证。
- review：2026-08-09，Next route contract、React 状态/门禁、导入 product-master 边界与 managed 保护完成静态复核；浏览器 smoke 被本地未认证会话阻塞，登录页加载正常且未使用凭据。
- verified：本地 detector/TSV/API/import/UI 门禁、scoped lint、全量 lint、TypeScript、build 已通过；任务仍保持 in_progress，未宣称发布或关闭。
- released：未开始。
- closed：未开始。

## 残余风险

- 标题可能含供应商缩写、错拼、型号代码或真实跨品牌兼容，候选 detector 只能提高发现率，不能替代技术证据和 owner approval。
- 人工确认仍可能被误用；需保留 warning reason、输入快照和操作结果，后续再评估更细粒度审计。
- 现有 dirty worktree 复杂，若未按 hunk 级别提交可能把无关改动混入发布；平台发布部必须复核范围。
- 既有 product-master RPC 的契约残余必须持续显式记录：导入 create `stock=0` 仍创建 0 数量 `inventory_items` 行，update 刷新 inventory metadata/`last_movement_at`，导入允许价格字段；本任务未扩张这些行为，也没有 spy 证明它们不存在。
- 该任务不修复历史缺失兼容关系；历史候选仍需独立审计/批准任务处理。

## 结果

任务卡已将兼容性缺口的预防机制限定为“候选 warning + 人工确认门禁”，并记录 detector 20/20、API/import/UI gate、managed 保护、TSV、TypeScript、lint/build 与 dirty worktree 证据。实现未新增 migration、直接 DB 写入或 Vercel 发布；既有 import create/update RPC 的 inventory/price 残余已按准确契约记录。route 级静态复核通过；浏览器 smoke 已确认登录页链路，但 authenticated 表单/导入交互被本地未认证会话阻塞；任务保持 in_progress。
