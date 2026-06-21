---
name: ue5-ui-reference
description: Planner 的视觉与交互风格**严格参考 Unreal Editor 5.8** 的权威规范：颜色调色板（取自 Slate Dark.json 主题）、字体、面板布局、控件外观（Details 数值/颜色/下拉/勾选/分类折叠）、视口、Outliner、选中与高亮、gizmo、右键菜单、快捷键交互。当用户提到 UI 外观、主题、颜色、字体、面板、控件、详情面板、大纲、视口、选中高亮、按钮样式，或要做任何 `src/styles`、`src/panels`、`src/scene` 的视觉/交互实现时都应触发。这是 UI 决策的最高准则，冲突时以此为准。
---

# UE5.8 编辑器 UI 参考规范（Planner 视觉/交互最高准则）

Planner 的所有界面**严格参考 Unreal Editor 5.8** 的暗色主题（5.8 引入了 "Visual UI Refresh"，统一为现代 UE 暗色风）。颜色取自 Slate 主题（`Engine/Content/Slate/Themes/Dark.json` + `EStyleColor`）。本文件是 UI 决策的**唯一权威**：当任何约定与之冲突，以本文件为准。

> 以下色值为 5.8 默认 Dark 主题的**目标值**（sRGB hex）。实现时写入 `src/styles/index.css` 的 `@theme`，组件只引用变量、不写死颜色。如需微调，改变量、留注释、记入 LOG。

## 1. 颜色调色板（核心）

| 用途 | CSS 变量 | hex | 说明 |
|------|----------|-----|------|
| 视口/最底层背景 | `--color-canvas-bg` | `#1a1a1a` | 3D 视口底色，全 UI 最深 |
| 主面板背景 | `--color-panel` | `#252525` | Details/Outliner/工具栏底 |
| 抬升面/卡片/悬停行 | `--color-panel-raised` | `#2d2d2d` | 次级面、悬浮、选中行底 |
| 分组标题栏底 | `--color-panel-header` | `#303030` | Details 分类条、面板标题条 |
| 边框/分隔线 | `--color-panel-border` | `#3a3a3a` | 细线、面板边界；低对比 |
| 凹槽/输入框底 | `--color-recessed` | `#1c1c1c` | 数值输入、下拉底（凹陷感） |
| 主文本 | `--color-text` | `#c0c0c0` | UE 文本偏冷灰，非纯白 |
| 次级文本 | `--color-text-dim` | `#8a8a8a` | 标签、次要说明 |
| 弱化文本 | `--color-text-faint` | `#5a5a5a` | 占位、禁用 |
| **强调/选中蓝（UE 蓝）** | `--color-accent` | `#0a8fef` | 选中边框、激活、链接；UE 标志色 |
| 强调悬停 | `--color-accent-hover` | `#3da4f5` | 悬停加亮 |
| 选中**填充** | `--color-select-fill` | `#0a8fef33` | 半透明蓝填充（选中行/物体） |
| 警告（橙） | `--color-warn` | `#e09f3e` | 非致命告警 |
| 危险/盲区（红） | `--color-danger` | `#c83838` | 盲区、删除、超阈值；偏暗红 |
| 成功/绿 | `--color-ok` | `#4cae50` | 达标、健康 |

### 1.1 覆盖热图色阶（蓝→绿→黄→红，UE 色阶习惯）
低覆盖 → 高覆盖：`--color-heat-0 #2670a8`(蓝) → `--color-heat-1 #36b37e`(青绿) → `--color-heat-2 #97c93c`(黄绿) → `--color-heat-3 #e0a538`(橙黄) → `--color-heat-4 #c83838`(红=高覆盖/或反向表示盲区)。
> 在统计条与热图 overlay 里标注色阶方向（**红=盲区**时单独说明，避免与"高覆盖"歧义）。

### 1.2 配色原则（来自 UE/Slate）
- **不用纯黑/纯白**：最深 `#1a1a1a`、文字 `#c0c0c0`，避免硬对比刺眼。
- **冷灰调**：所有中性色带极轻微蓝调（更"专业/冷峻"），但勿明显发蓝。
- **低对比分隔**：边框 `#3a3a3a` 与面板 `#252525` 差异小，靠**留白与抬升面**分层，而非粗线。
- **强调色克制**：只有"选中/激活/链接"用 UE 蓝；其余状态用灰阶。警告/危险/成功色仅用于状态，不做装饰。

## 2. 字体与排版

