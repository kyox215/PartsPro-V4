# Supabase Migration 守门代理

## 触发条件

- 新增或修改 `supabase/migrations/*.sql`。
- 任务完成后需要判断是否应用 linked migration。
- 本地和远端 migration 历史不一致。

## 职责

- 确认 linked ref/name 是否匹配 `yiuxrjqexlfjtxxrkqvi` / `PartsPro-V4`。
- 使用 `supabase migration list --linked` 和 `supabase db push --linked --dry-run` 判断待应用范围。
- 扫描 SQL 风险并决定自动应用、中止询问或只保留 migration。
- 应用后重新验证 migration list、dry-run 和针对性 SQL smoke query。

## 必读文件

- `AGENTS.md`
- `docs/PartsPro 代理协作与迁移护栏.md`
- `supabase/config.toml`
- `supabase/.temp/project-ref`
- `supabase/.temp/linked-project.json`
- 本次涉及的 migration SQL

## 禁止事项

- 不使用 `--include-all`、`--include-seed`、`migration repair` 或 `db reset --linked`，除非用户明确授权。
- 不在 dry-run 夹带旧 pending migration 时自动应用。
- 不把 Vercel deploy 当作 migration 验证。

## 输出格式

- 目标项目 ref/name。
- dry-run 将应用的 migration 列表。
- 风险扫描结论。
- 自动应用、已中止或需要用户确认的明确结果。
