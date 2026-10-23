# 后台订单界面排版与层级调整

## 范围

沿用前台个人中心的蓝白卡片、浅色图标及蓝色选中态。桌面和手机共用总览、付款、物流、商品、历史五个栏目；保留现有订单状态流、收款/物流/缺货/打印/撤销/作废的接口与权限。

- 列表流程筛选改为图标卡片，归档和待办分组折叠；日期与排序集中放置。
- 商品在手机呈卡片、桌面呈表格，名称完整换行；正常商品默认全给的提示只出现一次，详细数量按需展开。
- 明细主体独立滚动，主操作固定在底部；打印为次要操作，撤销/取消/作废收进更多操作。
- 三语文案随现有语言设置切换；保留客户税号、等级及金额等既有资料。

## 源码边界

- 正式基线：部署 `dpl_Fy7dz2cHvJeapsj3SRHFHYyKSCAv`；源码提交 `17a6b0c9e5b68191c866e9ebc0d166b369cac3b9`。
- 分支：`codex/orders-current-style-20261023`。
- 隔离工作树：`.codex-worktrees/orders-current-style-20261023`。主目录其他未提交内容未纳入发布。
- 正式部署完整上传清单共476个源文件，475个与候选相同；唯一既有运行文件变化为 `admin-orders-panel.tsx`，另新增 `admin-order-presentation.ts`。
- AST对比的209项命名函数/操作中，192项完全不变；变化集中在显示组件及栏目切换未保存保护，移除5个重复视觉辅助组件/函数。API、序列化、数量/金额归一化和状态推进处理函数不变。
- 无API、依赖、schema、migration或环境变量变更；无生产业务写入。

## 验证

- `npm run lint`：通过。
- `npm run test:storefront`：24项通过。
- `node --test tests/admin-orders-state.test.mjs tests/admin-order-pagination.test.mjs`：17项通过，其中3项覆盖栏目切换的未保存及提交中保护。
- `npm run build`：通过；最后的税号展示补齐后已再次构建及定向lint，通过。
- `git diff --check`：通过。
- 浏览器使用实际订单组件、真实字典和构建CSS，接口及订单为明确标注的本地合成数据。中/意/英、320/390/768/1440px、五栏目，共60组几何检查无整页横溢、弹层越界或主操作栏遮挡。后续修复窄屏长栏目文字换行并补回税号显示。
- 已实际验证缺货原因必填、缺货保存成功后更新数量、付款保存成功后更新状态、缺货及付款403失败保留草稿、无单号禁止发货。390×400缺货弹窗可滚动至取消/保存。
- 未保存确认框触发后，浏览器工具被原生弹窗阻塞；该交互的自动验证未完成，不计为浏览器通过，三个定向回归覆盖其逻辑。物流保存、更多操作弹窗、只读权限的最终浏览器检查仍待补验。

## 证据及限制

证据位于项目根目录 `outputs/order-current-style/2026-10-23/`：

- `browser-layout-matrix.json` 与 `screenshots/`：组件布局检查和目视截图。
- `baseline-source-tree.json`、`baseline-fingerprint-comparison.json`、`source-contract-comparison.json`：正式源文件及函数差异。
- `fixture-metrics-phase1.json` 和 `local-runtime/metrics.json`：本地合成接口请求记录。

合成数据验证不代表真实订单写入E2E；未进行真实收款、缺货登记、退款、订单推进或取消。未验证实物手机软键盘与Safari真机。

## 发布

待候选部署构建、只读检查及同构建域名推广。回退目标为上述正式基线，无数据库回滚步骤。

