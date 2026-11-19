# packages/plugins

所有 WorkDSH 风格的 DSH 插件都放在这里，一个目录一个包。构建、打包、注册、启动全部由根目录脚本自动发现，**不需要在根 `package.json` 里逐个登记**。

```
packages/plugins/
├── README.md          ← 本文件
├── starter/           ← 示例 A：Host 服务 + 两个 UI 插槽（主面板、输入框运行位置选择）
│   ├── package.json   ← 双面 exports + dsh.bundle.patch + dsh.client
│   ├── cordis.patch.yml
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts   ← Host 入口（Node）
│       └── client.tsx ← 浏览器入口（Starter 面板、本地/云电脑选择）
├── expert-team/       ← 示例 B：输入框左侧「专家团」，点击弹浮层，召唤后跳转 Starter 面板
│   ├── package.json
│   ├── cordis.patch.yml
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts   ← 只为了让包成为 loader entry（见下文）
│       └── client.tsx ← conversation.input.left + 浮层 + layout.selectPanel
├── host-only/         ← 示例 C：只有 Host 面，没有任何 UI
│   ├── package.json   ← 只有 "." exports 和 dsh.bundle.patch，没有 dsh.client
│   ├── cordis.patch.yml
│   ├── tsconfig.json
│   └── src/
│       └── index.ts   ← 提供服务 + 生命周期，无浏览器入口
├── dsh-context/       ← 内置：用量统计（上游完整源码，设置页入口）
│   ├── package.json   ← 双面 exports + dsh.bundle.patch + dsh.client
│   ├── tsdown.config.ts
│   ├── cordis.patch.yml
│   ├── locale/ icon.svg
│   └── src/
│       ├── host/      ← Host 面（投影、路由、命令、缓存）
│       ├── client/    ← settings.section 页面与其余 UI
│       └── shared/    ← 两端共享类型
└── inline-settings/   ← 示例 D：把官方设置弹窗停靠到主区域（纯表现层）
    ├── package.json
    ├── cordis.patch.yml
    ├── tsconfig.json
    └── src/
        ├── index.ts   ← 最小 Host 面，只为让 client 模块被发现
        └── client.tsx ← 给官方设置 portal 注入停靠样式与导航收起逻辑
```

## 两种插件形态

| 形态 | 需要哪些源文件 | `exports` | `dsh` 字段 | 典型用途 |
|---|---|---|---|---|
| **Host + Client** | `src/index.ts` + `src/client.tsx`（或 `src/host/index.ts` + `src/client/index.ts` + 自有构建） | `.` + `./client` | `bundle.patch` + `client` | 有界面的业务功能（`starter/`、`expert-team/`、`dsh-context/`、`inline-settings/`） |
| **仅 Host** | `src/index.ts` | 只有 `.` | 只有 `bundle.patch` | 服务、工具、存储、会话中间件（`host-only/`） |

**没有「仅 Client」这种形态。** 官方 client-modules 是**扫描 Host loader entries** 来找 `dsh.client` 声明的——没有 loader 行（也就没有 Host 入口）就没有浏览器模块。所以哪怕是纯 UI 插件，也保留一个最小 `src/index.ts` + `cordis.patch.yml`（`expert-team/` 就是这么做的）。

构建脚本按**源文件是否存在**决定产出哪些面：

- 有 `src/index.ts` → 产出 Host ESM；
- 有 `src/client.tsx` → 产出 `__ModuleLoader__` 客户端模块；
- 构建前会清理这两个旧产物，删掉某个面后不会残留。

如果包内存在 `tsdown.config.ts`，构建脚本会直接调用包自己的 tsdown（`dsh-context/` 用它处理 Tailwind、CSS Modules、SVG 与声明文件），不再套用上面的 esbuild 预设；这类包把产物统一写到 `dist/` 即可。

## 插件 = 一个包，两个面

| 面 | 入口 | 运行环境 | 能做什么 |
|---|---|---|---|
| Host | `exports["."]` → `dist/index.js` | DSH Host（Node） | 提供服务、工具、存储适配、会话中间件 |
| Client | `exports["./client"]` → `dist/client.browser.js` | 浏览器（官方 Web 壳） | 通过官方插槽注册 UI |

两面各自独立打包；客户端只保留 `react` / `react-dom` / `@deepseek-ai/*` 为 external，**绝不内联**。

## 新增一个插件的最小清单

