# packages/plugins

所有 WorkDSH 风格的 DSH 插件都放在这里，一个目录一个包。构建、打包、注册、启动全部由根目录脚本自动发现，**不需要在根 `package.json` 里逐个登记**。

```
packages/plugins/
├── README.md          ← 本文件
├── starter/           ← 示例 A：Host 服务 + 两个 UI 插槽（Host + Client 双面）
│   ├── package.json   ← 双面 exports + dsh.bundle.patch + dsh.client
│   ├── cordis.patch.yml
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts   ← Host 入口（Node）
│       └── client.tsx ← 浏览器入口（插槽注册）
├── expert-team/       ← 示例 B：输入框左侧「专家团」，点击弹浮层，召唤后跳转 Starter 面板
│   ├── package.json
│   ├── cordis.patch.yml
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts   ← 只为了让包成为 loader entry（见下文）
│       └── client.tsx ← conversation.input.left + 浮层 + layout.selectPanel
└── host-only/         ← 示例 C：只有 Host 面，没有任何 UI
    ├── package.json   ← 只有 "." exports 和 dsh.bundle.patch，没有 dsh.client
    ├── cordis.patch.yml
    ├── tsconfig.json
    └── src/
        └── index.ts   ← 提供服务 + 生命周期，无浏览器入口
```

## 两种插件形态

| 形态 | 需要哪些源文件 | `exports` | `dsh` 字段 | 典型用途 |
|---|---|---|---|---|
| **Host + Client** | `src/index.ts` + `src/client.tsx` | `.` + `./client` | `bundle.patch` + `client` | 有界面的业务功能（`starter/`、`expert-team/`） |
| **仅 Host** | `src/index.ts` | 只有 `.` | 只有 `bundle.patch` | 服务、工具、存储、会话中间件（`host-only/`） |

**没有「仅 Client」这种形态。** 官方 client-modules 是**扫描 Host loader entries** 来找 `dsh.client` 声明的——没有 loader 行（也就没有 Host 入口）就没有浏览器模块。所以哪怕是纯 UI 插件，也保留一个最小 `src/index.ts` + `cordis.patch.yml`（`expert-team/` 就是这么做的）。

构建脚本按**源文件是否存在**决定产出哪些面：

- 有 `src/index.ts` → 产出 Host ESM；
- 有 `src/client.tsx` → 产出 `__ModuleLoader__` 客户端模块；
- 构建前会清理这两个旧产物，删掉某个面后不会残留。

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
