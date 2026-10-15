# AI Onboarding Notes — 实验 3（nextchat）问题日志

> 实验：用 Autional AI onboarding skill（https://www.autional.cn/ai）给 [NextChat](https://github.com/ChatGPTNextWeb/NextChat) 接入 Autional 登录，并做单用户 → 多用户改造（数据隔离 + 平台存储持久化）+ Vercel 部署。
> 本文件记录接入全过程的问题、根因与处置，按分类归档。编号带 **N 后缀**（实验 3 专属），与实验 1（takenote）/实验 2（novel）编号互不混淆；同源复发的缺陷标注「novel Cxx 同源」。

## 状态（2026-10-15 收官 ✅）

| 阶段 | 状态 | 备注 |
| --- | --- | --- |
| fork + lab 骨架 | ✅ | fork `autional-demo/nextchat` + submodule `nextchat/`；上游基线 `839a24df` |
| 租户 + 账号 + 客户端 | ✅ | 试用租户 `nextchat-demo` + 3 测试账号 + OAuth public client（脚本见 `provision/nextchat-*.mjs`） |
| 代码接入（skill Phase 5） | ✅ | SSO + 会话门（全 LLM 路由 + 平台存储路由）+ private Blob 状态快照 + 同源 `/bff` |
| 本地测试 | ✅ | 全量 **39 套件 / 185 用例** PASS（含 autional 5 套件 / 28 用例）；隔离探针 **6/6**；live-auth 探针 **4/4** |
| Vercel 部署 | ✅ | **https://nextchat-demo-eight.vercel.app**（生产 4 次部署，末版 `7wk9zgi4o`） |
| 生产 E2E | ✅ | 5/5：SSO 登录 / 对话持久化（清本地 → blob 恢复）/ 换号隔离（bob 零 alice）/ 换号往返（alice 4 会话完好）/ 登出（修复后实点：干净落 `/login`，无僵尸） |

## 环境与基线

| 项 | 值 |
| --- | --- |
| 上游仓库 | https://github.com/ChatGPTNextWeb/NextChat（MIT；Next.js 14 App Router + React 18 + Zustand） |
| 实验 fork | https://github.com/autional-demo/nextchat（分支 `feature/autional`） |
| 本地 | `D:\ws\ai-onboarding-lab\nextchat`（submodule） |
| 线上（生产） | **https://nextchat-demo-eight.vercel.app**（Vercel 项目 `nextchat-demo`） |
| 上游基线 | `839a24df`（Merge PR #6914，2026-10-15 fetch） |
| 技术栈 | Next.js 14.1.1 → **14.2.35**（D1N 安全升版）· React 18 · Zustand · yarn |
| 关键依赖 | `@autional/core 0.3.4` / `@autional/react 0.3.0` / `@autional/next 0.3.0` / `@autional/api-identity 0.3.0`；`@vercel/blob ^2.8.2`（D2N 外置打包） |
| 已知改造面 | 单用户本地应用：无账号体系，数据全在浏览器（IndexedDB / localStorage）；服务端可配中继 key 直连 LLM |
| 本机 | Node v24.15.0 · 网络：github.com / `*.vercel.app` 直连被墙（走 v2rayN 代理） |

## 接入凭证（公开信息；密码不进本文件）

> 管理员密码 / 测试账号密码在 lab 单点台账 `provision/nextchat-admin-pw.txt` / `provision/nextchat-test-accounts.txt`（gitignored，永不入库）。

| 项 | 值 |
| --- | --- |
| 租户 | `nextchat-demo`（.cn，**试用** plan=free，2026-10-15 注册；到期边界同 exp1/2 口径，转永久先例见实验 2） |
| tenantId | `01M4YNQ323YT61WW2AA9SM9AJ3` |
| appId（OAuth public client） | `client-TgTEqF0vse53`（注册名 `nextchat-local-mv8wvfmi`；PKCE；redirect / CORS / post_logout 均含 `http://localhost:3000` + 生产域） |
| issuer | `https://api.autional.cn`（浏览器同源 `/bff` 反代；服务端绝对地址） |
| authorize | `https://auth.autional.cn/oauth/api/v1/oauth/authorize`（显式引脚，adaptation #2） |
| 管理员 | `nextchat+admin@autional.net` |
| 测试账号 | `nextchat-alice` / `nextchat-bob` / `nextchat-carol`（邮箱 `nextchat+<name>@autional.net`；hash 传输 `sha256hex(pwd \| tenantId)`） |

