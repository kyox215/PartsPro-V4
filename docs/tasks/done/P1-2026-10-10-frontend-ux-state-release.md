# P1-2026-10-10-frontend-ux-state-release

目标：修复前端审计 123 项，统一组件及交互状态，验证后上线。
主责：前端体验；协作：订单运营、价格客户、仓库售后、平台发布。Owner：老板；执行：当前主助手及一个公开页面工作子助手；关键业务/SQL/发布收尾由独立子助手专项审查。
范围：storefront/auth/B2B/cart/checkout/account/RMA/support 与已完成后台 64 项候选（c9f1b1a）。风险 R3，下单幂等和生产迁移 R4。自治：本地修改、测试、只读生产核对和用户已授权的发布；linked db push 保留 AGENTS 本次明确批准门。
集成根目录：本项目 `.codex-worktrees/frontend-ux-states-release-20261010`；不触碰主目录已有未提交源码，不混用其他项目。
数据库依赖：收纳后台候选 `20261010204858_admin_support_atomic_reply.sql`；本任务新增 `20261010215007_checkout_request_replay.sql`。不得夹带其他 pending migration。新表仅保存 actor/request/customer、hash 和最小订单回执，无原始地址或 intent。
验收：123 项逐条对应变更/边界；组件状态规范与示例；定向合同与 PostgreSQL 执行测试；lint/build；浏览器桌面和移动交互；migration dry-run、独立权限/业务审查；获本次 db push 批准后应用核对；production skip-domain 验证同一构建后 promote。
禁止：真实订单/支付/钱包/库存/售后测试写入；未批准 db push；自动回填/删除/RLS 改写；未验证候选直接占生产域名；秘密和完整客户资料进入日志、截图或报告。
现有命令：npm run test:storefront；npm run test:product-import；node --test tests/<本任务及相关>.test.mjs；npm run lint；npm run build；git diff --check。不是全量 E2E 脚本。
状态：本轮实施与授权上线完成，已发布bc70ed26/dpl_Hz8t57m5kDJRmf2iwn6pDRXQJ3Rh；未新增能力及真实业务/浏览器限制详见报告。执行证据及残余限制写入本任务修复验收报告；权威进度维护 docs/roadmap.md。
