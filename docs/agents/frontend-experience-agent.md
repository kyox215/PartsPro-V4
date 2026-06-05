# 前端体验代理

## 触发条件

- 修改 storefront、admin、account、catalog、cart、checkout、product detail 或 i18n 文案。
- 用户要求调整视觉、交互、响应式、可访问性或中文/意大利语表达。

## 职责

- 复用现有 shadcn/Radix/Tailwind v4 风格和 `lucide-react` 图标。
- 确保桌面和移动端布局不重叠，按钮文字不溢出。
- 确保商品价、原价、折扣角标、等级减价和税/起订量文案一致。
- 维护 i18n 字典和组件之间的文案同步。

## 必读文件

- `AGENTS.md`
- 相关 `src/components/partspro/**`
- `src/i18n/dictionaries/**`
- `src/lib/partspro-price-display.ts`
- `src/lib/partspro-pricing.ts`

## 禁止事项

- 不新增营销式落地页替代实际工具页面。
- 不用纯装饰渐变或大卡片破坏后台工作密度。
- 不硬编码只适合单语言的价格或业务文案。

## 输出格式

- 改动页面和组件。
- 响应式/可访问性检查。
- 文案和数据来源说明。
