# Planner — 架构与数据流（docs/architecture.md）

> 配合 `.agents/skills/planner-conventions/SKILL.md` 阅读。本文件讲“为什么这么分”与数据怎么流。

## 分层总览

```
┌───────────────────────────── UI 层（React + Tailwind）─────────────────────────────┐
│  panels/        Outline │ Toolbar │ Inspector │ StatsBar │ ExportDialog             │
│  app/           Layout（四区可拖分隔）│ App │ main.tsx                              │
└────────            │                       │  订阅              │           ────────┘
                    │                       ▼                    │
┌──────────────── Zustand store（state/，单一数据源）─────────────────────────────────┐
│  slices: entities(CameraDef/LightDef/SubjectDef/EnvDef) │ selection │ history │ view │
│  actions: addEntity/select/updateTransform/undo/redo/setView ...                    │
└────────            │                       │  派生(订阅 entities)  │           ────────┘
        ┌────────────┘                       └────────────┐
        ▼ (SceneDef 纯数据)                              ▼ (SceneDef 纯数据)
┌──── scene/（R3F，副作用） ────┐         ┌──── sim/ + export/（纯 TS，可单测）────┐
│ Viewport/objects/overlays/    │         │ coverage/overlap/exposure/frustum/     │
│ Gizmo/Selection               │         │ capture + transforms/colmap/serialize  │
│ 读 SceneDef → 渲染 Three 对象 │         │ 读 SceneDef → 算指标 / 产出文件         │
└───────────────────────────────┘         └─────────────────────────────────────────┘
        ▲                                       ▲
        └───────────── lib/（math/id/defaults/memo/aabb）──────────┘
                          types/（CameraDef...契约）
```

## 为什么这样分（设计原则）

1. **仿真/导出纯化**：`sim/`、`export/` 不依赖 React/Three。好处：① 可在 Node/单测里跑，不启浏览器；② 未来能直接接到 CLI 或后端批量评估；③ R3F 重渲染不会让计算乱跑。
2. **Three 对象只在 `scene/`**：3D 对象有生命周期/副作用，集中管理；store 只存**数据**（`CameraDef`），不存 Three 实例。视图层把数据→Three 对象做映射。
3. **单一 store**：避免多 store 同步地狱；用切片组合。undo/redo 对可序列化的 `SceneDef` 做快照。
4. **类型即契约**：`types/` 是各层公共语言，跨层只传这些类型。

## 关键数据流（举一例：拖放加相机）

```
Toolbar 拖原型 → drop 到 Viewport
  → raycast 得地面交点
  → store.addEntity('camera', { position: 交点 })
     → 生成 CameraDef（lib/defaults 给默认 fov/exposure...）
     → push history 快照
  → entities 变更
     ├→ scene/objects/CameraRig 重渲染（视锥线框出现）
     ├→ sim/coverage 依赖 SceneDef 哈希变化 → 重算（memo）
     └→ panels/StatsBar 订阅派生指标 → 更新数字
```

## undo/redo 策略

- 对 `SceneDef`（entities + env）整体快照入 `past[]`。
- gizmo 拖动 / scrub 是高频连续变化：**节流**（如 250ms 或 pointerup）入栈，避免历史爆炸与内存涨。
- `view`（相机视角、overlay 开关）不入历史（非用户内容）。

## 覆盖热图管线

```
SceneDef ──hash──> memo 命中?
                   是 → 返回缓存指标
                   否 → sim/coverage:
                          主体 AABB → 表面采样 N 点（lib/memo 缓存采样）
                          逐相机 frustum 判定 → 计数
                          → 盲区/最小/平均覆盖
                          → overlap（相邻对）、baseline、exposure
                        → 缓存
scene/overlays/CoverageHeatmap 把计数映射颜色 → 主体表面顶点色/纹理
panels/StatsBar 显示数值 + 阈值告警
```

## 导出管线

```
SceneDef ──> export/transforms.ts  → transforms.json（camera_to_world 4x4 + 内参）
          ├> export/colmap.ts      → cameras.txt / images.txt（世界→相机取逆）/ points3D.txt（空）
          ├> sim/capture.ts        → 拍摄清单 CSV/JSON（位姿+曝光+触发时刻）
          └> io/serialize.ts       → .planner.json（含版本号）
每个导出器自带 schema 校验 + round-trip 单测（见 PLAN.md M5）。
```

## 模块依赖矩阵（简化）

| 模块 | 依赖 |
|------|------|
| types | — |
| lib | types |
| sim | types, lib |
| export | types, lib, sim(部分) |
| io | types, lib |
| state | types, lib |
| scene | types, lib, state, sim(读指标) |
| panels | types, state, sim(读指标), export(调用) |
| app | 全部（装配） |

**禁止反向依赖**（如 sim → scene）。lint 可加 `no-restricted-imports` 强制。
