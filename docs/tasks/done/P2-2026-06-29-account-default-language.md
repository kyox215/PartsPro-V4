# P2-2026-06-29-account-default-language

状态：verified

看板目录：done

优先级：P2

Task ID：TASK-20260629-01

风险等级：R2

自治等级：L3

## 老板原始目标

为每个账号记住默认语言，改成什么语言默认就是什么语言，下次在不同的设备上也默认是那个语言。

## 目标

让登录账号拥有全局默认语言，跨设备登录后优先使用账号保存的语言。

## 业务影响

减少客户和员工在不同设备登录后重复切换语言的问题，影响商城、后台、登录后的账号体验。

## 完成定义

- `public.profiles.preferred_locale` 已在 linked Supabase 项目应用。
- 页面语言读取优先级变为账号默认语言 > 当前设备 cookie > 原 scope 默认语言。
- 语言切换会同步写 cookie 和账号默认语言。
- 登录成功后，如果账号还没有默认语言，会从当前设备 cookie 初始化一次。

## 主责部门

价格与客户部

## 协作部门

平台发布部、文档审计部

## 工程守门代理

Next.js 16 App Router 代理、Supabase Migration 守门代理、Supabase RLS/权限代理、PartsPro 业务契约代理

## RACI

| Role | Owner |
|---|---|
| Responsible | Codex |
| Approver | 老板 |
| Consulted | PartsPro 业务契约代理 |
| Informed | 平台发布部 |

## 涉及范围

- 页面：全站 `RootLayout` 语言上下文、登录页、OAuth callback
- API：无新增 public API
- 数据表/RPC：`public.profiles.preferred_locale`、`ensure_current_user_account`
- 文档：本任务卡
- 外部系统：Supabase linked project `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`

## 已知事实

- 现有语言只支持 `it-IT` 和 `zh-CN`。
- 原实现只按 storefront/admin cookie 记住语言。
- 用户已确认采用账号全局语言，不区分商城和后台。

## 假设与未知项

- 未登录用户继续使用现有 cookie 行为。
- 本任务不处理已有 Supabase advisor WARN 中的历史函数权限/search_path 问题。

## 工作包

| WP | 负责人 | 输出 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-01 | Codex | profiles 语言字段 migration | Supabase migration 安全门 | linked 项目应用成功 |
| WP-02 | Codex | 账号语言读取/写入 helper | Next.js server cookies/actions | lint/typecheck/build 通过 |
| WP-03 | Codex | 登录后初始化账号语言 | Auth callback/password/OTP 登录流程 | smoke query 验证通过 |

## 批准要求

- 是否需要老板批准：已由老板要求执行
- 是否需要 Supabase migration 安全门：需要，已完成
- 是否需要 Vercel 发布门：本次未执行 Vercel deploy
- 是否需要 PartsPro 业务契约验收：需要，账号语言优先级已按计划实现

## 验收标准

- 登录账号切换语言后，`profiles.preferred_locale` 保存为最后选择的语言。
- 新设备或清 cookie 后登录同账号，页面优先使用账号默认语言。
- `/admin` 和商城都使用同一个账号全局默认语言。
- 匿名用户不受账号语言逻辑影响。

## 禁止事项

- 不新增浏览器端 secret。
- 不重写账号权限、RLS policy 或 profile 管理 RPC。
- 不触碰与本任务无关的未提交变动。

## 验证命令

```bash
git diff --check
npm run lint
npx tsc --noEmit
npm run build
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db push --linked --dry-run
SUPABASE_TELEMETRY_DISABLED=1 DO_NOT_TRACK=1 supabase db query --linked --output json "<smoke query>"
```

## 验证证据

| Command / Check | Result | Evidence |
|---|---|---|
| `git diff --check` | pass | no whitespace errors |
| targeted `eslint` | pass | language/account/auth files passed |
| `npx tsc --noEmit` | pass | no TypeScript errors |
| `npm run lint` | pass | full eslint completed |
| `npm run build` | pass | Next.js 16 production build completed |
| linked target check | pass | `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4` |
| pre-apply `supabase db push --linked --dry-run` | pass | only `20260629001054_account_preferred_locale.sql` pending |
| `supabase db push --linked` | pass | migration applied |
| remote smoke query | pass | column exists, check constraint exists, migration history row exists, invalid rows = 0 |
| post-apply `supabase db push --linked --dry-run` | pass | remote database is up to date |
| `supabase db advisors --linked --type security --level warn --fail-on none` | warning only | existing function search_path / SECURITY DEFINER warnings; no new function introduced |

## 执行记录

- 创建：2026-06-29
- 批准：2026-06-29 老板要求执行
- 开始：2026-06-29
- review：2026-06-29 lint/typecheck/build/migration dry-run
- verified：2026-06-29 linked migration and smoke query passed
- released：未执行 Vercel deploy
- closed：2026-06-29

## 结果

已交付账号全局默认语言。Supabase linked 项目已增加 `profiles.preferred_locale`，应用代码会在登录态优先读取该字段，语言切换会同步写账号偏好，登录后会从当前设备 cookie 初始化一次。残余风险是线上应用仍需走常规部署流程后，生产前端才会使用新代码。
