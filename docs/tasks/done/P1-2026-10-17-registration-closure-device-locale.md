# P1-2026-10-17-registration-closure-device-locale

状态：released

Task ID：TASK-20261017-REG02

优先级：P1；风险等级：R3（全站语言与生产发布）；自治等级：L3（已明确授权修复并上线）

## 目标与业务影响

修复 REG01 审计的五项注册闭环问题；商城、注册、个人中心、后台均支持英语/中文/意大利语。首次按设备首选语言，其他语言默认英语；用户手动选择只记在当前设备，可恢复设备语言。

主责部门：价格与客户部。协作部门：平台发布部、订单运营部。工程守门：当前代理按 Next.js/UI 清单自检；release_gate 独立业务契约与 Vercel 发布验收。

RACI：Responsible 主代理；Approver 老板（当前明确“完成后上线”授权）；Consulted release_gate；Informed 老板。

## 范围与禁止事项

- 页面：全站语言选择、登录/注册、account、storefront/admin 既有 UI 文案与日期格式。
- API：account/profile 共享现有字段校验；请求和响应结构不变。
- 数据表/RPC：移除语言选择/登录后的 profiles.preferred_locale 写入；无 schema 变更，不应用 migration，不创建生产客户，不保存生产资料。
- 独立候选基于当前线上 REG01 源码，保留主工作区和 UI06 其他改动；不夹带 pending migration、环境变量或产品/价格改动。

## 验收与门禁

- 五问题：旧账户/后台 Cookie 不压过设备默认；成功保存清 setup；资料读取失败显示重试且不可编辑空资料；前后端字段限制一致且错误指向正确栏目；安全 returnTo 保留账户栏目。
- 三语言词典 shape/占位符、设备语言矩阵、cookie override/恢复、模拟注册/资料保存失败保留及重试、按钮提交锁、语言切换、手机/桌面布局。
- npm run test:storefront、相关定向测试、npm run lint、npm run build、git diff --check。
- 独立 SOURCE_GO → 同一生产配置未推广候选 → hash/HTTP/browser → PROMOTE_GO → 两正式域名、只读 smoke、错误日志。
- 若正式 alias 在发布前被其他任务更新，先核对新基线，禁止覆盖并发上线。

## 回退

推广前记录两域名部署 ID；失败回退至该部署。同一任务无数据库写入，无数据补偿。

当前权威进度见 docs/roadmap.md；验收证据与结论见下方。


## 验收结果

已发布 `4096f92b62e6797d901a3940bf49e168e72027f1` / `dpl_BTLh3gDWL3P8fF9gPVLmVoSsJZR1`，独立SOURCE_GO/PROMOTE_GO、24+53测试、35隔离浏览器、候选/正式30+30HTTP、正式19浏览器、lint/build/hash检查通过。

无migration/env/生产客户写入；回退UI06 dpl_2ax6n9uKXsDtPkzwTQk1nZL16Wwf。未创建真实邮箱客户、未测物理iPhone键盘；详情见 `docs/audits/2026-10-17-registration-device-locale-release.md`。
