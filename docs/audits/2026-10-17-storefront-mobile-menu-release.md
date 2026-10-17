# UI08 — 手机菜单四类直达发布记录

状态：已上线，独立 RELEASE_VERIFIED。老板当前要求：去掉手机侧边菜单的首页、帮助及目录层，直接显示手机、平板、电脑、电子产品；沿用已确认的前台更新及上线授权。

## 变更范围

仅4运行文件：StoreMobileMenu删除首页/帮助/目录折叠层及其状态，分类树直接显示；CatalogBrandTree增加可选showAllProducts（默认true）与显示名覆盖，仅该菜单传false并将电子产品名称缩短。两字典同步中/意/英文菜单说明与短名称。桌面和筛选面板保留全部目录；搜索、真实品牌/机型、当前选中项、代客参数、关闭回焦沿用原逻辑。没有Logo、CSS、API、auth、价格/库存/交易、依赖、DB/migration、env或后台改动，主目录未提交运行源码未混入。

## 版本与发布

- 基线B8UX：`dpl_B8UXo2AiVFfNyrqvDThCSAwNLJGw` / `c68206ccd977ba6c8770bc6753bd37f2fbc86a38`，从其文档后继0d268b3建立分支 `codex/storefront-mobile-menu-20261017`。
- 运行提交：`23db1b2783356c18ac658970af7064ccf81f0cdb`；指纹 `10426b5a501ec28febdce71d7be2e2953d7b1b93fa79c9be4db1b7d7f5182196`。1127 tracked文件匹配，保护范围无改动；473上传源文件hash全匹配，唯一额外项为正确生成的next-env.d.ts。
- 独立STAGE_GO后创建production skip-domain候选 `dpl_CzDN5mBvDaEd343VGLGk1iqoF3sN` / qnnf4i6my；云端44秒build成功。独立PROMOTE_GO后推广同一构建，最终www/apex均READY/精确23db1b2/无aliasError，apex直接307到www。独立RELEASE_VERIFIED，回退B8UX/c682仍READY。

## 验证

- `npm run test:storefront`24/24、现有filter-draft/commerce13/13、完整lint及Next16 webpack build通过。
- 额外现有catalog contract测试裸Node VM无法解析既有@/i18n/english-ui-copy别名；验证时的测试、库、API schema与生产基线未变。用verification-only TS alias loader执行相同7例，7/7通过；未改正式测试或产品源码来规避失败，不将其描述为原裸命令无条件通过。
- 实际组件合成数据：ZH/IT/EN×390/320，四个顶层入口、无home/help/catalog/all-products菜单项及无横向溢出；phone→Apple→iPhone12路由/重开选中、Escape回焦、搜索CB25关闭、电脑分类选择均通过。1536桌面与筛选面板仍保留全部目录。
- 同一云端候选真实三语菜单、320/390、tablet点击/关闭/重开、回焦和768/1536通过。候选12页面HTTP与30语言/设备/匿名隔离均通过；正式同样12+30通过。正式已有登录会话仅只读菜单，真实品牌显示名Apple保留，进入iPhone12准确筛选并关闭，无横溢。浏览器console warning/error为0；限定runtime error/fatal窗口16:15:10–16:20:10 UTC为空。
- 候选ZH截图拍到Sheet过渡帧，不作为终态视觉证据；正式另次工具调用后保存稳定中文390图，执行者与独立守门均查看通过。没有真实交易、客户资料、售后或客服写入E2E；没有物理手机Safari实机测试。

证据：`outputs/storefront-mobile-menu/2026-10-17/`，正式图 `production-menu-zh-390.jpg`，发布日志/合同/HTTP/独立复核归档 `release/`。本记录与roadmap以docs-only提交归档，不再次部署。

收尾隔离：冻结并上传菜单构建之后，原隔离目录出现另一批未提交的加载/交易界面源码改动。本次不覆写、暂存或发布这些变动；正式构建仍为已核验23db1b2。发布文档改在独立worktree及分支 `codex/storefront-mobile-menu-release-notes-20261017` 归档，源分支保持原状。
