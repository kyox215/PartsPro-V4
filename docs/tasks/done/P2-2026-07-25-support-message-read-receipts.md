# P2-2026-07-25-support-message-read-receipts

状态：done

看板目录：done

优先级：P2

Task ID：TASK-20260725-01

风险等级：R2

自治等级：L1

## 老板原始目标

在网站在线消息中加入已读回执功能。

## 目标

客户发送的消息显示客服是否已读；客服后台发送的回复显示客户是否已读，并随现有 Realtime 会话更新自动刷新。

## 业务影响

减少客户和客服对消息是否被看到的不确定性，同时复用匿名会话级时间戳，不新增逐条追踪或个人数据。

## 主责部门

客服部

## 协作部门

- 前端体验
- 平台发布部

## 涉及范围

- 客户端：`src/components/partspro/support-chat-panel.tsx`
- 后台：`src/components/partspro/admin-support-panel.tsx`
- 数据契约：复用 `support_conversations.customer_last_read_at`、`staff_last_read_at`
- 数据库：不新增 migration、不修改 RLS

## 实施方案

1. 将双方最后阅读时间从现有会话 DTO 映射到组件状态。
2. 对发送方自己的消息，将 `message.createdAt <= 对方 lastReadAt` 判定为已读。
3. 客户侧显示“已读/未读”，员工侧同样显示客户回执。
4. 继续依赖现有 `support_conversations` Realtime 更新，不引入轮询。

## 验收标准

- 客户消息在员工阅读后显示已读。
- 员工回复在客户打开会话后显示已读。
- 对方尚未阅读时明确显示未读/已发送。
- 系统消息和对方发来的消息不显示自己的回执。
- 中意双语、移动端布局和深浅色气泡均清晰。
- TypeScript、lint、build、差异检查通过。

## 禁止事项

- 不新增原始 IP、设备或逐条用户追踪字段。
- 不把 service role 暴露到浏览器。
- 不改写现有 RLS 或 Realtime publication。
- 不夹带工作区其他任务改动。

## 验证证据

| Check | Result | Evidence |
|---|---|---|
| Contract scan | pass | 现有会话已包含双方最后阅读时间，消息包含创建时间 |
| TypeScript | pass | `npx tsc --noEmit` 退出码 0 |
| Lint | pass | `npm run lint` 退出码 0 |
| Build | pass | Next.js 16.2.6 production build 成功，18 个静态页面生成完成 |
| Browser verification | pass | 生产后台 TECHSERVICE 会话显示“已发送”，weng 会话显示“已读”；浏览器错误日志为空 |

## 执行记录

- 创建：2026-07-25
- 开始：2026-07-25
- verified：2026-07-25，数据契约、时间戳判定、中意双语、两套消息渲染路径、TypeScript、lint、build 均通过
- released：2026-07-27，commit `0461aec` 推送至 `main`；Vercel production deployment `dpl_DNojsU3hR3hwuQ8gLq6fCbeRUPEp` READY 并绑定 `https://www.partspro.app`
- closed：2026-07-27

## 结果

在线消息已读回执已上线。客户消息与员工回复均基于对方最后阅读时间显示“已发送/已读”，沿用现有 Realtime 会话更新；未新增数据库字段、migration 或额外个人追踪数据。
