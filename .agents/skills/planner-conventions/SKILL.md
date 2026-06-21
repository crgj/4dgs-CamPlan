---
name: planner-conventions
description: 编码约定与架构规范，用于 4DGS 拍摄规划仿真系统（Three.js + React Three Fiber + Zustand + Tailwind）。在任何编码、重构、新增文件或修改本仓库代码之前必须遵循。当用户提到 Planner、4DGS 仿真、拍摄规划、相机阵列、覆盖度热图、transforms.json 等关键词，或要在本仓库写代码时都应触发。
---

# Planner 项目编码约定

本仓库是 **4DGS 拍摄规划仿真系统**（代号 Planner）。技术栈：**Three.js + React Three Fiber (R3F) + @react-three/drei + Zustand + Tailwind CSS + Vite + TypeScript**。在写任何代码前先读完本文件。

## 架构分层（严格遵守）

```
src/
├── app/                 # 应用入口、顶层布局、路由面板
├── state/               # Zustand store（单一数据源，见下）
│   └── store.ts         # 唯一 store；切片组合
├── scene/               # R3F 3D 场景：相机/灯光/物体/环境/视锥/热图
│   ├── objects/         # <CameraRig/> <LightFixture/> <SubjectMesh/> ...
│   ├── overlays/        # frustum 可视化、覆盖热图、盲区
│   └── Scene.tsx        # <Canvas> 内部装配
├── panels/              # 专业 UI 面板（属性/大纲/覆盖度统计/导出）
├── sim/                 # 仿真核心：纯 TS，无 React 依赖（可单测）
│   ├── coverage.ts      # 视锥栅格化、覆盖计数
│   ├── overlap.ts       # 重叠率、盲区
│   ├── exposure.ts      # 灯光-曝光表
│   └── capture.ts       # 拍摄清单生成
├── export/              # transforms.json / COLMAP 导出（纯 TS）
├── io/                  # 拖放、文件读写、序列化
├── lib/                 # 通用工具（math、id、单位换算）
└── types/               # 全局 TS 类型（CameraDef/LightDef/SceneDef...）
```

**铁律：**
- **`sim/` 和 `export/` 不得 import 任何 React/R3F/Three 对象。** 它们只吃纯数据结构（`CameraDef` 等），返回纯结果。这是为了让仿真与导出可被单测与 Node 脚本复用。
- **Three.js 对象只存在于 `scene/` 内**。`sim/` 若需要几何运算（投影、射线），用 `lib/math.ts` 里基于纯矩阵的封装，不直接用 `THREE.PerspectiveCamera`。
- **状态只能从 Zustand store 读写**。组件间不传 props 共享业务状态；面板和 3D 对象都订阅 store。
- **副作用（拖放落点→创建实体）走 store action**，不在组件里直接改 Three 场景图。

## 类型即契约

所有实体的形状定义在 `src/types/`。跨层传递只能用这些类型，不要用 `any`。关键类型：

```ts
type CameraDef   = { id; transform: Transform; fov; aspect; near; far; resolution; exposure; ... }
type LightDef    = { id; kind: 'point'|'spot'|'directional'|'area'; transform; color; intensity; ... }
type SubjectDef  = { id; transform; geometry; bounds: AABB }      // 被拍摄主体
type EnvDef      = { hdri?; ground; fog?; }                       // 环境
type SceneDef    = { cameras: CameraDef[]; lights: LightDef[]; subjects: SubjectDef[]; env: EnvDef }
```

`Transform = { position:[x,y,z]; rotation:[x,y,z] (deg); }` —— **角度统一用度，存库/导出前在 `lib/math` 转**，不要在散落处手动 `*Math.PI/180`。

## 命名与风格

- 组件用 PascalCase（`CameraRig`），函数/变量 camelCase，常量 UPPER_SNAKE，类型 PascalCase。
- 文件名与导出默认符号一致；一个文件一个主组件/主函数。
- 实体 id 用 `lib/id.ts` 的 `uid('cam')` 生成前缀式 id（`cam_3f2a`），不要用数组下标当 key。
- 单位：**米**。视场角单位：**度**。颜色：线性 `0..1` 或 hex 整数，存库统一 hex 整数。

## 专业 UI 约定

- **视觉/交互严格参考 Unreal Editor 5.8**（权威规范见 `.agents/skills/ue5-ui-reference/SKILL.md`，冲突时以它为准）。
- 配色、间距、字号、字体集中在 `src/styles/index.css` 的 `@theme` + CSS 变量（UE5.8 色板，不写死颜色）。
- 布局：顶栏 Toolbar / 左面板(Outliner·Places 叠标签) / 中 3D 视口 / 右 Details / 底状态条；可拖拽分隔条。
- 圆角 2–3px、阴影几乎不用、靠抬升面分层、密度高留白小（UE 专业感来源）。
- 所有数值输入支持拖拽 scrub（Shift 加速/Ctrl 减速）、双击精确编辑、Esc 取消；旋转用度；向量三轴 X 红/Y 绿/Z 蓝。
- 选中实体高亮（半透明蓝填充 + 左侧蓝条）+ gizmo（drei `<TransformControls>`，轴色 X 红/Y 绿/Z 蓝），Delete 删除，Ctrl+D 复制，Ctrl+Z/Y 撤销重做（状态走 store 快照栈）。

## 性能

- 热图/覆盖计算结果缓存：依赖 `SceneDef` 的哈希，未变化不重算（`lib/memo.ts`）。
- 视锥可视化用 `THREE.Frustum` + 线框，多相机时合并 geometry（`BufferGeometryUtils.mergeBufferGeometries`）。
- 重型列表（大纲、统计）虚拟化（`@tanstack/react-virtual`）。

## 测试与质量

- `sim/` 与 `export/` 的纯函数必须有 Vitest 单测（覆盖计算、重叠、导出格式校验）。
- 导出格式加**自校验**：导出后用 schema 校验并通过 round-trip（导出→重新导入→结构相等）测试。
- 提交前 `npm run typecheck && npm run test && npm run lint` 必须全绿。

## 当本技能触发时你应该做的事

1. 若要改 `sim/` 或 `export/`：先确认改动不引入 React/Three 依赖。
2. 新增实体类型：先在 `src/types/` 加类型，再在 store 加切片，最后在 `scene/` 加可视化与 `panels/` 加检视器。
3. 涉及坐标/角度：一律走 `lib/math`，集中换算。
4. 写代码前若不确定约定，读本文件相应小节，不要凭记忆。
5. 遵循 `.coder-protocol.md` 与 `HANDBOOK.md` 中的多 coder 协作与日志规则。
