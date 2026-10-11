# 后台原样式信息密度优化

状态：released

Task ID：TASK-20261011-ADMIN-UI；优先级 P1；风险 R2；自治 L3。

## 目标与授权

老板要求：“再不改变ui样式的情况下优化菜单 组件搜索框 选项框等检查所有后台页面”，“开始按照规划执行 完成后推送上线”。基于已回滚的原生产提交 `44f8904efb4301cbc1383483c52dea3bd4386ab5`，完成 44 个页面/工作区/组件组合的密度、可读性、搜索与选项改进，并验证后发布。44 个验收单元并非 44 个新路由。

主责平台发布部；协作商品目录部、订单运营部、价格与客户部、仓库库存部。主助手负责共享组件及商品目录，独立助手负责其他后台模块，最后独立完成业务契约和发布审查。Responsible：主助手；Approver：老板；Consulted：前端体验/业务契约/Vercel 发布助手；Informed：老板。

## 范围和边界

- 页面：现有后台全部 12 组模块、44 个验收单元，保留蓝色、白色卡片、原侧栏、56px 手机标题栏、Dialog/Sheet、桌面表格及 REMAX 紫色。
- API/数据表/RPC：不修改；目录未知保存结果增加客户端查询核对与禁止重复提交。
- 不包含：数据库迁移、生产环境变量、真实订单/资金/库存/权限写入。合成数据预览不能证明生产业务写入成功。
- 文档：本任务、`docs/roadmap.md`、预览索引与验证报告。
- 外部目标：GitHub `kyox215/PartsPro-V4`，Vercel `parts-pro-v4` / `prj_wQ4XmNuE5C0cEcaqKw3wcy4rjpPo`，team `team_AOJDnrjov0QDLqpvMyhwA1yc`。
- 唯一工作树：`.codex-worktrees/admin-ui-preserve-style-20261011`；不覆盖主目录未提交修改，不混入此前被拒绝的重设计。

## 完成定义

1. 44 个单元均有非空合成数据下实际组件手机及电脑截图，记录交互检查和覆盖限制。
2. 320/390/430/768/1440px 受影响界面无页面横向溢出；390×700 商品/订单首屏至少 3 张完整原式卡片、目录至少 5 条（代表数据）。
3. 搜索清除与焦点、长选项键盘选择、无结果、草稿关闭/切页、409 与未知结果核对有效；权限与金额语义不改变。
4. 全量 lint、Next 生产构建、相关合同、storefront、导入测试通过。
5. 推送隔离分支；新生产候选 skip-domain 部署，核对源码哈希、精确提交状态、现有数据库依赖、鉴权 smoke。独立 GO 后 promote，核对两正式域名与发布后 smoke。

## 批准与回退

本次实施、推送、上线已经老板明确授权；无新 migration，不执行 db push。生产切换须独立发布审查。回退基线：Vercel `dpl_CBmypjyY8x9gksXohdVcs1C4Vn64` / Git `44f8904`；本次无数据补偿需求。不得以截图代替真实业务测试，不得放宽断言掩盖失败。

## 验证命令

```bash
git diff --check
npm run lint
npm run build
node --test tests/admin-*.test.mjs tests/catalog-directory-contract.test.mjs tests/remax-commerce-contract.test.mjs tests/rma-*.test.mjs tests/notification-center-rma-ui-contract.test.mjs
npm run test:storefront
npm run test:product-import
```

浏览器专用合成数据服务和截图只在本地运行，生产上传排除 `.codex-tmp`、`outputs`、`docs`、环境文件。

## 执行记录

- 2026-10-11：44 单元 / 88 张截图完成；264 项相关合同、6 项 storefront、20 项导入测试通过。最终全量 lint 无警告、正式 build/TypeScript 成功。核心 5 宽度无错误/溢出，390×700 商品与订单 3 卡、目录 5 条。
- 独立源码审查 GO_SOURCE_REVIEW；移动回执、pending/unknown 快捷导航风险修复并复验。Vercel 本机解析目标与团队正确，Supabase PartsPro-V4 ACTIVE_HEALTHY；RMA v4、账号价格权威、目录管理三项现有依赖 migration 已只读确认存在。
- 原始日志：`outputs/admin-ui-preserve-style/`；可分享逐页预览：`docs/previews/admin-ui-preserve-style-20261011/index.html`。应用提交 `975f43552b9902ea209f260eb0cb5d8145116975` 已推送并发布。候选经 GO_RELEASE、同提交 CI/checks、435 上传文件哈希（434 冻结源码 + next-env）、11/11 GET 核验后 promote；两正式域名指向 `dpl_9GouAqee1NKPggTwoPJpcsS1pWf7`，发布后 11/11 匿名 HTTPS GET 通过，10m 观察错误记录 0。发布回执保留在预览 `evidence/`。主目录未提交改动未覆盖。

- 限制：后台 UI 为实际组件合成数据验证；本次没有真实订单/退款/库存/财务/权限/eBay 写入，没有物理 iPhone/Safari 软键盘验证。
