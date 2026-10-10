# 前端修复生产迁移与发布门

用户授权：修复完整前端审计并上线，补标准组件状态。本次数据库写入仍遵守 AGENTS 的独立明确批准门。

## 精确目标及清单

2026-10-11 本轮只读核对：Supabase `PartsPro-V4` / `yiuxrjqexlfjtxxrkqvi`，`ACTIVE_HEALTHY`，eu-west-2；linked migration list 无 remote-only 分歧。
首次预检 `supabase db push --linked --dry-run` 列出两条。后台任务先行应用第一条后，本次明确批准前的fresh dry-run仅列第二条checkout：

| 文件 | 来源/用途 | SHA-256 |
|---|---|---|
| `20261010204858_admin_support_atomic_reply.sql` | 集成本轮后台64项候选：客服回复与事件原子提交、会话操作、最小财务供应商批次读取 | `23576d5e5c451f321a4d07cddc4257b09df333b8a5f3d4350ce453173aaf59bb` |
| `20261010215007_checkout_request_replay.sql` | 本轮新增：请求去重、最小成功回执、待确认查询与终止标记阻止迟到原请求 | `b04606d1d232c05c114990f4fcc9c91d6274fc3bac5e3a8046cd78c50985c49a` |

## 影响与验证

新增2张private表和受控RPC；private表启用RLS且撤销public/anon/authenticated直接访问。公开RPC仅authenticated执行，内部复核actor/customer与staff精确权限，固定空search_path。不改写已有RLS、价格、钱包和库存函数；原权威下单函数继续校验业务。
无DROP/TRUNCATE、生产回填、大范围UPDATE/DELETE；无真实支付、订单、库存或客户测试写入。客服原子函数只在已获权限的新UI调用时运行。
独立审查已修正旧购物车快照、身份换人泄漏、重放回滚不能证明原HTTP结束、回执0件等问题。最终SQL源码审查GO。
PGlite执行验证事务回滚、hash冲突、scope/ACL、停止与回执；真实独占无网络PostgreSQL17多连接验证四重重发、创建先完成则终止返回已有订单、终止先完成则迟到原请求不创建订单。auth/底层业务依赖为合成，不替代生产JWT或真实交易验收。
全量lint和Next生产构建通过；浏览器与最终提交CI收尾不替代本次dbpush批准。

## 回退与生产门

网站当前立即回退目标为上一前台部署 `dpl_4ua1E7wmj8EkKdYnHvGdL3EVdjj6`，生产域名 `www.partspro.app`。初始后台基线 `dpl_HH2aD81wV5khFZyiq7fWXzouZfhZ` 仅保留为历史记录。保留本次附加表/RPC和去重/终止历史，不执行自动DROP或反向删数据。如需数据库撤回，另做补偿迁移并重新批准。
Vercel目标 `parts-pro-v4` / `prj_wQ4XmNuE5C0cEcaqKw3wcy4rjpPo` / `team_AOJDnrjov0QDLqpvMyhwA1yc`，远端Node24.x。先应用已批准清单并核对权限/历史；生产skip-domain候选完整验证；同一构建promote。禁止无依赖schema切正式域名。
状态更新：后台迁移已由并行后台发布完成。Owner明确批准本次唯一剩余checkout迁移；fresh dry-run仅20261010215007，db push已成功，应用后ACL/RLS/原函数摘要及up-to-date核对通过。代码完整merge a826与e09后台发布，production skip-domain候选验收及同构建promote已完成。前面的两条清单为首次预检记录，不再重复应用后台迁移。

历史基线补充：正式www.partspro.app曾更新到e09af0e（统计采集修复），本候选再次完整merge，统计12/12通过，依赖变更后全量lint/build再次通过。该阶段以custom域名dpl_HH2aD81wV5khFZyiq7fWXzouZfhZ作为回退基线；它和两个旧预检部署均不代表当前正式版本。账户脏草稿原生确认框自动化受到工具阻塞，未将取消放弃/确认放弃交互算PASS；该阶段浏览器关闭清理也受到同一阻塞。

最终状态：唯一checkout迁移已批准应用，生产上线完成。运行源码bc70ed26aa0d74598d632bf7e0b5f437f92b9ff5，部署dpl_Hz8t57m5kDJRmf2iwn6pDRXQJ3Rh已promote到www.partspro.app，同SHA检查/412上传摘要/14候选与14线上无认证GET通过。最新立即回退为dpl_4ua1E7wmj8EkKdYnHvGdL3EVdjj6，保留数据库附加历史；真实业务和完整鼠标链限制见完整报告。