1. 复制 `starter/` 为 `packages/plugins/<你的插件>/`，改 `name`（全局唯一，同时也是客户端模块 id）；
2. 改 `cordis.patch.yml` 里的 `id` / `name`；
3. 写 `src/index.ts`（Host）与/或 `src/client.tsx`（UI）；
4. `pnpm install`（让 workspace 链上新包），然后 `pnpm dev`。

必须保留的四个约定：

```jsonc
{
  "type": "module",
  "exports": {
    ".":        { "default": "./dist/index.js" },           // Host
    "./client": { "default": "./dist/client.browser.js" }   // 浏览器（只做 UI 时也要有，构建脚本会生成）
  },
  "files": ["dist", "cordis.patch.yml"],
  "dsh": {
    "bundle": { "patch": "./cordis.patch.yml" },
    "client": { "platform": "web", "inject": [] }
  }
}
```

`dsh.bundle.patch` 决定插件以哪一行进入 Profile；`dsh.client` 决定浏览器是否装载 `./client`。**没有 `dsh.client` 的插件不会出现在 UI 里，没有 Host 入口的包不会被 Profile 加载。**

## 客户端插槽怎么写

```tsx
export const inject = ['slots'] as const

export function apply(ctx: Context): void {
  ctx.slots.inject('sidebar.panellist', () => ctx.slots.register(
    { name: 'sidebar.panellist', id: 'my-panel', label: '我的功能', order: 60 },
    ({ size }) => <Icon size={size} />,
  ))

  ctx.slots.inject('main', () => ctx.slots.register(
    { name: 'main', key: 'my-panel' },          // 必须与侧栏 id 相同
    MyPanel,
  ))
}
```

三条硬规则：

1. **`sidebar.panellist` 的 `id` === `main` 的 `key`**，否则图标点开是空白；
2. **只画 UI，不要自己造按钮**：官方壳拥有 `button`、tooltip、选中态与无障碍属性；
3. **成对注册、成对回收**：一个插槽条目对应一个 disposer，卸载后界面必须回到官方原样。

常用插槽（其余见官方包 `SlotMap` 声明）：

| 插槽 | kind | scope | 典型用途 |
|---|---|---|---|
| `sidebar.panellist` | list | root | 侧栏导航图标 |
| `main` | keyed | root | 主面板内容 |
| `conversation.input.left` / `.dock` / `.overlay` | list | session | 输入框左侧控件 / 顶部条带 / 浮动层 |
| `sidebar.right.pane.tab` | keyed | session | 右侧栏页签内容 |
| `settings.section` | list | root | 设置页分区 |
| `shell.overlay` | list | root | 全局浮层 |

> 插槽类型来自官方包的类型声明合并。用到哪个插槽，就在 `client.tsx` 里 type-only import 对应包：
> `import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'`。

## 示例 B：专家团（浮层 + 跳转）

`expert-team/` 演示三件事：

1. **往输入框左侧加一个控件**：注册 `conversation.input.left`，`id: 'dsh-expert-team'`、`order: 40`；
2. **自己管理浮层**：触发按钮 + 绝对定位弹层（`bottom: calc(100% + 10px)`），外部点击与 `Escape` 关闭；
3. **跨插件跳转**：召唤专家后调用 `ctx.layout.selectPanel('starter-hello')`，落到 `starter/` 的 `main` 面板——注意它先检查 `main` 里确实存在这个 key，避免目标插件被禁用时把用户留在空页。

```tsx
ctx.slots.inject('conversation.input.left', () => ctx.slots.register(
  {
    name: 'conversation.input.left',
    id: 'dsh-expert-team',
    order: 40,
    inject: () => ({
      summon: (expert) => {
        const available = ctx.slots.entriesOfSlot('main').some(e => e.options.key === 'starter-hello')
        if (!available) return false
        ctx.layout.selectPanel('starter-hello' as MainPanelId)
        return true
      },
    }),
  },
  ExpertTeamTrigger,
))
```

三位专家是页面内的 mock 数据（`experts` 常量），没有 Host 往返，也没有改动会话。

## 内置插件：上下文洞察（设置页 + 上游完整源码）

`dsh-context/` 是把上游 `dsh-context@0.85.1` 源码内置进仓库的插件，功能全部保留，只把页面入口从 `main` + `sidebar.panellist` 改成官方设置面板分区：

```tsx
ctx.slots.inject('settings.section', () => ctx.slots.register(
  { name: 'settings.section', id: 'dsh-context', order: -5, label: () => t('ov.title'), locale: NS },
  OverviewPage,
))
```

