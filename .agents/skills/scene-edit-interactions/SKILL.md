---
name: scene-edit-interactions
description: 3D 场景编辑器交互与专业 UI 实现指南（拖放实体、TransformControls gizmo、选择/多选、快捷键、撤销重做、属性面板 scrub 输入）。基于 R3F + drei + Zustand。当用户要在 3D 场景里拖放摄像机/灯光/物体、做 gizmo 操控、选中检视、实现撤销重做或专业工具风面板时触发。
---

# 场景编辑交互与专业 UI 指南（Planner）

本技能规定 Planner 3D 视口的交互行为。**视觉与控件外观的权威规范在 `.agents/skills/ue5-ui-reference/SKILL.md`（严格参考 Unreal Editor 5.8），本文件聚焦交互逻辑；二者冲突以 ue5-ui-reference 为准。** 技术栈 R3F + drei + Zustand + Tailwind。

## 拖放创建实体

- **来源**：左侧“资产/工具栏”面板的实体原型（Camera / Spot Light / Point Light / Directional / Area / Box Subject / Sphere Subject / Plane Ground / HDRI Env）。
- **落点**：拖到视口时，用 drei `<Html>` 的 raycast 或 `<Plane>` 地面做命中，落点取**地面交点**（y=0 之上）；按住 `Shift` 落到鼠标命中的物体表面。
- **实现**：用原生 HTML5 DnD（`dragstart` 写 dataTransfer，`drop` 读类型），drop 时 dispatch store action `addEntity(kind, transform)`；store 负责生成 id 与默认参数（来自 `lib/defaults`）。
- **拖动中预览**：可选——拖动经过视口时显示半透明幽灵实体（v1 可省，优先做落点正确）。

## 选择与 gizmo

- **点选**：R3F `onClick`（经 raycast）命中实体 → `store.select(id)`。`Ctrl/Shift+Click` 多选。
- **框选**：拖动空白处画矩形，结合相机射线筛选视锥内实体（v2；v1 先做点选）。
- **gizmo**：选中单个实体时挂 `drei <TransformControls mode={translate|rotate|scale} >`，mode 按 `W/E/R` 切换。gizmo 的 `objectChange` → 实时更新 store 的 `transform`。
- **坐标系**：默认世界坐标；旋转用度显示，内部弧度。
- **视觉反馈**：选中实体加描边（drei `<Outlines>`）+ 视锥/光照范围可视化着色加亮。

## 摄像机/灯光可视化（专业工具核心）

- **摄像机**：始终显示视锥线框（近远平面 + 四条侧棱 + 朝向）。选中时加厚 + 显示分辨率框。提供“从该相机看”按钮（临时切换主相机到该相机视角）。
- **聚光灯/方向光**：显示目标线 + 锥体/方向箭头 + 衰减范围。点光源显示半径球。
- **覆盖热图**：作为可切换 overlay，把 `sim/coverage` 结果映射到主体表面颜色（蓝→红表示低→高覆盖）。盲区纯红闪烁。
- **网格与捕捉**：视口地面网格（drei `<Grid>`），可选捕捉（snap to grid / snap to surface）。

## 属性面板（Inspector）

- 选中实体 → 右侧面板显示其参数，分组：Transform / 光学(fov,resolution,exposure) 或 光学(color,intensity,...) / 元数据。
- **数值输入三态**：① 精确键入 ② 鼠标在数字上横向拖动 scrub（drei `<NumberInput>` 或自封装 `scrub`：pointerdown 记起点，move 按 dx 改值，按 Shift 加速 10×）③ 滑块。三者绑定同一 store 字段。
- 旋转用度；位置/缩放用米。
- 改动即提交 store；撤销栈记录每笔提交（节流连续拖动成单条历史）。

## 撤销 / 重做

- store 维护 `past[]` / `future[]` 快照（仅对可序列化的 `SceneDef` 做）。
- 快捷键：`Ctrl+Z` 撤销，`Ctrl+Shift+Z` 或 `Ctrl+Y` 重做。
- 拖动 gizmo / scrub 连续变化用**节流**（如每 250ms 或结束时）入栈，避免历史爆炸。
- 每个改动 action 包成命令对象 `{ type, payload, inverse }` 也可（v1 用快照即可）。

## 快捷键（默认，可配）

| 键 | 行为 |
|----|------|
| W / E / R | 平移 / 旋转 / 缩放 gizmo |
| G | 切换网格捕捉 |
| F | 视口聚焦选中实体 |
| Delete | 删除选中 |
| Ctrl+D | 复制选中 |
| Ctrl+Z / Ctrl+Y | 撤销/重做 |
| 1/2/3/4 | 切换视图：透视/顶/前/侧 |
| Space | 切换覆盖热图 overlay |

## 性能与体验

- 视口导航：**右键拖转视角、中键平移、滚轮缩放**（注意：UE 用左键转视角，我们改用右键以把左键留给选择——HANDBOOK 与视口提示需写明此差异）。
- 多相机视锥合并线框降低 draw call。
- 热图重算缓存，依赖 `SceneDef` 哈希。
- 控件外观（颜色/字体/圆角/密度）一律来自 `src/styles` 的 `@theme` 变量，严格 UE5.8 风（见 ue5-ui-reference）。

## 当本技能触发时你应该做的事

1. 新增实体类型时，同时补齐：工具栏原型、`addEntity` action、视口可视化、Inspector 参数组。
2. 交互改动一律经 store，不在组件内直接改 Three 对象。
3. 撤销重做覆盖所有结构性与变换改动。
4. 数值输入至少支持键入 + scrub 两种。
5. 角度用度显示，内部弧度，换算集中在 `lib/math`。