- **字体族**：`'Inter', 'Roboto', system-ui, sans-serif`（接近 Slate 用的 Roboto/Inter 无衬线）。
- **等宽**（数值/代码）：`'JetBrains Mono', 'Cascadia Code', ui-monospace, monospace`。
- **基准字号 12px**（UE 编辑器偏小、信息密集）；面板标题 11px 大写、字间距 `0.04em`；属性标签 11px；数值 12px 等宽。
- **行高紧凑**（约 1.3），控件高 22–24px，密度高、留白小。
- **数字右对齐**，标签左对齐。

## 3. 布局（四区 + 标签页）

严格复刻 UE 主编辑器骨架：

```
┌─────────────────────────────────────────────────────────────┐
│  顶栏 Menu/Toolbar (32px)：菜单 | 快捷工具 | 模式切换 | 状态 │  ← --color-panel, 下边框
├──────────┬────────────────────────────────┬─────────────────┤
│ 左面板    │                                │ 右面板           │
│ (可叠标签)│       3D 视口 (--color-canvas-bg)│ (Details 优先)   │
│ Places/  │   OrbitControls + Grid + Gizmo  │ Details(选中)    │
│ Outliner │   覆盖热图 overlay(可切)         │ + 次级面板叠标签 │
│ (240px)  │                                │ (300px)         │
├──────────┴────────────────────────────────┴─────────────────┤
│ 底栏 (24px)：坐标 | 覆盖/盲区/重叠/baseline/曝光 统计 | 单位   │  ← 状态/内容信息
└─────────────────────────────────────────────────────────────┘
```

- **面板可拖拽分隔条**（1px `--color-panel-border`，悬停 `--color-accent`），双击重置。
- **左侧叠标签**（Tabs）：Places(实体库) / Outliner(层级)。**右侧**：Details(属性) / 可能的次级。
- **标签页**：底色 `--color-panel`，激活标签底 `--color-canvas-bg` 带顶部 2px 蓝条；非激活悬停抬升。
- **视口为内容中心**，占最大面积；面板默认可折叠/浮动（v1 先固定，预留浮动接口）。
- 所有圆角 **2–3px**（UE 控件近乎直角，仅极小圆角）；阴影几乎不用，靠抬升面分层。

## 4. Details 面板（核心，重点复刻）

参考 UE Details Panel：选中实体的属性按**分类折叠组**呈现。

- **分类组**（如 Transform / Camera / Exposure / Lighting）：标题条底 `--color-panel-header`，左侧三角形展开图标，点击折叠/展开。激活/有改动的组标题文字可加亮。
- **属性行**：左标签（`--color-text-dim`，11px）、右控件；行高 22px；悬停行底 `--color-panel-raised`。
- **数值输入（重点）**：
  - 底 `--color-recessed`（凹陷感），边框 1px `--color-panel-border`，聚焦边框 `--color-accent`。
  - 文字等宽、右对齐。
  - **拖拽 scrub**：鼠标在数值上按下横向拖动改值（UE 经典交互）；Shift 加速 10×；Ctrl 减速 0.1×。拖动时光标变 `ew-resize`。
  - 双击进入精确编辑（全选文本）；回车确认、Esc 取消；失焦确认。
  - 支持单位后缀（° / m / px），灰色显示在值后。
- **向量三轴（X/Y/Z）**：三个并排数值框，**X=红/Y=绿/Z=蓝**前导色块（UE 的轴色：X `#c83838`、Y `#4cae50`、Z `#0a8fef`），点击色块可"归零/重置"。
- **颜色选择器**：色块按钮 → 弹出 UE 风颜色拾取器（HSV 色轮 + hex/RGB 输入 + 取色吸管占位 v2）；色块显示当前 hex。
- **下拉（Dropdown）**：底 `--color-recessed`，右侧下箭头；弹出菜单底 `--color-panel-raised`，悬停项 `--color-accent` 文字。
- **勾选（Checkbox）**：方框 12×12，勾选填 `--color-accent` 白勾；UE 用蓝勾。
- **滑块（Slider）**：凹槽 `--color-recessed`，已填部分 `--color-accent`，手柄圆点 `--color-text`。
- **只读/禁用**：文字 `--color-text-faint`，无交互。

## 5. Outliner（大纲）

