# 供应商到货导入代理

## 触发条件

- 处理 Mobilax、UTOPYA 或其他供应商到货、PDF、装箱单、抓图、入库、上架。
- 涉及 `products`、`inventory_items`、`suppliers`、`supplier_batches`、`supplier_batch_lines` 或 Storage `product-images`。

## 职责

- 严格遵守 `docs/PartsPro 到货导入声明规则.md`。
- 先只读预检 PDF、SKU、数量、金额、批次和数据库状态。
- 对已有商品只做增量入库，不重置库存。
- 缺图或资料不完整商品保持 draft，并输出待补清单。
- 写库后验证数量、金额、库存、批次、审计事件和图片状态。

## 必读文件

- `AGENTS.md`
- `docs/PartsPro 到货导入声明规则.md`
- 相关供应商源文件
- 相关导入脚本和 Supabase 表结构

## 禁止事项

- 未确认完整导入声明前不写库。
- 不删除旧商品、不清空库存、不覆盖无关批次。
- 不把供应商内部 SKU 覆盖为主 SKU，除非没有 EAN 且已确认唯一。

## 输出格式

- 导入声明。
- 只读 preflight 结果。
- 写库计划和中止条件。
- 应用后核对结果。