## 问题日志

（按分类归档；编号 N 后缀 = 实验 3 专属。C = 接入面 / D = 依赖配置运行时与数据语义 / E = 部署与平台 / S = 安全专项 / W = 告警观察）

### C 组（租户/账号/SDK 接入）——Phase 2-5

| # | 现象 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| C1N | SDK `createTrialTenant()` 直连 **404**（novel C1R **复发**） | `@autional/core` 请求路径缺 `/bff` + `tenant/` 段（novel 源码实证路径未变） | SDK 形态 404；真实端点对照 201 | 原始 fetch 直调真实端点 → **201**（`provision/nextchat-trial-register.mjs`） |
| C2N | 管理面链核验：exp1 C5/C6（管理员密码传输 / RBAC 播种）**未复现** | 10-10 三仓修复已上 prod 生效 | `nextchat-admin-verify.mjs` T1-T3 PASS | 无处置（好消息，修复效果再证） |
| C3N | `middleware.ts` 引 `@autional/next` 导致编译失败（novel C7 **同源**） | SDK dist 单文件 bundle 丢失 `"use client"` 标记，react-server 编译失败 | 本地 build 报错 | 本地等价实现（cookie 存在性门 `/` → `/login`）；token 真实性不在中件层信任（见 S1N） |
| C4N | 登出 `id_token_hint` ~~永远不可得~~（**2026-10-15 修正**：活跃会话 hint 可得） | 原观察系**清除态**载荷；0.3.x 活跃会话实测持久化含真实 `idToken`(785) + `refreshToken`(35) | localStorage 转储（清除态 vs 活跃态对照）+ JWT 解码（id ttl=1800s） | hint 存在 → 标准端点登出（见 E2N 更新）；为 null 时走确认页分支 |
| C5N | 会话闲置必失效（novel C12/C13 **同源复现**） | 刷新链缺分支 + seedStorage 覆写（同 novel 根因；refresh 401 良性、无 offline_access） | 现场观察：TTL 后请求 401；重载 → SSO 自动重放续登 | 应用侧缓解：`/login` 残留 cookie 自动重放（只试一次）+ PlatformSync 兜底；SDK 刷新链待平台修复 |
| C6N | cookie 桥接 token 过期后**推送静默停摆**（页面开 10+ 分钟） | 复合 C5N：刷新不发生 → cookie 不同步 → `PUT /api/user-state` 401 → 客户端停推（无提示） | PUT 401 + console 时序 | 重载/自动重放恢复；记入 SETUP §Known boundaries |

### D 组（依赖/配置/运行时 · 含数据同步语义）