- 树形层级，缩进 14px/级，展开三角图标。
- 每行：类型图标（相机📷/灯光💡/主体📦，用简洁线性图标）+ 名称（可双击重命名）+ 显隐眼睛 + 锁定。
- **选中行**：底 `--color-select-fill`（半透明蓝）+ 左 2px `--color-accent` 条。
- 多选：Ctrl 加选、Shift 连选；选中在 Details 聚合显示。
- 拖拽重排分组（v2）；右键菜单：Rename / Duplicate / Delete / Isolate。
- 顶部**过滤/搜索框**（`--color-recessed` 底，放大镜图标）。

## 6. 视口交互（参考 UE 视口）

- **导航**：右键拖转视角、中键平移、滚轮缩放（与 OrbitControls 一致；UE 是 LMB 转视角，但我们用 RMB 以保留 LMB 给选择——在 HANDBOOK 注明此差异）。
- **选择**：左键点选实体（raycast）；框选（空白处 LMB 拖拽画框，v2）。
- **gizmo**：选中挂 TransformControls，模式 W=平移/E=旋转/R=缩放；gizmo 轴色 X 红/Y 绿/Z 蓝（与向量色一致）。坐标空间切换（世界/局部）按钮在顶栏。
- **快捷视图**：1/2/3/4 切透视/顶/前/侧；F 聚焦选中；Home 视角复位。
- **视口左上角**：视图模式下拉（默认/带覆盖热图/线框/仅相机视锥）—— 复刻 UE 视口左上 Lit/Wireframe 下拉。
- **视口右上角**：gizmo 坐标轴指示器（小型 X/Y/Z 立体轴）。

## 7. 工具栏与菜单

- **顶栏快捷工具**：图标按钮（28×28，悬停 `--color-panel-raised`、激活 `--color-accent` 描边）；分组间 1px 竖分隔。
- **图标风格**：线性、16px、`--color-text-dim`，激活 `--color-accent`。
- **下拉菜单/右键菜单**：底 `--color-panel-raised`，1px `--color-panel-border`，圆角 2px；项高 22px，悬停 `--color-accent` 文字 + 半透明蓝底；分隔线 `--color-panel-border`。
- **按钮**（主按钮）：底 `--color-accent`、文字 `#fff`；次按钮：底 `--color-panel-raised`、边框 `--color-panel-border`、文字 `--color-text`。圆角 2px。

## 8. 状态与反馈

- **状态条（底栏）**：左=坐标/选中信息；中=覆盖/盲区/重叠/baseline/曝光（超阈值→对应状态色，如盲区占比高→ `--color-danger` 文字）；右=单位/版本。
- **超阈值告警**：对应数值变 `--color-warn`/`--color-danger`，可附小图标；不弹窗（信息密集工具不打断）。
- **加载/计算**：覆盖热图重算时，状态条显示"计算中…"（不阻塞，因 memoize 多数即时）。
- **Tooltips**：悬停 ~500ms 显示，底 `--color-panel-raised`、1px 边框、文字 11px。

## 9. 与现有约定的差异点（覆盖）

- 之前 `scene-edit-interactions` 提到 "类 Blender/Houdini/Unreal" —— 现精确为 **仅 UE5.8**。Blender/Houdini 提法作废。
- 之前 `src/styles/index.css` 的令牌值（偏 `#1e1f22` 等）需替换为本文件第 1 节的 UE 值。
- 视口导航用 **RMB 转视角**（UE 是 LMB；差异已注明，因我们 LMB 保留给选择）。
- 圆角统一 2–3px（之前可能更大）；阴影尽量不用。

## 10. 实现要点（给 coder）

1. **所有颜色来自 `src/styles/index.css` 的 `@theme` 变量**，组件只引用 `var(--color-*)`，不写死。
2. 新增控件（NumberInput/ColorSwatch/Dropdown/Checkbox/Tree/Tab）时，外观严格按第 4–7 节。
3. 数值 scrub 是 Details 的**关键交互**，必须实现（拖拽 + Shift/Ctrl 倍率 + 双击编辑 + Esc 取消）。
4. 向量三轴永远 X 红/Y 绿/Z 蓝，贯穿 gizmo、向量输入、坐标轴指示器。
5. 密度高、留白小、圆角小、分隔靠抬升面而非粗线 —— 这是 UE 的"专业感"来源。
6. 做完一个面板后**截图对比 UE5.8**（见 references 下的参考），不符则调变量/间距，不改约定。

## 参考（references/）

颜色与外观的权威来源（详见 `references/ue5-sources.md`）：
- UE 5.8 Release Notes（Visual UI Refresh）
- Slate 主题 `Engine/Content/Slate/Themes/Dark.json` 与 `EStyleColor`
- 官方 Unreal Editor Interface / Details Panel 文档
