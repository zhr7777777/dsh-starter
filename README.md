# dsh-starter

一个**不 Fork 官方源码**的 DeepSeek Harness 扩展起步项目：官方包照常从 npm 安装，本项目只提供自己的 Host 插件与 Web 客户端插件，通过官方插槽（UI slots）把自己挂进原生界面。

```
官方 @deepseek-ai/dsh-*  (npm 精确版本 0.2.1-rc.5)
        │
        ├─ Host 侧：cordis 插件树 ── 你的插件行（cordis.patch.yml）
        │
        └─ Web 侧：官方 Composer / Sidebar / Conversation
                     └─ 插槽 ← 你的客户端模块（slots.register）
```

## 快速开始

要求 Node.js `^22.19.0 || >=24.0.0`，包管理器固定为 `pnpm@10.34.5`（`packageManager` 字段 + Corepack）。

```bash
corepack pnpm install
corepack pnpm dev
```

已经有全局 pnpm 时把 `corepack pnpm` 换成 `pnpm` 即可，命令等价。

首次运行会：

1. 构建插件（Host ESM + 客户端 CJS + 类型声明）；
2. 用官方 CLI 从 **官方 Web 默认配置**脚手架出一个 Profile：`.dsh-home/profiles/starter`；
3. 把插件打包成内容寻址的 `.tgz` 并注册进该 Profile；
4. 启动官方 `dsh web`，地址形如 `http://127.0.0.1:18990/?token=…`。

打开终端里打印的带 token 链接，侧栏会出现「示例」，点开就是插件注册的面板。

本机实测结果（0.2.1-rc.5）：

- Profile 由官方 CLI 脚手架生成，`dsh --profile starter --dump-config` 含 `id: dsh-starter-plugin`；
- 页面 boot 清单里出现 `dsh-starter-plugin/client.js`，说明客户端模块被官方 client-modules 自动装载；
- 侧栏出现带我们图标的一行（`aria-label="示例"`），点击后 `main` 插槽渲染出「第一个插槽面板」；
- 官方 Conversation、Composer、侧栏骨架全部保持原样。

端口与 Home 都可覆盖：

```bash
PORT=19000 pnpm dev
DSH_HOME=/tmp/dsh-home pnpm dev
```

无需打开浏览器的一次性自检（起服务 → 等 token URL → 校验 boot 清单里是否有本插件模块 → 退出）：

```bash
pnpm smoke
```

想直接看桌面窗口（Electron 外壳，复用同一份 `.dsh-home`）：

```bash
pnpm desktop
```

## 目录

| 路径 | 作用 |
|---|---|
| `packages/plugins/` | **所有插件**；一个目录一个包，构建/注册/启动自动发现（见 [插件说明](packages/plugins/README.md)） |
| `packages/plugins/starter/` | 示例 A：**Host + Client 双面**，侧栏图标 + 主面板（`starter-hello`） |
| `packages/plugins/expert-team/` | 示例 B：**输入框左侧「专家团」**，点击弹浮层，召唤后跳转 Starter 面板 |
| `packages/plugins/host-only/` | 示例 C：**仅 Host**，提供服务与生命周期，没有任何 UI |
| `scripts/build-plugin.mjs` | 构建全部插件（或指定目录）：按源文件自动决定 Host / Client 面 |
| `scripts/typecheck.mjs` | 逐个插件 `tsc --noEmit` |
| `scripts/dev.mjs` | 脚手架 Profile → 打包并注册全部插件 → 启动 `dsh web` |
| `scripts/smoke.mjs` | 无头验收：全部客户端模块进入 boot 清单 + Host-only 插件已应用 |
| `scripts/build-runtime.mjs` | 组装桌面运行载荷：插件 + Profile 模板（`--with-node` 再部署官方依赖树） |
| `apps/desktop/` | **Electron 外壳**：起 Host 子进程、抓就绪 URL、开窗、退出清理 |
| `apps/desktop/runtime/` | 生成物（gitignore）：Profile 模板 + 打包用的官方 `node_modules` |
| `apps/runtime/` | 仅作为 `pnpm deploy` 的依赖锚点（只有一个 `@deepseek-ai/dsh` 依赖，不含代码） |
| `.github/workflows/desktop.yml` | 五个平台目标的打包矩阵（mac ×2 / win ×1 / linux ×2） |
| `pnpm-workspace.yaml` | 工作区声明（`packages/plugins/*`）与 `onlyBuiltDependencies`（放行 esbuild 安装脚本） |
| `.npmrc` | 下载源（本机默认走 npmmirror；切回官方源只需改这一行） |
| `.dsh-home/` | 运行期 Home 与 Profile（已 gitignore，可随时删掉重建） |