| # | 现象 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| D1N | `next@14.1.1` lockfile 钉死，含已知 CVE（middleware-bypass 类） | 上游未跟版 | 部署前检查（对比 latest 14.x） | `yarn add next@^14.2.35` 升 **14.2.35**；构建/测试全绿 |
| D2N | `@vercel/blob` 语法无法被 Next 14 服务端打包 | 依赖链 undici 私有类字段语法 | build 报错 | `serverComponentsExternalPackages: ["@vercel/blob"]` 外置 |
| D3N | Windows **EBUSY**：`.next/standalone` 文件锁 | Windows 文件锁行为 | build 报错 | 等待后重试（**不删 `.next`**——用户指令） |
| D4N | `yarn test:ci` 在 git-bash 失败 | `$(yarn bin jest)` 返回 shell shim → SyntaxError | 测试报错 | 直调 `node --no-warnings --experimental-vm-modules node_modules/jest/bin/jest.js`；**185/185** |
| D5N | 中继目录无 `gpt-4o-mini`（部分模型 400/503） | `api.tu-zi.com` 模型目录差异 | `/v1/models` 列表对照 | `DEFAULT_MODEL=gpt-5` |
| D6N | 自动标题静默失败（候选，未修） | `SUMMARIZE_MODEL="gpt-4o-mini"` 硬编码（`app/constant.ts:423`），中继无此模型 | 代码级 + 语义推断 | 留档（改自动标题模型可解） |
| D7N | 服务端 `DEFAULT_MODEL` 不生效（上游缺陷） | `app/store/access.ts` fetch 仅写 `DEFAULT_CONFIG` —— persist 水合后活 store 为独立对象，引用已分离 | 生产 `/api/config` 返回 gpt-5 但实际请求发 mini | fork 修复：① `useAppConfig.getState().update()` 同步活 store；② `app/store/config.ts` 种子改 `gpt-5` |
| D8N | D7N 修复后浏览器仍回 mini（终根因） | 上游 `mergeWithUpdate` typo（`app/utils/sync.ts:151-165`：`remoteUpdateTime` 误读 `localState.lastUpdateTime` → 恒 tie → `merge(local, remote)` **remote 恒胜**）→ 每次加载 pull 把 blob 旧 config 回灌 | PUT 体核验 + 重载回归 | 数据收敛（UI 改模型 → 推送 blob）；**加载语义 = blob 为事实源**（复跑注意） |
| D9N | NextChat 服务端日志明文打印完整中继密钥 | 上游行为（`[Server Config] using 1 of 1 api key` 等） | build/运行日志现场 | 输出过滤 + **文档零引用**（本文件绝不复述键值） |
| D10N | Windows 孤儿进程/端口冲突 → 静态块 404 | TaskStop 杀壳不杀 node；dev + 新实例双写 `.next` | netstat/taskkill 现场 | `taskkill //F //PID`；避免删 `.next` |
| D11N | 桌面端会话删除**无确认直删** + 撤销 toast（窗口过期即丢） | 上游行为：`chat-list.tsx:157-158` 非 narrow 桌面环境绕过 `showConfirm` | 误点现场（测试对话被删） | 观察记录；恢复兜底 = 平台 blob（拉回完整会话） |
| D12N | 演示对话的**最终消息不落平台**（blob 内为流式中途的空版本） | fork 自写 `platform-sync.tsx` 推送竞态：飞行中 push 的成功回调 `dirty=false` 抹掉飞行期新变更，定时器已被消费 → 最终内容永不推送 | console + network 时序复原（PUT #61 中途体发出、飞行期变更被抹） | 修复：发送前消费脏标记 + inflight 串行化 + finally 兜底重排 → 部署 `jy3ion23m` → 生产复验（#186 中途 / **#188 终稿完整**） |

### E 组（Vercel 部署 + 平台缺陷）

| # | 现象 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| E1N | 本地登出后落 api 域 JSON（`{"code":0,"message":"logged_out"}`）而不回跳应用 | `post_logout_redirect_uris` 未注册（novel E9 谱系） | 响应体原文 | `nextchat-update-client.mjs` 注册 `http://localhost:3000/` → 一跳回 `/login` |
| E2N | 生产登出 → `auth.autional.tianv.mobi/logout-confirm` **404**（死域；OP 会话不终结） | 双层：① fork 无 hint（C4N，后修正为清除态假象）② 平台标准端点在无 hint 时 302 死域 | 两域 curl 对照（`auth.autional.cn` 200 / `tianv.mobi` 404；state UUID 透传）；平台会话实际终结无僵尸 | fork 绕行：无 hint 直达 `auth.autional.cn/logout-confirm`；单测补强 5/5；部署 `7wk9zgi4o`；实点验证干净落 `/login`。**2026-10-15 更新**：hint 存在 → 标准端点实测走通（OP 会话终止、干净落 `/login`），两分支均在位 |
| E3N | 登出确认页裸 i18n key（`logoutConfirm.*`） | 平台 i18n 缺键 | 页面快照 | 平台 UI 缺陷留档 |
| E4N | 平台 login 偶发 **502**（瞬时） | 平台波动 | 两次 `POST …/auth/login` 502 → 8s 重试 200 | 重试即恢复；留档（脚本 5xx 重试惯例覆盖） |

E 组附 · 部署事实（2026-10-15）：

- Vercel 项目 `nextchat-demo`（`prj_UtLy0EVSpRhxUZQEPiv3HeSwnBPy`，team `team_DH5R480Z49vsc8ZrHBVHiYY3`）；CLI 直传（`--archive=tgz`；`.vercelignore` 排除 `.env*` / `.data/` / `.next/` / `.swc/`）。
- Blob 存储 `store_QnigCBrtCrLy22tz`（iad1，**private**；静态 token 模式注入 `BLOB_READ_WRITE_TOKEN`）。
- 生产部署 5 次：`a88qg4u8f`（首次）→ `12n2ywy20`（DEFAULT_MODEL 修复）→ `jy3ion23m`（推送竞态修复 D12N）→ `7wk9zgi4o`（登出修复 E2N）→ `a5azbokt0`（登录卡升级 + 推广卡移除 + README Deploy 注记，当前）。

