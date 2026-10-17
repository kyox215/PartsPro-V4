# P1-2026-10-17-storefront-compact-header

状态：in_progress
Task ID：TASK-20261017-UI06
风险：R3（多前台展示与生产发布）；自治L3（老板批准具体计划与上线）。
主责：平台发布部；协作：前端体验、订单运营。R主执行者、A老板、C独立发布守门、I老板。
目标：精简所有前台冗余页首，桌面保留品牌机型侧栏，筛选统一收进面板，商品更早进入首屏。
范围：目录、首页、商品、账户、购物车/结算、售后、专业申请、登录、帮助的展示/样式/双语文本及筛选草稿控件。
接口/表：HTTP API/DB/RPC/订单协议不改；无migration依赖。禁止后台/env/Logo/依赖/价格/真实业务写变更，保留主目录改动。
基线：正式B8/a1073b8已只读核实；隔离源e65d638仅追加文档，运行路径与a1073b8一致。分支codex/storefront-compact-header-20261017。
验收：目录桌面44px左右单行、手机搜索+排序/筛选约96px；1536/1280首行商品上移至少180px。1536/1280/768/390 ZH/IT无溢出，筛选应用/取消/重置保留搜索与排序，计数不含搜索/排序。慢刷新/失败/过期/identity保护、分页/返回恢复不回退。
验证：git diff --check；npm run test:storefront；现有storefront-refresh-state、commerce-refresh-ui、performance-behavior、storefront-commerce-interactions相关测试；新增筛选行为测试；npm run lint排除verification生成文件；npm run build；实际组件夹具和真实Next候选浏览器。
发布：独立精确源码/契约及Vercel发布复核→production skip-domain候选→只读HTTP/浏览器/上传hash→PROMOTE_GO同构建推广。回退保留dpl_B8YduhG5zUjCYirDGSuc6xX8fBtV。
证据：隔离工作区verification；权威状态仅docs/roadmap.md。

实现与本地验证：44px目录工具条；草稿应用/取消/重置；其余页首压缩。6项storefront+41项相关测试PASS；最终lint/build PASS；ZH/IT四宽度无溢出；桌面首卡445→190px；320/390错误重试通过。独立源码SOURCE_GO，等待精确发布候选。

发布并发保护：PROMOTE复核发现正式域名已更新为84Mo/5d329f1（注册双语反馈修复）。31f旧候选NO_GO，未推广；无冲突合并精确已上线5d329f1，保留注册翻译/错误映射/Dialog可选closeLabel和新测试脚本。新候选以5d为保护基线，回退更新84Mo；重跑测试/lint/build。