## 三个关键契约

### 1. 一个包，两个面

```json
{
  "exports": {
    ".":        { "default": "./dist/index.js" },           // Host（Node）
    "./client": { "default": "./dist/client.browser.js" }   // 浏览器
  },
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": [] }
  }
}
```

- `dsh.bundle.patch` 让官方插件管理器把这一行插进 Profile；
- `dsh.client` 让官方 client-modules 在浏览器里装载 `./client`；
- 两个面**各自打包**，客户端只保留 React 与 `@deepseek-ai/*` 为 external，绝不内联第二份。

### 2. 客户端模块的外壳是固定的

```js
window.__ModuleLoader__.load({
  id: 'dsh-starter-plugin',
  factory: (require) => { const module = { exports: {} }; /* … */ return module.exports },
})
```

脚本执行时**只登记工厂**，模块体（含 CSS）在第一次 `import` 时才执行并缓存。

### 3. 插槽键必须成对

```tsx
const PANEL_ID = 'starter-hello'                                  // 同一个字符串两处用

ctx.slots.register({ name: 'sidebar.panellist', id: PANEL_ID,     // 列表槽：去重键 + 排序 + 无障碍名
                     label: '示例', order: 15 }, StarterIcon)     // 组件只画字形（收到 {size, active}）

ctx.slots.register({ name: 'main', key: PANEL_ID }, StarterPanel) // 键控槽：点击侧栏后渲染这里
```

`sidebar.panellist` 的每一行由官方壳渲染 `<button>`（tooltip、`aria-label`、选中态、折叠宽度），你的组件只返回图标；点击后官方调用 `layout.selectPanel(id)`，再由 `main` 按 key 找到你的面板。

## 加一个新的 UI 点

新插件放在 `packages/plugins/<name>/`，规范见 [插件目录说明](packages/plugins/README.md)。已有插件里加一个插槽：

1. 在 `packages/plugins/starter/src/client.tsx` 里找目标插槽名（如 `conversation.input.left`、`conversation.input.dock`、`sidebar.right.pane.tab`、`settings.section`）；
2. 用 `ctx.slots.inject(插槽名, () => ctx.slots.register({ ... }, 组件))` 包住注册；
3. list 槽给 `id`/`order`，keyed 槽给 `key`，需要业务数据时用 `inject: () => ({ … })` 把 `ctx` 的能力注入成 props；
4. 删掉插件后界面必须回到与官方安装包一致的状态——这是验收标准。

可用插槽清单来自官方各包的 `SlotMap` 声明，例如：

```bash
grep -r "interface SlotMap" node_modules/.dsh-home/profiles/starter/node_modules/@deepseek-ai/*/lib/types -l
```

## 桌面外壳（Electron）

`apps/desktop/` 是一个**只在外面套一层**的壳：它不 import 任何 DSH 代码，也不碰前端资源，只负责四件事——起窗口、起 Host 子进程、等一行就绪 URL、退出时收尸。

```
Electron 主进程                    官方 dsh web（子进程）
─────────────────────────────────────────────────────────
创建窗口（先显示 splash 占位页）
        │
        ├── spawn(ELECTRON_RUN_AS_NODE, bin.js --no-open) ──→ runProfile()：装配插件树
        │                                                    服务起来后打印一行
        ←── dsh web: http://127.0.0.1:PORT/?token=…
解析 URL，window.loadURL(它)
页面里没有 Node、没有 preload 桥，只有 HTTP
```

### 命令

| 命令 | 作用 |
|---|---|
| `pnpm desktop` | 组装 dev 版 runtime，然后直接开窗 |
| `pnpm desktop:runtime` | 只组装 runtime（构建插件 + 写 Profile 模板） |
| `pnpm desktop:smoke` | 无头验收：空 HOME → 播种模板 → 起 Host → 校验 boot 清单（用项目依赖） |
| `pnpm desktop:smoke:runtime` | 同上，但用 `pnpm deploy` 出的官方运行时（打包前必跑） |
| `pnpm desktop:pack` | 组装含官方依赖的完整 runtime，产出**免安装目录**（`--dir`，用于本机验证） |
| `pnpm dist:mac` / `dist:win` / `dist:linux` | 产出安装包（dmg+zip / nsis / AppImage+deb） |
自检开关：`DSH_DESKTOP_SELFTEST=1` 时，壳拿到就绪 URL 后不开窗直连页面、确认 `__DSH_BOOT__` 存在，然后按结果 `exit 0/1`——用它验证**打包后的 .app/.exe/AppImage** 是否真能启动：