官方 Account 是 `-10`、General 是 `0`，所以 `-5` 排在「通用设置」正上方，替换原「用量统计」页（`usage-stats/` 已删除）。上下文总览、`/context` 命令、会话右侧页签、输入框跳转按钮、Fleet 视图等仍由同一个包的 Host 面提供。

这个包演示**接入自带构建的第三方插件**：

1. 源码布局是 `src/host/` + `src/client/` + `src/shared/`，不是仓库通用的单文件入口；
2. 包内保留 `tsdown.config.ts`，处理 Tailwind、CSS Modules、`icon.svg?raw`、纯度和声明文件；
3. `scripts/build-plugin.mjs` 看到 `tsdown.config.ts` 就运行包内 tsdown，产物为 `dist/index.js`、`dist/client.js`、`dist/index.d.ts`；
4. `scripts/build-runtime.mjs` 除 `dist/` 外还会复制 `locale/`、`icon.svg` 等包根资源，桌面版不需要额外安装。

依赖仍按上游保留：`zod` 是运行时依赖，`@deepseek-ai/*` 与 React 走 Peer/官方模块表，不会把第二份 React 或官方客户端包打进 bundle。

## 示例 D：设置内联（停靠官方弹窗）

`inline-settings/` 演示**不替换官方组件、只调整官方 portal 的呈现**：

1. 官方设置只以 body portal 的模态框存在，`sidebar.settings` / `settings.section` 都没有「换成主区域内联页」的开关；
2. 插件在客户端注入一段样式，把 `[data-shortcut-modal="settings"]` 的父级 overlay 从全屏改为 `main` 列矩形，并隐藏遮罩；
3. 面板本体仍是官方组件：导航、分区、关闭按钮、Escape、焦点管理全部照旧；
4. 点击侧栏其他菜单时，先用官方关闭按钮收起设置，再让点击继续，所以不会出现「设置盖住新页面」。

```tsx
const OVERLAY = 'body > div[role="presentation"]:has(> [data-shortcut-modal="settings"])'

document.head.appendChild(Object.assign(document.createElement('style'), {
  id: 'dsh-inline-settings-style',
  textContent: `${OVERLAY} { inset: var(--dsh-settings-dock-top) ...; pointer-events: none }`,
}))
```

停靠矩形来自 `[data-slot="main"]` 的父元素，并用 `ResizeObserver` 跟随侧栏展开/收起与窗口缩放。所有选择器都是公开标记（`data-shortcut-modal`、`data-slot`、`role`），不使用官方 CSS Module 的哈希类名。

局限：官方仍把面板标记为 `role="dialog"` / `aria-modal="true"` 并保留焦点陷阱；视觉和鼠标操作已经内联，键盘焦点仍留在面板内。要连语义一起改，需要官方提供设置外壳插槽。

## 构建与运行

```bash
pnpm build          # 构建 packages/plugins/* 下的全部插件
pnpm build:one packages/plugins/starter   # 只构建一个
pnpm typecheck      # 逐个插件 tsc --noEmit
pnpm dev            # 构建 → 打包 → 注册进 Profile → 启动 dsh web
pnpm smoke          # 无头验收：客户端模块进入 boot 清单 + Host-only 插件已应用
```

`pnpm dev` 会对每个插件：

1. `pnpm pack` 出 tgz，按 **内容哈希** 放到 `.artifacts/<sha16>/`；
2. 只有 Profile 里记录的路径不一致时才执行 `dsh plugin add -w`（并先清掉旧的解包目录，避免同名同版本被旧内容命中）；
3. 全部注册完成后启动服务。

### Host-only 插件如何验收

没有 UI 就没有可见入口，所以 `host-only/` 在应用时打印一行标记：

```ts
process.stdout.write('[dsh-host-only-plugin] applied\n')
```

`pnpm smoke` 断言这行存在，同时断言 `starter` 的 `client.js` 出现在官方 boot 清单里——两种形态各有一条可自动化的证据。

## 命名与边界

- 包名建议 `dsh-<领域>-plugin`，目录名与领域一致（`starter/`、`projects/`、`office/`）；
- 插件之间**不互相 import**：要通过插槽元数据（`id` / `order` / `priority`）协作；
- 不修改、不拷贝官方包；需要官方没提供的能力时，先看官方 `SlotMap` 与服务接口；
- 删掉任意插件后，必须重新 `pnpm dev` 验证界面回到官方原样。
