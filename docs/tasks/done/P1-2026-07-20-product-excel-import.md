# P1-2026-07-20-product-excel-import

状态：verified

看板目录：done

优先级：P1

Task ID：TASK-20260720-03

风险等级：R2

自治等级：L2

## 老板原始目标

在后台商品项目增加 Excel 表格导入，声明所需字段，支持导出预览，并把已经整理好的资料直接复制到预览；开发完成后由独立只读审查线程按六个维度验证，主线程修复并循环复验。

## 目标

交付一个面向非技术员工的商品批量导入向导，覆盖模板下载、Excel/CSV/粘贴资料、服务端预览校验、预览工作簿导出和确认应用。

## 业务影响

降低商品建档成本，同时保护价格、成本、库存、发布状态和员工权限边界。

## 完成定义

- 商品页可以下载模板、上传或粘贴资料、查看校验结果、导出真实预览并确认导入。
- 新建和更新沿用现有单行事务 RPC；库存、图片和发布保留为商品详情中的专用操作。
- lint、build、针对性验证和实际页面流程有证据。
- 独立审查线程完成六维度检查，修复清单清零或留下明确阻塞。

## 主责部门

商品目录部

## 协作部门

仓库库存部、平台发布部、文档审计部

## 工程守门代理

Next.js 16 App Router 代理、PartsPro 业务契约代理、前端体验代理、独立审查线程

## RACI

| Role | Owner |
|---|---|
| Responsible | 主线程 |
| Approver | 老板 |
| Consulted | 商品目录部、仓库库存部 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：后台商品列表、商品批量导入向导
- API：商品模板、预览、预览导出、应用
- 数据表/RPC：沿用 products、inventory_items、admin_audit_events 及现有商品 RPC
- 文档：本任务卡
- 外部系统：无

## 已知事实

- 当前商品列表只有浏览器侧 CSV 导出，无法回导。
- REMAX 已有 5MB/500 行、previewHash、重新校验后应用的安全骨架。
- 库存必须走 `admin_adjust_product_stock`，发布必须走 `admin_publish_product`。

## 假设与未知项

- 第一版不批量导入库存、图片或发布状态，避免跨 RPC 半完成、SSRF 和无效图片路径。
- 第一版强制显式 SKU，不使用数据库自动生成 SKU。
- 更新行的空单元格表示保持原值；第一版不支持批量清空字段。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | 主线程 | 字段契约、模板和解析器 | 现有商品 schema | 模板可下载并解析 |
| WP-02 | 主线程 | 预览、导出和应用 API | WP-01 | 服务端重算 hash 并执行权限检查 |
| WP-03 | 主线程 | 响应式导入向导 | WP-02 | 桌面与移动端流程完整 |
| WP-04 | 主线程 | 静态、构建与运行验证 | WP-01~03 | 验证命令通过 |
| WP-05 | 独立审查线程 | 六维度只读审查与复验 | WP-04 | 无 blocker/major 或明确阻塞 |

## 批准要求

- 是否需要老板批准：老板已明确要求开发
- 是否需要 Supabase migration 安全门：当前方案不新增 migration；若审查要求事务批次 RPC，则进入安全门
- 是否需要 Vercel 发布门：否，本任务不自动发布
- 是否需要 PartsPro 业务契约验收：是

## 验收标准

- 模板清楚声明字段、默认值、枚举和填写示例。
- 同一解析器支持 XLSX、CSV 和粘贴表格。
- 预览能区分新增、更新、跳过、可新建草稿、可更新和阻断。
- 预览文件包含摘要、商品预览、字段差异、错误清单和标准化数据。
- 缺少所需权限、重复 SKU、非法字段或旧 previewHash 时禁止应用。
- 新商品默认草稿；库存、图片与发布继续使用商品详情中的专用动作。

## 禁止事项

- 不导入库存、图片路径或发布字段。
- 不把浏览器预览当作可信写入参数。
- 不自动应用 Supabase migration 或发布 Vercel。
- 不覆盖工作区中与本任务无关的既有修改。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `npm run test:product-import` | passed | 6/6：SKU 别名、非法字段 skip 门、TSV、quoted CSV/CRLF、列表去重 |
| `git diff --check` | passed | 当前任务工作树无空白错误 |
| `npm run lint` | passed | ESLint 无报错 |
| `npx tsc --noEmit` | passed | TypeScript 无报错 |
| `npm run build` | passed | Next.js 16.2.6 生产构建成功；4 个商品导入路由进入构建产物 |
| runtime smoke | partial pass | `/admin` 返回 200；未登录模板接口按预期返回 401 / `ADMIN_FORBIDDEN` |
| authenticated browser / DB write | not run | 无可用后台登录浏览器会话，且 linked Supabase 按生产敏感项目处理；本任务未写数据库 |
| independent review | PASS WITH MINOR | 同一只读审查线程三轮复验；BLOCKER/MAJOR 清零 |

## 执行记录

- 创建：2026-07-20
- 批准：老板本次指令
- 开始：2026-07-20
- review：2026-07-20，独立线程 `019f8185-8f42-7533-b2b6-702fee6b20ef`
- verified：2026-07-20
- released：not requested
- closed：2026-07-20

## 结果

- 已交付后台商品 Excel/CSV/粘贴导入向导、字段声明模板、服务端预览、预览工作簿导出、previewHash 重验和确认应用。
- 第一版仅处理商品主数据新增/更新；新商品默认草稿，库存、图片、发布仍走专用页面动作。
- 导入与 repository 共用同一个最终 SKU 规范化实现；重复别名、非法字段、无权限和过期预览会被服务端阻断。
- 独立审查经过三轮：首轮 FAIL → 主线程修复 → 二轮 FAIL → 主线程修复 → 三轮 PASS WITH MINOR。
- 残余 MINOR：XLSX 的 500 行/100 列检查发生在 ExcelJS 完整载入之后，后续可增加流式解析、解压体积和解析超时保护。