```bash
DSH_DESKTOP_SELFTEST=1 "apps/desktop/release/mac/DSH Starter.app/Contents/MacOS/DSH Starter"
```

### 五个平台目标

| 平台 | 架构 | 产物 | 在哪构建 |
|---|---|---|---|
| macOS | arm64 | `dmg` + `zip` | macOS arm64 runner |
| macOS | x64 | `dmg` + `zip` | macOS x64 runner |
| Windows | x64 | `nsis` 安装器 | Windows x64 runner |
| Linux | x64 | `AppImage` + `deb` | Linux x64 runner |
| Linux | arm64 | `AppImage` + `deb` | Linux arm64 runner |

**架构不写在配置里，而是由「在哪台机器上跑」决定**：`electron-builder.yml` 的 target 故意不带 `arch` 列表。`runtime/host/node_modules` 是 `pnpm deploy` 当场从本机解析出来的官方依赖树，含平台原生二进制（`node-pty`、`koffi`、`sharp`、Office 资产）；硬把 x64 的 runtime 塞进 arm64 的 app，产物能生成但一定起不来。所以在 Intel Mac 上 `pnpm dist:mac` 只出 x64，在 Apple Silicon 上只出 arm64，在 macOS 上交叉打出的 Linux 包也起不来——想覆盖五个目标就在五台对应机器（或 CI 的五个 runner）上各跑一次，`.github/workflows/desktop.yml` 就是这么排的。

本地产物在 `apps/desktop/release/`（gitignore），命名如 `DSH-Starter-0.1.0-x64.dmg`、`DSH-Starter-Setup-0.1.0-x64.exe`、`DSH-Starter-0.1.0-arm64.AppImage`。默认**不签名**，分发前需要自己配 `CSC_LINK` / `CSC_KEY_PASSWORD`（macOS 还要公证），Windows 同理换 `WIN_CSC_LINK`。

### Electron 版本被官方卡住，这是唯一必须「钉版本」的地方

壳用 `ELECTRON_RUN_AS_NODE=1` 复用 Electron 自带的 Node 跑官方 CLI，因此**不额外携带一份 Node**。但官方原生加载器（`node-addon-require-builtin`）是按指纹放行的，不在名单里的 Electron 会直接拒绝启动：

```text
node-addon-require-builtin unsupported: Unsupported/no-context
(unsupported Electron runtime fingerprint: Node 24.22.2, V8 15.6.75.50-electron.0
 (supported Electron versions: 43.0.0, 44.0.0, 44.7.0, 45.0.0-alpha.6))
```

所以 `apps/desktop/package.json` 把 `electron` 钉在 **44.7.0**，而不是「最新版」——最新稳定版 45.3.0 在这份 DSH 的允许列表之外。升级 DSH 或 Electron 前先看这条报错里的白名单；壳检测到这句话时会把错误页换成可操作提示，而不是一行堆栈。

替代方案是自己打包一份官方 Node 二进制（WorkDSH 桌面就是这么做的），代价是每个平台多一份运行时和一套下载校验，起步项目不值得。

### 两个 runtime 目录别搞混

| 路径 | 是什么 | 要不要提交 |
|---|---|---|
| `apps/runtime/` | 一个**只有 `package.json` 的小包**（`dsh-desktop-runtime`），唯一作用是给 `pnpm deploy --filter dsh-desktop-runtime` 一个「生产依赖集合」 | 要，它是源码 |
| `apps/desktop/runtime/` | **生成物**：Profile 模板 + `host/node_modules` 官方依赖树，约 540 MB | 不要，`pnpm clean` 可清，`pnpm desktop:runtime` / `desktop:pack` 重建 |

为什么不把 `@deepseek-ai/dsh` 直接写进 `apps/desktop/package.json`：那样 electron-builder 会在 `apps/desktop` 下发现 `node_modules` 并把整棵官方依赖树打进 `app.asar`（现在日志里的 `no node modules found in collection` 正是我们想要的），同时让「外壳」和「运行时」的生命周期绑死。拆成独立锚点包以后，`pnpm deploy` 只按它的 `dependencies` 收敛依赖，外壳目录里始终只有 `src/`、`package.json` 和一份构建配置。

### runtime 里有什么，为什么打包版不需要 pnpm

