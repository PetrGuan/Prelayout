# Prelayout × virtua 集成设计

- 日期: 2026-05-28
- 状态: Draft (待用户 review)
- 关联仓库: `Prelayout/`(改动方),`virtua/`(零改动,仅作 peer dependency)

## 1. 背景与目标

Prelayout 是一个基于 Pretext 的文本/组件高度预测库,目前已为以下虚拟列表方案提供集成入口:

- `@tanstack/react-virtual`
- `react-window`
- `@tanstack/vue-virtual`
- React Native `FlatList`

[virtua](https://github.com/inokawa/virtua) 是一个零配置虚拟列表库,横跨 React / Vue / Solid / Svelte 四个框架。它在生态里使用频率很高,但 Prelayout 还没有对应集成。

**目标:** 为 virtua 在四个框架中各提供一个 Prelayout hook,让用户能以预测高度填充 virtua 的初始 cache,实现首屏精确的虚拟列表(精准滚动条、精准 scroll-to-index、无需等待 ResizeObserver 测量回填)。

## 2. 关键技术约束

virtua 的 API 与 react-virtual / react-window **本质不同**:

| 维度 | react-virtual / react-window | virtua |
|---|---|---|
| 尺寸接入方式 | `estimateSize(index) => number` 回调 | 一次性的 `cache?: CacheSnapshot` prop |
| Cache 生命周期 | 每次渲染都重新询问 | 只在 mount 时读取一次 |
| DOM 测量 | 用户决定是否调用 `measureElement` | 内置 ResizeObserver,无法关闭 |

`CacheSnapshot` 公开类型是 opaque `interface { [cacheSymbol]: never }`,但内部就是元组:

```ts
// virtua/src/core/types.ts
export type InternalCacheSnapshot = [sizes: number[], defaultSize: number];
```

React / Vue / Solid / Svelte 四个框架的 `Virtualizer` / `VList` / `WindowVirtualizer` 都暴露 `cache?: CacheSnapshot` prop(已逐一确认源码)。VGrid **没有** cache prop,只有 `cellHeight` / `cellWidth` 数字 hint 和挂载后的 `handle.resizeRows()` / `resizeCols()` 命令式 API。

## 3. 范围

### In scope (本次)

- 新增 4 个 virtua 集成入口:
  - `prelayout/react-virtua`
  - `prelayout/vue-virtua`
  - `prelayout/solid-virtua`
  - `prelayout/svelte-virtua`
- 新增 1 个 Solid 核心 hook 入口:`prelayout/solid`(Prelayout 当前缺,virtua 集成需要它做基础)
- 每个集成入口覆盖 virtua 的 `VList` / `Virtualizer` / `WindowVirtualizer`(三者共享 `cache` prop,同一个 hook 通用)
- 支持两种使用模式:
  - **静态模式** — Prelayout 只提供 mount 时的精准 cache,之后 virtua ResizeObserver 兜底
  - **重置模式** — 宽度变化时通过 `key={widthKey}` 强制 virtua remount 以重新消费新 cache

### Out of scope (本次显式排除)

- ❌ **VGrid 支持** — 需要修改 virtua 上游(增加 `rowCache` / `colCache` props)+ 扩展 Prelayout 支持宽度预测和二维 schema。作为独立的 Future Work,需要单开一轮 brainstorm。
- ❌ **horizontal: true 的 virtua 列表** — Prelayout 只预测高度,横向滚动需要宽度预测能力(同 VGrid 问题)。文档明示不支持。
- ❌ **Patch / fork virtua** — 保持 virtua 仓零改动,只通过其公开 `cache` prop 集成。
- ❌ **自动恢复滚动位置** — reset 模式 remount 会丢失 scroll offset。提供文档模板代码,不内置 API。
- ❌ **Wrapper 组件**(类似 `<PrelayoutVList>`)— 偏离 Prelayout 现有 all-hook 风格,且 virtua 多组件下会重复实现。已在方案对比中排除。

## 4. 架构

### 文件结构(Prelayout/src/ 下新增)

```
solid.ts              — 新增:Solid 核心 hook(对标现有 svelte.ts)
react-virtua.ts       — 新增:Hook 返回 { cache, widthKey, heights, totalHeight }
vue-virtua.ts         — 新增:同上,Vue 版
solid-virtua.ts       — 新增:同上,Solid 版
svelte-virtua.ts      — 新增:同上,Svelte 版
internal/
  schema-key.ts       — 新增(可选):抽离现有 react.ts/vue.ts/svelte.ts 里重复的
                        JSON.stringify(schema) 稳定化逻辑。实施阶段可选做。
```

### package.json 改动

```jsonc
{
  "exports": {
    // ... 现有保留
    "./solid":         { "types": "./dist/solid.d.ts",         "import": "./dist/solid.js",         "default": "./dist/solid.js" },
    "./react-virtua":  { "types": "./dist/react-virtua.d.ts",  "import": "./dist/react-virtua.js",  "default": "./dist/react-virtua.js" },
    "./vue-virtua":    { "types": "./dist/vue-virtua.d.ts",    "import": "./dist/vue-virtua.js",    "default": "./dist/vue-virtua.js" },
    "./solid-virtua":  { "types": "./dist/solid-virtua.d.ts",  "import": "./dist/solid-virtua.js",  "default": "./dist/solid-virtua.js" },
    "./svelte-virtua": { "types": "./dist/svelte-virtua.d.ts", "import": "./dist/svelte-virtua.js", "default": "./dist/svelte-virtua.js" }
  },
  "peerDependencies": {
    "virtua":   ">=0.40.0",
    "solid-js": ">=1.8.0"
  },
  "peerDependenciesMeta": {
    "virtua":   { "optional": true },
    "solid-js": { "optional": true }
  }
}
```

`devDependencies` 同步加 `virtua` 和 `solid-js` 以便测试。

### 复用现有模块(零改动)

- `prepare.ts` / `layout.ts` / `schema.ts` — 核心计算
- `react.ts` / `vue.ts` / `svelte.ts` — 现有框架核心 hook(virtua hook 内部调用)

### 职责切分(每个 `*-virtua.ts` 都干同三件事)

1. 调用本框架核心 `usePrelayout` 拿到 `heights[]` 和 `totalHeight`
2. 把 `heights[]` 包成 virtua 期望的 `CacheSnapshot` 结构 `[sizes, defaultSize]`
3. 计算 `widthKey`(随 `containerWidth` / `items.length` / schema hash 变化)

## 5. Hook 接口

### 共同返回形态

```ts
type Result = {
  cache: CacheSnapshot   // 传给 <Virtualizer cache={cache}>
  widthKey: string       // reset 模式下放在 <Virtualizer key={widthKey} ...>
  heights: number[]      // 透出便于总高指示、SSR 调试等场景
  totalHeight: number
}
```

### React (`prelayout/react-virtua`)

```ts
export function usePrelayoutVirtuaCache(
  items: Record<string, unknown>[],
  schema: Schema,
  containerWidth: number,
): Result
```

内部复用 `usePrelayout(items, schema, containerWidth)`,通过 `useMemo` 把 `heights[]` 包成 cache 和 widthKey。

### Vue (`prelayout/vue-virtua`)

```ts
export function usePrelayoutVirtuaCache(
  items: Ref<Record<string, unknown>[]>,
  schema: Ref<Schema> | Schema,
  containerWidth: Ref<number>,
): {
  cache: ComputedRef<CacheSnapshot>
  widthKey: ComputedRef<string>
  heights: ComputedRef<number[]>
  totalHeight: ComputedRef<number>
}
```

签名严格对齐现有 `vue.ts` 的 `usePrelayout`(items / containerWidth 是 `Ref`,schema 可裸值或 Ref),依赖追踪交给 Vue 响应式。

### Solid (`prelayout/solid-virtua`,基于新增的 `prelayout/solid`)

```ts
export function createPrelayoutVirtuaCache(
  items: Accessor<Record<string, unknown>[]>,
  schema: Schema,
  containerWidth: Accessor<number>,
): {
  cache: Accessor<CacheSnapshot>
  widthKey: Accessor<string>
  heights: Accessor<number[]>
  totalHeight: Accessor<number>
}
```

`createMemo` 链路。先实现 `prelayout/solid` 核心 hook(对标 svelte 的工厂风格,但使用 Solid signals)。

### Svelte (`prelayout/svelte-virtua`)

```ts
export function createPrelayoutVirtuaCache(): {
  computeCache: (
    items: Record<string, unknown>[],
    schema: Schema,
    containerWidth: number,
  ) => Result
}
```

工厂函数,内部 cache 实例独立——对齐现有 `svelte.ts` 的 `createPrelayout()`,让多个列表互不污染。Svelte 5 runes 侧用 `$derived` 包裹调用。

### 使用示例(两种模式)

```tsx
// React 示例,Vue/Solid/Svelte 同理
const { cache, widthKey } = usePrelayoutVirtuaCache(items, schema, width)

// 静态模式 — 用户不传 key
<VList cache={cache}>{(item, i) => <Card item={item} />}</VList>

// 重置模式 — widthKey 作为 key 强制 remount
<VList key={widthKey} cache={cache}>{(item, i) => <Card item={item} />}</VList>
```

**两种模式的差异完全由用户怎么用 `widthKey` 决定**,hook 自身无 mode 参数。

## 6. 数据流与合成细节

### 流程

```
items + schema + containerWidth
        │
        ▼
usePrelayout (现有核心,增量 prepare + 全量 layout)
        │
        ▼
heights: number[]
        │
        ├──► buildCache(heights)            ──► cache: CacheSnapshot
        │
        └──► buildWidthKey(width, len, key) ──► widthKey: string
                                                       │
                                ┌──────────────────────┘
                                ▼
                <Virtualizer cache={cache} [key={widthKey}]>
                                │
                                ▼
                virtua createVirtualStore 解包 cache 为内部 _sizes[]
                                │
                                ▼
                ResizeObserver 在 item 渲染后 fire:
                  - 预测准确    → setItemSize 是 no-op
                  - ±1px 漂移   → 静默更新(自然纠偏)
                  - 严重错      → 跳动一次(说明 schema 写错)
```

### CacheSnapshot 构造

```ts
function buildCache(heights: number[]): CacheSnapshot {
  const defaultSize =
    heights.length > 0
      ? heights.reduce((a, b) => a + b, 0) / heights.length
      : 40
  return [heights.slice(), defaultSize] as unknown as CacheSnapshot
}
```

| 决定 | 理由 |
|---|---|
| `heights.slice()` 复制 | virtua 内部会 mutate `_sizes`,不复制会污染我们的缓存 |
| `defaultSize = mean(heights)` | 这个值只在 items 追加新项时用作 placeholder,mean 比 median 简单且足够 |
| 类型断言 `as unknown as CacheSnapshot` | virtua 设计为 opaque,但其内部就是数组元组(`cache.spec.ts` 也这么用)。pin 在 contract test 中以便上游升级时第一时间发现 |

### widthKey 哈希

```ts
function buildWidthKey(width: number, itemCount: number, schemaKey: string): string {
  return `${width}|${itemCount}|${schemaKey}`
}
```

| 字段 | 为什么纳入 |
|---|---|
| `width` | 我们想监听的触发器 |
| `itemCount` | items 长度变化让旧 cache `_sizes` 长度对不上,必须 remount |
| `schemaKey` | schema 改变(用户切换布局模板)旧高度全部失效 |

**不**包含 `items` 引用 —— 内容增删但长度不变的局部更新不该触发 remount,让 virtua 的 ResizeObserver 处理那一行的尺寸调整。

### Schema 稳定化复用

现有 `react.ts` / `vue.ts` / `svelte.ts` 各自有 `JSON.stringify(schema)` 缓存逻辑。新增 virtua hook 调用 `usePrelayout` 时已经做过一次稳定化,我们若再次 `JSON.stringify` 是浪费。

**最小改动:** 抽 `src/internal/schema-key.ts` 单一工具,核心 hook 和 virtua hook 共用。这是 "在我们要修改的代码周围做小范围 cleanup",符合 codebase 工作原则。如果实施阶段觉得风险大,可推迟到独立 PR。

### ResizeObserver 不抑制

**不会** 尝试关掉 virtua 的 ResizeObserver,理由:

1. 预测准时它是 no-op(virtua `setItemSize` 内部比较 `_sizes[index] === size`)
2. 预测错时它是兜底(schema 漏 padding、字体不准时 DOM 真测自然纠偏)
3. 关掉它得 fork virtua 或 hack DOM,代价远大于收益

这个权衡和 Prelayout 已有的 auto-calibrator / detectDrift / calibrate 态度一致——schema 是手写的,会漂,要有兜底。virtua 的 ResizeObserver 正好是免费的兜底。

## 7. 边界条件 & 错误处理

| 场景 | 行为 |
|---|---|
| `items = []` | `heights = []`,`defaultSize = 40`,传入合法的空 cache |
| Items 末尾追加(static 模式) | 旧 cache 长度对不上 → virtua `updateCacheLength` 用 `defaultSize` 填充 → ResizeObserver 测量真实尺寸。无需我们介入 |
| Items 删除(static 模式) | 同上,virtua 内部 `_sizes.splice` 处理 |
| Items 中间修改(同引用替换) | 长度不变 → widthKey 不变 → 不 remount。ResizeObserver 在该项重渲染时更新尺寸 |
| `containerWidth = 0` | layoutItem 仍返回有限数(高度可能很大),不抛错 |
| Schema 残缺 / 字段缺失 | 沿用 `prepareItem` / `layoutItem` 现有行为,virtua 层不额外校验 |
| SSR | virtua 的 cache prop 本就为 SSR/restore 设计,我们的合成 cache 走同一路径,天然兼容 |
| `horizontal: true` | **不支持**,文档明示 |

### 错误处理原则

- **不 try/catch `prepareItem` / `layoutItem`** —— 让异常带堆栈直冒,用户能精准定位 schema 问题
- **不校验 items shape** —— 沿用核心 hook 的现有契约
- **virtua 未安装时** import 失败 —— `peerDependenciesMeta` 标 `optional: true`,与现有 react-virtual / react-window 入口对齐
- **CacheSnapshot 类型断言失败时**(virtua 改了内部结构)—— pin 在 contract test 中,CI 立刻失败

## 8. 测试策略

### 8.1 Unit 测试(纯函数,bun test,对齐现有 Prelayout)

- `buildCache([10, 20, 30])` → `[[10, 20, 30], 20]`
- `buildCache([])` → `[[], 40]`
- `buildWidthKey(480, 100, 'abc')` 不同入参 → 不同输出;相同入参 → 相同输出
- `heights.slice()` 复制断言:外部 mutate cache 不影响后续 `buildCache` 返回值

### 8.2 Contract 测试(pin virtua 内部结构)

```ts
import { createVirtualStore } from 'virtua/unstable_core'

test('cache shape matches virtua expectations', () => {
  const cache = buildCache([10, 20, 30])
  const store = createVirtualStore(3, 40, 0, cache)
  expect(store.$getItemSize(0)).toBe(10)
  expect(store.$getItemSize(1)).toBe(20)
  expect(store.$getItemSize(2)).toBe(30)
})
```

`createVirtualStore` 不需要 DOM,bun test 即可。virtua 一旦改了 `InternalCacheSnapshot` 形状,这里立刻挂。

### 8.3 框架集成测试(每框架一份,DOM smoke test)

最小验证:挂载 `<Virtualizer cache={cache}>`,通过 ref 拿到 `handle.getItemSize(0)` 等于 Prelayout 预测的第 0 项高度。

- **React**:`@testing-library/react` + jsdom
- **Vue / Solid / Svelte**:各自惯用 testing-library + jsdom

### 8.4 Reset 模式测试

- 渲染 `<Virtualizer key={widthKey} cache={cache}>`
- 改 `containerWidth`
- 断言 `widthKey` 变化 → handle ref identity 变化 → 新 store 的 `getItemSize` 反映新预测

### 8.5 Static 模式测试

- 渲染 `<Virtualizer cache={cache}>`(不带 key)
- 改 `containerWidth`
- 断言 handle ref **不变**(同一 store);第 0 项 size 仍是初始预测,直到 ResizeObserver 介入

### 关于测试运行器

Prelayout 当前用 `bun test`。框架集成测试需要 jsdom——bun test 可注入 happy-dom/jsdom,优先沿用;退路是引入 vitest 只跑这部分。**spec 不强制**,实施阶段决定;核心要求是 "每框架都有一个 DOM smoke test"。

## 9. 文档增量(Prelayout/README.md)

新增 "virtua Integration" 一节:

- 四框架各一段示例(static + reset 两种模式)
- ResizeObserver 安全网说明
- Reset 模式下滚动位置恢复模板代码(片段,不内置 API)
- 不支持 horizontal / VGrid 的明示

## 10. 验收标准

实施完成的判定:

1. 四个 `*-virtua` 入口构建产物存在,types 正确
2. `prelayout/solid` 核心 hook 与现有 react/vue/svelte 行为对齐
3. Contract test 通过(我们和 virtua 的 cache 协议匹配)
4. 四个框架各有 DOM smoke test 通过
5. Reset / Static 两种模式行为符合 §8 描述
6. README 包含四框架示例
7. `peerDependenciesMeta` 把 `virtua` 和 `solid-js` 标为 optional,未安装它们的现有用户不受影响

## 11. Future Work

- **VGrid 集成** — 需要修改 virtua 上游 + Prelayout 增加宽度预测能力 + 二维 schema。单独 brainstorm + spec。
- **Horizontal virtua 列表** — 同 VGrid 块的宽度预测能力。
- **Solid 框架完整生态** — 本次只补了核心 + virtua。后续可考虑 `prelayout/solid-virtual`(@tanstack/solid-virtual)等其他 Solid 集成。
- **`schema-key.ts` 抽离** — 如果实施阶段没有顺手做,留作单独 cleanup PR。
- **Reset 模式滚动恢复 helper** — 如果文档模板不够好用,后续可内置 `useScrollRestore(widthKey, virtualizerRef)` helper。
