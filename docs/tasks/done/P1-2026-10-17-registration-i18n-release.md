# P1-2026-10-17-registration-i18n-release

状态：released；Task ID：TASK-20261017-REG01；风险 R2；自治 L3。

老板目标：推送上线注册/个人中心语言修复，继续检查逻辑闭环并提供报告。
主责：平台发布部；协作：价格与客户部、文档审计部。
RACI：Responsible 主代理；Approver 老板（本聊天已明确批准推送上线）；Consulted 独立 Vercel 发布/业务契约代理；Informed 老板。

目标与业务影响：客户注册、验证码、资料补全与个人中心使用当前网站语言；保留正式新版页面和已实现的购物车/checkout返回、草稿保护、异步请求隔离。
范围：从线上 a1073b8767c16ba48eab90aa2f0d976032ab53d4 的独立候选移植翻译/错误反馈；只读追踪 login/auth callback/profile API/RPC/account/checkout；无数据库写入。
候选：.company-tmp/registration-i18n-20261017，分支 codex/registration-i18n-20261017。
外部目标：Vercel parts-pro-v4 / prj_wQ4XmNuE5C0cEcaqKw3wcy4rjpPo；team_AOJDnrjov0QDLqpvMyhwA1yc；www.partspro.app / partspro.app。
批准：用户本轮明确批准推送和上线；无新增migration，无迁移应用授权或需求。
禁止：不得把主目录其他未提交变更或 UI06 候选混入发布；不得写生产客户、订单或数据库；不得修改生产环境变量。
验收：候选精确diff、lint/build、注册/账户测试与隔离浏览器通过，独立门禁复核通过；推送精确commit，生产配置候选先验收再推广同一构建；两alias/运行错误检查；报告明确现有问题与验证限制。
回退：生产 dpl_B8YduhG5zUjCYirDGSuc6xX8fBtV / a1073b8；回退仅Vercel，不涉及数据库补偿。
验证：npm run test:storefront、相关定向node --test、npm run lint、npm run build、git diff --check；线上只读smoke。
证据：候选 verification/；发布与审计结果最终回写 docs/roadmap.md 和本任务卡。

完成记录：运行5d329f1/生产dpl_84Mo47vkuRDf41SYAjK4c3cUvTGp，两个正式alias核对；候选13测试/18组件浏览器、正式13HTTP/6浏览器、lint/build、457hash门禁通过。报告含5项未修闭环问题和真实邮箱/iPhone/数据写验收限制。详见注册闭环审计报告与roadmap REG01。
