# PartsPro 组件状态

沿用 `Button` variants、现有语义色、Radix dialog 与 focus ring；不建立第二套设计系统。

| 组件/状态 | 行为与可访问性 |
|---|---|
| Button 默认/hover/pressed/focus | 原有 variants；按压位移；键盘 focus-visible；触控主要动作至少 44px |
| disabled | 保留可见原因；提供登录、重试或帮助入口；不得只降低整张卡透明度 |
| ActionButton pending | `aria-busy`、文字与 spinner，锁定重复提交；减少动态效果时停止旋转 |
| ActionButton success | 成功图标，结果在相邻 AsyncFeedback 中说明 |
| ActionButton unknown | 锁定原提交；查询/核对操作单独提供，禁止盲目重放 |
| AsyncFeedback loading/empty/info/success | polite status、稳定标题、可选说明和操作 |
| AsyncFeedback error/unknown | alert；错误与结果未知分开；保留用户输入与明确恢复动作 |
| 列表替换/续页 | 替换锁定旧结果；续页错误底部原位重试同 offset |
| 表单 | label、required/optional、inline 校验；非秘密输入保留；不持久化密码 |
| Dialog/长表单 | 保存中拦截关闭；脏输入确认；Escape/关闭恢复触发器焦点 |

共享接口：`AsyncFeedback({state,title,description?,actions?,className?})`；`ActionButton` 继承 Button props，新增 `state` 和 `pendingLabel`；`useUnsavedChanges(dirty,message)` 只拦截浏览器关闭/刷新和链接离开，不保存客户数据。内部演示 `/internal/component-states` 仅非生产可用。
