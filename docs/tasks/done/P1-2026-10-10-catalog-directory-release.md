# P1-2026-10-10-catalog-directory-release

- 目标/业务影响：后台目录与商品维护形成连贯流程；统一“电子产品·高端产品”名称；防止并发覆盖、重复创建及跨实例旧目录展示。
- 主责：商品目录部。协作：前端体验、PartsPro业务契约、Supabase Migration/RLS守门、平台发布；最多一个独立助手，顺序复用专项审核。
- 页面/API/表：后台商品/目录、前台品牌树与分类、购物车/checkout刷新；admin/catalog-directory、catalog-directory、admin/products；新增private目录/修订/创建请求表与受限RPC。
- 风险/自治：高影响发布与数据库迁移；实现和验证自主推进，生产迁移须本次明确授权。用户明确“确认迁移数据库”；此前明确完成后推送部署。没有扩大到生产库存动作、真实商品批量修改、支付或环境变量变更。
- 批准：dry-run仅20261010081040、目标PartsPro-V4/yiuxrjqexlfjtxxrkqvi、风险/补偿已展示；独立Migration/RLS GO后实际db push；依赖页面经独立PROMOTE GO后切域名。
- 禁止：覆盖主目录既有未提交变更、修改已应用migration、repair/include-all/seed、删除业务数据、改Auth/Storage/RLS旧策略、用本地夹具冒充生产管理员真实写入。
- 验收：目录双语名称/排序/启停及新分类，目录→筛选/预填草稿，原子移动与原始版本，创建UUID防重，目录草稿保护，前台修订刷新；四视口及失败恢复。
- 实际验证：39定向合同测试、全量lint/build、无网络Docker还原真实生产schema+SQL安全/并发、四视口目录和原UX回归均通过。远端12函数摘要、RLS/ACL与版本已核对；商品聚合前后相同。
- 发布：runtime832c53c916f15ff7bb751aff258b1ad8055a1cbc推送codex/catalog-directory-release-20261010；dpl_BgiuoEqK7TPqFqSA66FC8KvG3qCL，370源码hash一致、同SHA Vercel success、10候选/11线上只读检查；两域名指向核对，短时error0。未合并main。
- 已知限制：物理手机键盘/生产管理员真实保存未验收；Chrome自动化连接受限。IAB生产前台1280/390名称、导航、溢出与菜单关闭通过；事件表须独立压缩维护；图片跨管理员并发、库存跨请求幂等和游标分页继续独立处理。
- 回退/补偿：页面回退dpl_3uXTPRgAjbBTxxhMJoufPhsTdwDm；不删除目录审计，数据库异常补偿migration前向修复，已执行目录移动不能靠代码回退撤销。
- 证据：docs/audits/2026-10-10-catalog-directory-release.md、outputs/catalog/2026-10-10/；权威状态docs/roadmap.md。
- 命令：node --test tests/catalog-directory-contract.test.mjs tests/admin-bulk-hide-contract.test.mjs tests/storefront-i18n-contract.test.mjs tests/checkout-state-contract.test.mjs tests/partspro-product-import-core.test.mjs；npm run lint；npm run build；SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase migration list --linked / db push --linked --dry-run。实际db push本次已完成，不可重复应用或借此授权新增迁移。
