# P1-2026-10-11-admin-mobile-density

Task ID: TASK-20261011-MOBILE; Risk R2; Autonomy L2.
主责：商品目录部。协作：订单运营、仓库库存、前端体验、平台发布。
RACI：主助手负责商品/目录/共享框架；模块助手负责其余后台；老板批准设计及实施；平台发布专项核对发布门禁。

目标：手机后台高密度显示，商品默认列表可切换双列，全局顶部模块切换＋菜单，无固定底部导航。覆盖全部现有后台模块，桌面保持表格。
授权：用户已接受规划并要求 Implement the proposed plan；沿用本会话完成后推送、部署授权。数据库迁移须独立审批，本任务无新增 migration。禁止真实商品、库存、订单、付款、权限、消息等业务写验收。
基线：d4f37a0，隔离分支 codex/admin-mobile-density-20261011；主目录既有改动不纳入。
范围：后台客户端组件、admin限定样式、偏好状态、模块深链接；不改API/RPC/数据库契约。

验收：390×700 CSS viewport 首条目录<=200px、>=6条完整目录/5条完整商品；320/360/390/430/768/1280无页面溢出；中意语言、长内容、view切换、筛选选择、编辑失败/返回、手机详情及desktop恢复；44px点击、12px以上辅助字号、16px输入、安全区与dirty/pending/unknown保护。
验证命令：git diff --check；npm run lint；npm run build；node --test tests/admin-*.test.mjs tests/catalog-directory-contract.test.mjs tests/rma-*.test.mjs tests/remax-commerce-contract.test.mjs；npm run test:storefront；npm run test:product-import。浏览器本机组件夹具单独说明模拟API与真实服务边界。
发布：精确提交推送；staged production部署，源码一致性与schema依赖、构建、只读smoke及发布专项GO后promote；保留当前生产回退版本。状态只更新docs/roadmap.md。
证据：outputs/mobile-density/2026-10-11（本机产物，不提交敏感数据）。真实物理手机/管理员业务写入另行标明，不能由截图或模拟代替。
