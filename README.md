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
