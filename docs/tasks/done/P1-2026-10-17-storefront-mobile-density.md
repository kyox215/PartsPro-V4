# UI07 — 移动端高密度预览还原与发布

状态：done
看板目录：done
优先级：P1
Task ID：TASK-20261017-UI07
风险等级：R3
自治等级：L3

## 老板原始目标

“开始按照预览修改 完成后上线 要高保真”

## 目标与业务影响

将已批准的 7 张 image2 设计板落实到全前台手机页面，降低商品卡及页首空白，保留可读性、触控尺寸、报价保护和身份隔离。范围为宽度 <768px；768px及以上保留当前正式设计。

## 主责、协作及 RACI

主责：平台发布部（前端体验）。协作：订单运营部、价格与客户部。守门：独立 PartsPro 业务契约 / Next.js / UX / Vercel 发布复核。
Responsible：当前执行代理；Approver：老板（当前明确实施及上线授权）；Consulted：账户 UI 协作代理与独立发布守门；Informed：老板。

## 范围与禁止事项

- 首页、目录、预售、详情/图预览/筛选、购物车/结算、账户各栏目、登录/注册/专业申请、售后与帮助，以及各局部加载/错误状态。
- 不修改 HTTP API、数据库、后台、生产环境变量、Logo、价格算法、登录及订单提交协议；无 migration 依赖。
- 主目录未提交运行源码保持原状；仅在隔离目录 `.company-tmp/storefront-mobile-density-20261017` 修改发布源码。预览示例字段/金额/承诺不进入真实业务规则。

## 已知基线与回退

执行时正式运行提交 4096f92b62e6797d901a3940bf49e168e72027f1（REG02，含三语/设备语言及 UI06），正式部署 dpl_BTLh3gDWL3P8fF9gPVLmVoSsJZR1。隔离分支 codex/storefront-mobile-density-20261017 从其文档后继 eb533e0 建立；运行目录完全相同。发布前重新核对正式版本，避免覆盖并发上线。

## 验收标准

- 320/375/390/430/767、ZH/IT/EN 代表页面无横向溢出，常规卡目标150–180px、预订170–210px（长文案可自然增长），390同卡相对基线降低至少35%；触控主要操作44px、正文14/辅助12、输入16。
- 所有手机商品区统一横向紧凑卡；保留真实价格解释、MOQ、预订剩余与ETA、账户/报价/库存门禁；无固定留白撑高。
- 筛选草稿、排序、分页、返回、数量、表单草稿、慢刷新/错误重试/身份切换保留；桌面768/1280/1536控制对照。
- storefront、相关合同测试、lint、build、独立守门；候选真实浏览器与HTTP验证，同一构建推广后核对正式域名与重点页；保留上述回退版本。
- 合成组件、只读正式验收与真实业务写验收清楚区分。本次不执行真实交易、客户资料写入或售后提交。

## 验证命令

`git diff --check`、`npm run test:storefront`、现有相关 `node --test tests/<file>.test.mjs`、`npm run lint -- --ignore-pattern 'verification/**'`、`npm run build`。

## 执行记录

- 已核实正式 REG02 基线并建立隔离分支，保留主目录改动。
- 已复制批准的7张图到 outputs/storefront-mobile-density/2026-10-17/previews/。
- 商品/购物/详情/表单移动样式及账户协作初版完成，进入实际组件视觉验收。
- 业务只读扫描：verification/preflight-contract.md；既有后端问题不扩入UI范围。

## 验证证据与结果

已完成24 storefront +60相关测试、全量lint/build、210手机几何及30桌面对照；独立SOURCE_GO/PROMOTE_GO后，同一B8UX/c68206c构建已推广正式www/apex。候选与正式各12+30 HTTP、真实三语及响应式只读浏览器验证通过；独立RELEASE_VERIFIED，回退BTL/4096保留。详见docs/audits/2026-10-17-storefront-mobile-density-release.md。真实业务写/物理iPhone键盘不在本次E2E验证内。
