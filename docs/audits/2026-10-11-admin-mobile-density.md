# 后台手机高密度改造验收

## 实施结果

- 基于d4f37a0隔离实施，根目录未提交内容保留。商品默认连续紧凑行，可切换双列；搜索、可移除筛选、单行子导航、选择模式与底部批量操作。视图偏好按账号存储，账号切换重建工作区，避免沿用其他账号的草稿。
- 目录取消大导航与说明卡、嵌套滚动和手机插入式表单；手机全屏编辑，平板/桌面两栏；原列表排序、菜单操作、关联商品与预填创建。保存冲突保留输入；结果未知禁止重放，查询内容及版本后确认。
- 订单/RMA/客户/财务/库存/REMAX/eBay/客服/活动/统计/权限/设置等14组件统一紧凑手机内容，保留桌面表格与现有权限、金额、库存、dirty/pending/unknown契约。指标口径与下一步映射保持准确；概览待办深链接清除旧筛选。
- 共享框架48px手机顶部栏、横向子导航、模块搜索；通知99+，可读辅助文字至少12px，触控44px、输入16px、Portal安全区。
- REMAX长客户名/选中长批次曾导致overflow，已修grid轨道与min-width。隐藏图表曾有尺寸警告，改为按展开挂载并修正初始尺寸；不会卸载有草稿的折叠表单。

## 验证证据与边界

- 完整lint、正式Next生产build、diff检查通过；220后台/目录/售后/REMAX合同测试、6商城测试、20导入测试通过。
- 商品目录6个viewport语言组合：320×700/中文、360×740/意文、390×700/中文、430×760/意文、768×900/意文、1280×900/中文。390首条目录198px、7条完整目录和5条完整商品；手机各宽无横向溢出。切换双列、筛选面板、重载偏好、选择、商品编辑一次保存返回列表、目录冲突保留、unknown readback不重放均按影响面核验。
- 其余12主panel共46个场景，覆盖320/390/1280与中意代表页，另补5模块768。订单/RMA/客户/财务等使用非空DTO，详情开关、模块切换、图表展开收起与桌面尺寸检查通过；REMAX四宽选中极长批次补验通过。
- 真实组件由本机独立harness运行，API全部模拟；Next导航与语言server action使用夹具。当前pageerror/console error/warning为0，保留初轮错误、截图与修复后结果。该证据不证明生产管理员业务写入、真实Realtime、支付、客服发送或物理Safari软键盘。
- 可复现：node scripts/verify-admin-mobile-density.mjs --prepare / --build / --serve / --core / --modules；浏览器需playwright或PLAYWRIGHT_MODULE。服务绑定127.0.0.1:3178，所有业务API拦截，不对外部生产发送写请求。
- 本机证据：outputs/mobile-density/2026-10-11/core-all-results.json、core-390-results.json、modules-results.json及代表截图。编译产物、env、截图与临时数据不推送/上传。

## 发布约束

- 当前Supabase只读核对目标为PartsPro-V4/yiuxrjqexlfjtxxrkqvi，健康；目录、客服原子操作、结账重放三条现有迁移均已应用。本轮没有新增或修改API/SQL/依赖/env，不执行数据库写入。
- Vercel目标parts-pro-v4/prj_wQ4XmNuE5C0cEcaqKw3wcy4rjpPo/team_AOJDnrjov0QDLqpvMyhwA1yc。应用基线保留全部先前修复；当前正式回退部署dpl_CBmypjyY8x9gksXohdVcs1C4Vn64。
- 精确提交推送、候选生产build、源码SHA1核对、受保护候选GET smoke与独立发布GO后再promote。最终状态以docs/roadmap.md及本报告后续实际发布记录为准。

## 实际发布记录

- 运行提交：9dfd9c391cdf0bf5789049d3fb191a5fe708acdb；分支codex/admin-mobile-density-20261011已推送。Vercel同提交检查success；候选production READY；433 manifest文件与2个额外本地生成文件，共435项上传SHA1全部匹配，没有遗漏或敏感/临时路径。
- 独立发布审查对上述精确提交与部署给出PROMOTE GO后，执行已授权promote。2026-10-11 02:48 UTC核对partspro.app与www.partspro.app均指向dpl_BTWZpjbi89uGQTZKrpqBqFeKTexX；前者重定向到www。
- 正式https://www.partspro.app的11项GET检查全部通过：首页、商城、目录API、admin、6后台API与sw.js。目录29节点，general_merchandise名称为“电子产品·高端产品”；admin匿名请求以Next16流式meta与NEXT_REDIRECT跳转登录，不渲染后台工作区；6后台API均401。候选同样11项通过。
- 新部署promote后近10分钟错误日志0。线上证据为匿名只读访问，Vercel保护身份不等于应用管理员会话；未进行真实订单/商品/库存/付款/权限/客服写入，物理Safari软键盘仍未验证。
- 本机证据：production-aliases.json、production-smoke.json、production-log-summary.json、source-verification.json、schema-readiness.json，均位于outputs/mobile-density/2026-10-11。回退部署dpl_CBmypjyY8x9gksXohdVcs1C4Vn64；需要回退时在当前目标团队运行vercel promote该ID并复查正式域名。
- 任务完成；发布记录后续提交仅为文档，不改变线上运行提交。根目录未提交改动仍保留，本轮无需migration。
