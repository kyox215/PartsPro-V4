# 派单 dry-run 示例

这些示例用于验证 AI 员工部门制能不能把老板任务分清楚，不代表真实待办。

## 示例 1：checkout 金额异常

- 建议路径：`urgent/P1-2026-06-08-checkout-total-mismatch.md`
- 主责部门：订单运营部
- 协作部门：价格与客户部、仓库库存部
- 工程守门代理：PartsPro 业务契约代理、Next.js 16 App Router 代理、前端体验代理
- 验收：购物车、preview、订单保存、后台订单金额一致；服务端重算不接受客户端金额真相。

## 示例 2：Mobilax 到货导入

- 建议路径：`now/P2-2026-06-08-mobilax-arrival-import.md`
- 主责部门：采购到货部
- 协作部门：商品目录部、仓库库存部
- 工程守门代理：供应商到货导入代理、Supabase RLS/权限代理、Supabase Migration 守门代理
- 验收：先只读 preflight，再确认导入声明，写库后核对数量、金额、库存、批次、审计事件和图片状态。

## 示例 3：客户等级价格调整

- 建议路径：`now/P2-2026-06-08-customer-level-pricing.md`
- 主责部门：价格与客户部
- 协作部门：订单运营部、前端体验代理
- 工程守门代理：PartsPro 业务契约代理、Supabase RLS/权限代理
- 验收：客户等级、价格 resolver、前台展示、checkout preview 和订单保存价一致。

## 示例 4：eBay 库存同步失败

- 建议路径：`urgent/P1-2026-06-08-ebay-inventory-sync-failed.md`
- 主责部门：电商渠道部
- 协作部门：商品目录部、仓库库存部、订单运营部
- 工程守门代理：PartsPro 业务契约代理、Vercel 发布代理
- 验收：队列错误可追踪，eBay 刊登库存不超过本地可售库存，失败任务可安全重试。

## 示例 5：准备发布

- 建议路径：`now/P1-2026-06-08-release-readiness.md`
- 主责部门：平台发布部
- 协作部门：文档审计部
- 工程守门代理：Next.js 16 App Router 代理、Supabase Migration 守门代理、Vercel 发布代理
- 验收：确认 migration 状态、`npm run lint`、`npm run build`、deployment URL、alias 和线上 smoke test。