```
apps/desktop/runtime/
├── profile/                       ← Profile 模板，首次启动复制进 DSH_HOME
│   ├── package.json               ← 只声明 dsh.profile.bundles（不含 dependencies）
│   ├── cordis.yml                 ← 空数组，树由 patch 组装
│   ├── cordis.patch.yml           ← 用户可改的 patch 层
│   └── node_modules/<插件>/        ← 三个插件，普通目录拷贝
└── host/node_modules/             ← 仅打包版：pnpm deploy 出的官方包树
```

`host/` 这层目录不是装饰：electron-builder 的 `extraResources` 过滤器会**丢掉落进 resources 的根级 `node_modules`**（`app-builder-lib/out/util/filter.js` 里 `relative === "node_modules"` 直接 return false），第一版打包出来的 `.app` 里 `Resources/runtime` 只有 84 KB，官方依赖树整个没进去。往下一层就没有这条规则，也不用写 afterPack 脚本。

体积参考（macOS x64 实测）：`runtime/` 约 540 MB，成品 .app 约 890 MB，`dmg` 约 270 MB、`zip` 约 280 MB。大头不是我们的插件（三个加起来几百 KB），而是官方 `dsh-base` 带进来的 Office 资产（`libreoffice-kit` 单平台就 157 MB）与语音模型（`sherpa-onnx` 36 MB）。要减体积就得裁官方 bundle，那已经不是「起步项目」该做的事，所以这里保持官方完整能力。

关键点是**插件以普通目录躺在 Profile 里**，而不是用 `dsh plugin add` 注册的 tgz。官方 loader 解析 bundle 时先看 Profile 自己的 `node_modules`，所以：

- 不需要 pnpm、不需要 registry、不需要网络；
- 首次启动只是 `cp -R runtime/profile → DSH_HOME/profiles/starter`；
- 之后这个 Profile 就是用户的，`cordis.patch.yml` 可改，`pnpm dev` 与桌面窗口还能共用。

`DSH_HOME` 的落点：开发模式指项目的 `.dsh-home`（和 `pnpm dev` 共享会话），打包版指系统 user-data 目录（macOS `~/Library/Application Support/DSH Starter/dsh-home`）。启动日志两边都写到 `DSH_HOME/desktop.log`，起不来时先看它——窗口里的报错页只显示最后十几行。

## 常见问题

**安装很慢 / `ECONNRESET` / `ETIMEDOUT`**
本机到 `registry.npmjs.org` 不稳，仓库里的 `.npmrc` 默认指向 npmmirror：

```ini
registry=https://registry.npmmirror.com
```

`scripts/dev.mjs` 会把这个源通过 `npm_config_registry` 传给 Profile 的 pnpm，所以脚手架与 `plugin add` 用同一个源。切回官方源只要改这一行并 `rm -rf .dsh-home && pnpm install`。

**pnpm 提示 `Ignored build scripts: koffi, node-pty, …`**
pnpm 10 默认拦截安装脚本，本项目只放行了 `esbuild`（`pnpm-workspace.yaml → onlyBuiltDependencies`）。官方包自带的原生二进制已经预编译，实测无需额外放行。

**`dsh web` 起不来 / Profile 残缺**
删掉 `.dsh-home` 重新 `pnpm dev`，脚本会重新脚手架。

**手动执行 `dsh plugin … add` 报 `ERR_PNPM_ADDING_TO_ROOT`**
脚手架生成的 Profile 是单包 pnpm workspace，手动安装时需要加 `-w`：

```bash
DSH_HOME=$PWD/.dsh-home node node_modules/@deepseek-ai/dsh/lib/bin.js \
  plugin --profile starter add -w ./path/to/your-plugin.tgz
```

`scripts/dev.mjs` 已经带了 `-w`。

**改了代码但界面没变**
`dev.mjs` 会重新 pack 并以内容哈希路径注册；如果仍在看旧页面，确认终端里出现了 `Registering dsh-starter-plugin …`，或手动 `rm -rf .dsh-home/profiles/starter/node_modules` 后重跑。

**两个 React / hooks 报错**
说明客户端打包把 `react` 内联了。检查 `external` 列表，保持 React 与 `@deepseek-ai/*` 外置。

**想升级官方版本**
把 `package.json` 里所有 `@deepseek-ai/*` 改成同一个精确版本，`pnpm install`，然后删 `.dsh-home` 重建 Profile。插槽名与类型以新版本官方包为准，升级前先核对 `SlotMap`。