### S 组（安全专项）

| # | 面 | 结论 | 证据 | 判定 |
| - | -- | ---- | ---- | ---- |
| S1N | 会话门：全 LLM 路由 + `/api/user-state` + proxy/webdav/upstash/artifacts | 伪造/缺失 token → **401**（cookie 不信任，逐请求 `/auth/me` 权威校验） | 探针 I5/I6 + 生产负面检查 | **PASS** |
| S2N | 跨用户隔离：bob 读不到 alice（反向同） | userId 取自 `/auth/me`（客户端不可指定）+ private blob 命名空间 | 探针 **6/6**（含 cross-user `leak=false`）+ 生产浏览器复验（bob 零 alice） | **PASS** |
| S3N | 持久化恢复：清空本地 → 重载从 blob 拉回 | — | 生产两次（alice / bob） | **PASS** |
| S4N | 存储私有 + 路径注入护栏 | Blob `access:"private"`；`USER_ID_RE=/^[A-Za-z0-9_-]{1,64}$/` | 代码级 + 探针 | **PASS** |
| S5N | 会话 cookie 非 httpOnly | SDK 设计使然（cookie 为桥接副产物） | 记录 | 接受（SameSite=Lax + https 加 Secure；不承载凭证面） |
| S6N | 凭据面：中继密钥仅 Vercel env（encrypted）+ 本地 `.env`（gitignored）；日志泄漏风险见 D9N | — | env 推送回显仅键名 | **PASS**（含注记） |

### W 组（告警/观察）

| # | 告警 | 根因 | 证据 | 处置 |
| - | ---- | ---- | ---- | ---- |
| W1N | tsc 既有 mock 类型错误（`test/autional-server-auth.test.ts` 7 处 `never`） | 测试 mock 类型不严（既有） | tsc 输出 | 不阻断（Vercel 构建不跑 tsc；成功部署为证） |
| W2N | `vercel-query.mjs` 导出的项目 JSON 含加密 env 密文 | 脚本原样回显 | 现场 | 避免再导出/回显；无明文泄漏 |
| W3N | 本机直连 `*.vercel.app` / github.com 被墙（DNS 污染）；ghp.ci 插件源连接失败为无关噪声 | 环境特性 | curl 000 → 代理 200 | 脚本/复跑走 v2rayN 代理；git 远端一律 SSH |
| W4N | 4MB 状态上限（413 已处理） | Vercel 请求体 4.5MB 限制 | 代码 + 设计 | 超限跳过上推，本地保留（不丢数据） |

## 复跑注意（教训汇总）

- **平台存储是加载时的事实源**（D8N）：blob 里的 config 会经 pull 回灌浏览器。改默认模型等配置后，务必经 UI 走一次推送（或直接 PUT `/api/user-state`）让 blob 收敛；只改本地代码/IndexedDB 会被下次加载覆盖。
- **会话闲置后推送停摆**（C5N/C6N）：access token 约 5 分钟过期且刷新链失效（novel C12/C13 谱系）；重载经 `/login` 自动重放 SSO 续登。演示前建议先重载一次。
- **桌面删除无确认**（D11N）：会话列表桌面端删除图标点击即删（撤销 toast 过期不可恢复）；演示点击避开行尾图标；恢复靠平台 blob。
- **测试**（D4N）：用 `node node_modules/jest/bin/jest.js --ci` 直调（`yarn test:ci` 在 git-bash 下 shim 失败）。
- **日志纪律**（D9N）：NextChat 构建/运行日志会明文打印中继 key——任何输出/文档过滤，绝不复述键值。
- **网络**（W3N）：github.com / `*.vercel.app` 直连被墙；脚本走 v2rayN 代理、git 远端一律 SSH。
- **登出绕行可移除**（E2N）：平台修复「标准端点在无 hint 时 302 死域」后，`logout.ts` 的绕行分支可删除（代码内注记同此）。

---

落地文档：`AUTIONAL_SETUP.md`（配置/部署实录）· `AUTIONAL_CHANGES.md`（相对上游的增改清单）。
