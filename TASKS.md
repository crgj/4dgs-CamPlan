# Planner — 任务看板（TASKS.md）

> 任务状态机：`Backlog → Doing → Done`（遇阻标 `Blocked` + `wait-for`）。
> 领取：建分支 `T-NNN/<slug>`，在 LOG 追加 `START`，把状态改 Doing 并填 `负责`。
> 完成：跑验收三连（typecheck/test/lint），LOG 追加 `DONE`，状态改 Done，填 `commit`。
> 任务依赖图见各任务 `依赖` 字段。详细验收见 `PLAN.md` 对应里程碑。

---

## 🟢 Backlog（未领取）

### T-001 项目脚手架与工具链
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ `npm run dev` 起空 R3F 画布(Vite v8, 210ms, HTTP 200)；✅ `typecheck` 干净；✅ `test` 2 passed；✅ `lint` 干净；✅ TS strict；✅ Tailwind v4 深色主题令牌就位。
- 依赖: —
- 产物: `package.json`, `package-lock.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.{json,app.json,node.json}`, `eslint.config.mjs`, `.prettierrc.json`, `index.html`, `src/main.tsx`, `src/app/{App,App.test}.tsx`, `src/scene/Scene.tsx`, `src/styles/index.css`, `src/vite-env.d.ts`
- commit: (待提交；本地 working tree)
- 备注: 修复项——补装 `@eslint/js@10.0.1`(原 lockfile 缺失)、移除 TS6.0 已弃用的 `baseUrl`(paths 仍生效)、node 配置加 `types:["node"]`、加 `vite-env.d.ts` 解 css 副作用导入、App.test mock Scene 以绕开 jsdom 无 WebGL。Tailwind v4 用 `@theme` 不需 `tailwind.config.ts`。

### T-002 核心类型定义（src/types/）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 定义 `Transform/CameraDef/LightDef/SubjectDef/EnvDef/SceneDef` + `EvalThresholds` + sim 输出契约(`CoverageStats/OverlapStats/ExposureStats/CaptureList`)；CameraDef/SubjectDef/LightDef 含可选 `time`(4DGS 预留)；barrel `index.ts`；typecheck 通过 + 类型契约测试 `types.test-d.ts`(纯类型断言锁定字段形状)。
- 依赖: —
- 产物: `src/types/{common,entities,eval,index,types.test-d}.ts`
- commit: 待提交
- 备注: 高风险共享区；后续改动优先追加可选字段。EnvDef 是单数(一个场景一套环境)。颜色=hex整数，角度=度，单位=米。

### T-003 Zustand store 与切片
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 单一 store 含 `entities/selection/undo-redo/view` 切片；`addEntity/select/updateTransform/undo/redo` action 可用；快照式 undo 栈（拖动节流入栈）。
- 依赖: T-002
- 产物: `src/state/store.ts`, `src/state/history.ts`, `src/state/store.test.ts`
- commit: 97f0ce3e

### T-004 lib 工具：math/id/defaults/memo/aabb
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ `deg2rad/rad2deg/deg3ToRad3/wrapDeg*`、颜色 hex↔rgb、矩阵 compose/multiply/invert/transformPoint(列主序)、`uid(prefix)` 带冲突重试、各实体默认工厂 + 阈值默认、`memoize`(Map+LRU)、`aabb`(half-extents/transformAABB/union/point-in)；各有单测；角度换算**只在 lib/math**(aabb 内联旋转以避免循环 import，已注释)；test 48 passed。
- 依赖: —
- 产物: `src/lib/{math,id,memo,aabb,defaults}.ts` + 各 `.test.ts`
- commit: 待提交
- 备注: memoize 升级为 Map+LRU(完整缓存，非单槽)；defaults 用计数器生成递增名，测试前需 resetDefaultCounters。

### T-005 视锥数学与 AABB（纯函数，sim/）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ `perspectiveFovY/verticalFovFromHorizontal/viewMatrix/viewProjection/toClip/pointInFrustumClip/pointVisibleToCamera`；纯矩阵无 THREE 依赖；单测 15 例(≥10)覆盖透视/视场/视图逆/前后/近远裁剪/FOV边界/旋转。AABB 在 lib/aabb(T-004 已做)。
- 依赖: T-002, T-004
- 产物: `src/sim/frustum.ts`, `src/sim/frustum.test.ts`
- commit: 待提交
- 备注: 6 平面表示刻意推迟到 v2(裁剪空间法已充分正确，避免维护第二套易错实现)。NDC z∈[0,1] OpenGL 约定。

### T-006 覆盖度计算（sim/coverage.ts）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 主体 AABB 体积栅格采样 → 逐相机视锥判定 → 覆盖计数；输出 CoverageStats(samples/min/max/avg/blind/underCovered/perCamera)；遮挡用 AABB 近似(排除自身)；memoize 缓存；单测 10 例(无相机全盲/单相机正对/背离/多相机覆盖↑/禁用不计/遮挡/缓存)。
- 依赖: T-005
- 产物: `src/sim/coverage.ts`, `src/sim/coverage.test.ts`
- commit: 待提交
- 备注: 遮挡为 AABB 近似(v2 改光线投射+BVH)；体积采样对视点重叠不敏感(见 overlap 备注)。

### T-007 重叠率与 baseline（sim/overlap.ts）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 复用 coverage 采样构造每相机可见集 → Jaccard 两两重叠矩阵(C(n,2)对) + baseline(世界距离)；输出 OverlapStats(avg/min/max baseline, avgOverlap, belowThresholdPairs)；单测 7 例(baseline=距离/无相机归零/相邻>0/边界/阈值计数/sharedVisibleCount/缓存)。
- 依赖: T-005
- 产物: `src/sim/overlap.ts`, `src/sim/overlap.test.ts`
- commit: 待提交
- 备注: 重叠用 Jaccard(交集/并集)；体积采样下对视点差异不敏感，区分需表面采样(v2)。

### T-008 曝光一致性（sim/exposure.ts）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 每相机 EV=log2(N²/t)−log2(ISO/100)；输出 ExposureStats(perCamera EV/spread/stddev/exceedsThreshold)；memoize；单测 8 例(EV 基准/光圈/ISO/非法参数/同阵列 spread=0/差异超阈值/禁用/缓存)。
- 依赖: T-002
- 产物: `src/sim/exposure.ts`, `src/sim/exposure.test.ts`
- commit: 待提交
- 备注: 仅评估相机曝光参数一致性；灯光-曝光联合评估列 v2。

### T-009 3D 视口基础（相机控制/网格/坐标）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: OrbitControls、地面 Grid、坐标轴 gizmo、4 视图切换(透视/顶/前/侧)；空场景可交互旋转。
- 依赖: T-001
- 产物: `src/scene/Scene.tsx`, `src/scene/lib/frustumCorners.ts`
- commit: 97f0ce3e

### T-010 实体可视化（相机/灯光/主体/环境）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 各实体类型有 R3F 组件；相机显示视锥线框；灯光显示范围/锥体；HDRI 环境加载；选中描边。
- 依赖: T-003, T-009
- 产物: `src/scene/objects/CameraRig.tsx`, `src/scene/objects/LightFixture.tsx`, `src/scene/objects/SubjectMesh.tsx`, `src/scene/objects/Environment.tsx`
- commit: 97f0ce3e

### T-011 拖放创建实体
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 工具栏原型可拖到视口落地建实体（地面命中；Shift 落表面）；store 同步。
- 依赖: T-003, T-010
- 产物: `src/io/dropTarget.tsx`, `src/panels/Toolbar.tsx`
- commit: 97f0ce3e

### T-012 选择与 TransformControls gizmo
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 点选/多选(Ctrl/Shift)；单选挂 gizmo，W/E/R 切模式；gizmo 改动实时回写 store；Delete/Ctrl+D。
- 依赖: T-003, T-010
- 产物: `src/scene/Gizmo.tsx`
- commit: 97f0ce3e

### T-013 撤销/重做接入交互
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: Ctrl+Z/Y 全链路工作；gizmo/scrub 连续拖动节流入栈。
- 依赖: T-003, T-012
- 产物: `src/state/history.ts`, `src/state/store.ts`
- commit: 97f0ce3e

### T-014 属性面板 Inspector
- 状态: Done
- 负责: antigravity/crgj
- 验收: ✅ 选中实体显示 Transform、Camera Settings、Exposure、Metadata 分组，空状态下显示环境配置；✅ 位置/旋转等数值支持左右拖拽 Scrub 实时微调与双击输入确认；✅ 欧拉角以度数表示并支持一键撤销重做；✅ TS 完全去 any 类型窄化改造。
- 依赖: T-003, T-012
- 产物: `src/panels/Inspector.tsx`, `src/ui/NumberInput.tsx`
- commit: pending

### T-015 大纲面板 Outline
- 状态: Done
- 负责: antigravity/crgj
- 验收: ✅ 列出当前场景所有 Camera/Light/Subject 实体；✅ 点击选中，高亮带有 UE 风格的左侧蓝条饰边；✅ 双击文字行内重命名（支持回车保存与 Esc 取消）；✅ 点击眼睛一键显隐（对应 enabled 状态，禁用时大纲变半透明）；✅ 顶部 Search 搜索框实时模糊过滤；✅ 无 unused params。
- 依赖: T-003
- 产物: `src/panels/Outline.tsx`
- commit: pending

### T-016 覆盖热图 overlay 与统计条
- 状态: Done
- 负责: antigravity/crgj
- 验收: ✅ Space 键在 3D 视口一键显隐覆盖点云热图（盲区为暗灰色低对比度，覆盖度根据相机覆盖数映射到 5 级色阶）；✅ 材质开启 `depthWrite=false` 防深度闪烁；✅ 实时仿真 StatsBar 统计栏（显示 Average Coverage、Blind Ratio、Jaccard Overlap、Bad Pairs、Exposure Spread）；✅ 对接 defaults.ts 默认评估阈值进行三色状态圆点（绿色 ok、橙色 warn、红色 danger）高亮指标警报；✅ 覆盖率采样 grid 降低为 16 彻底优化主线程计算负载与交互性能；✅ 修复 `flatten` 函数中使用参数展开导致 Maximum call stack size exceeded 的 RangeError 溢出隐患。
- 依赖: T-006, T-007, T-008, T-010
- 产物: `src/scene/overlays/CoverageHeatmap.tsx`, `src/panels/StatsBar.tsx`
- commit: pending

### T-017 transforms.json 导出 + 自校验
- 状态: Done
- 负责: antigravity/crgj
- 验收: ✅ 导出 Nerfstudio 兼容的 transforms.json；✅ 支持混合/统一相机内参（fl_x/fl_y/cx/cy/w/h/near/far）；✅ 自定义字段支持 100% 无损 round-trip 反向解析还原；✅ 列/行主序转换有详细注释；✅ schema 格式与 4DGS time 字段自校验单测 100% 通过。
- 依赖: T-005, T-002
- 产物: `src/export/transforms.ts`, `src/export/schema.ts`, `src/export/transforms.test.ts`
- commit: pending

### T-018 COLMAP 导出 + 自校验
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 导出 cameras.txt(PINHOLE)/images.txt(四元数 w,x,y,z + 世界→相机平移)/points3D.txt(空占位)；✅ 世界→相机变换取逆；✅ 四元数数值归一化；✅ round-trip 单测（导出→importFromColmap 还原位置/内参，容差）。6 例单测。
- 依赖: T-005, T-002
- 产物: `src/export/colmap.ts`, `src/export/colmap.test.ts`
- commit: 619fd43b

### T-019 拍摄清单生成（capture.ts）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 输出每相机期望位姿(worldToCamera 4×4 列主序)/内参/曝光/触发时刻(4DGS 预留 time)；✅ 仅启用相机，按 time 升序；✅ 导出 CSV/JSON 双格式；✅ 单测 6 例（启用过滤/time 排序/w2c 长度/CSV 表头/JSON 解析回放）。
- 依赖: T-017
- 产物: `src/sim/capture.ts`, `src/sim/capture.test.ts`
- commit: 619fd43b

### T-020 场景序列化（保存/加载 .planner.json）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ PlannerFile 包裹层(kind/version/savedAt/scene) + 版本迁移；✅ serialize/deserialize 整场景(相机/灯光/主体/环境/4DGS time/bounds)无损 round-trip；✅ validateScene 结构校验 + 错误输入处理(非法 JSON/缺标识/缺 version/版本过高)；✅ downloadPlannerFile 浏览器下载；✅ 单测 12 例。
- 依赖: T-002
- 产物: `src/io/serialize.ts`, `src/io/serialize.test.ts`
- commit: 619fd43b

### T-021 专业 UI 打磨与布局
- 状态: Done
- 负责: antigravity/crgj
- 验收: ✅ 重构 App 顶层容器，支持 MenuBar 下拉菜单、中英文一键切换；✅ 开发 PanelWrapper 包装，提供 Dock Left / Dock Right / Float 状态切换，Float 悬浮模式的拖动定位与边缘把手的拉伸缩放、Header 折叠隐藏功能；✅ 完美适配 UE5.8 暗色色板。
- 依赖: T-014, T-015, T-016
- 产物: `src/panels/MenuBar.tsx`, `src/panels/PanelWrapper.tsx`, `src/app/App.tsx`, `src/styles/index.css`
- commit: pending

### T-022 端到端冒烟与示例场景
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 内置示例（环形相机阵列 8 cam + 2 light + 2 subj）；✅ 全流程跑通：序列化→transforms.json/COLMAP/capture 导出→覆盖度仿真；✅ 纯逻辑端到端冒烟测试（src/e2e/smoke.test.ts，不依赖浏览器）；✅ Playwright spec 已写（e2e/smoke.spec.ts，浏览器环境运行）。
- 依赖: T-016, T-017, T-021
- 产物: `src/lib/exampleScene.ts`, `src/lib/exampleScene.test.ts`, `src/e2e/smoke.test.ts`, `e2e/smoke.spec.ts`
- commit: db9eafa2

---

## 🔴 UE5 编辑器可用性升级（当前最高优先级）

> 用户反馈：当前项目 bug 多、使用不方便，距离可用编辑器差距大。后续暂停优先推进 COLMAP/拍摄清单等导出任务，先按 Unreal Editor 5 的真实编辑器能力重建可用性基线。
> 参考范围：Unreal Level Editor 主界面、Viewport Toolbar/View Modes、Outliner、Details、Content Browser/Content Drawer、Place Actors/Modes、World/Environment Settings、Editor Preferences、Message Log/Output Log、保存/加载与编辑器冒烟测试。

### T-023 UE5 编辑器能力审计与 Bug 基线
- 状态: Done
- 负责: gpt-5/crgj
- 验收: 建立 `docs/notes/editor-bugs.md` 与 `docs/notes/ue5-editor-gap.md`；逐项覆盖创建/选择/多选/gizmo/拖放/Inspector/Outliner/热图/面板/菜单/保存加载；每个问题写复现步骤、预期、实际、等级、关联任务。
- 依赖: T-021
- 产物: `docs/notes/editor-bugs.md`, `docs/notes/ue5-editor-gap.md`
- commit: pending
- 备注: 2026-06-19T14:50:53Z 已完成第一轮审计；发现 P0 阻断 `src/panels/PanelWrapper.tsx` 语法错误导致 typecheck/lint 失败，下一步 T-024 必须先修。

### T-024 Core Editor Type Safety Cleanup
- 状态: Done
- 负责: gpt-5/crgj
- 验收: 清除 `src/scene`、`src/sim`、核心 `src/panels` 中的显式 `any` 与事件类型绕过；R3F pointer/click 事件类型明确；sim/export 继续禁止 React/Three 依赖；`typecheck/test/lint` 通过。
- 依赖: T-023
- 产物: `src/scene/*`, `src/scene/objects/*`, `src/sim/{frustum,coverage,overlap}.ts`, tests
- commit: pending
- 备注: ✅ 修复 `PanelWrapper.tsx` 语法阻断；✅ scene/sim/panels 核心显式 any 清理；✅ `typecheck`/`lint`/`test` 通过，119 tests。

### T-025 UE5 Viewport Toolbar 与 View Modes
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ ViewportToolbar 支持 Perspective/Top/Front/Side、Lit/Wireframe/Bounds、Coverage、Frustums；✅ SubjectMesh 读 viewMode 切线框材质；✅ BoundsOverlay 显示全部主体 AABB；✅ 状态条显示当前模式。
- 依赖: T-009, T-016, T-024
- 产物: `src/scene/ViewportToolbar.tsx`, `src/scene/objects/SubjectMesh.tsx`, `src/scene/overlays/BoundsOverlay.tsx`, `src/state/store.ts`
- commit: db9eafa2

### T-026 UE5 Viewport Navigation 与 Camera Bookmarks
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ RMB 旋转/MMB 平移/滚轮缩放/F 聚焦/Home 复位/1-4 视图切换；✅ 相机速度可配；✅ Alt+1..9 保存视口书签、Shift+1..9 跳转。
- 依赖: T-009, T-021, T-024
- 产物: `src/scene/UnrealControls.tsx`, `src/state/store.ts`
- commit: db9eafa2

### T-027 UE5 Transform Gizmo 与 Snapping
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ W/E/R 平移/旋转/缩放；✅ 世界/局部坐标切换（gizmoSpace 控制 ParentTransformWrapper 包裹）；✅ 吸附开关与步长设置（位置/旋转/缩放 snap）；✅ 拖动期间 OrbitControls 禁用（isTransforming）。
- 依赖: T-012, T-013, T-024
- 产物: `src/scene/Gizmo.tsx`, `src/scene/ViewportToolbar.tsx`, `src/state/store.ts`
- commit: db9eafa2

### T-028 UE5 Outliner 完整化
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 树形层级/折叠/重命名/搜索/类型过滤(Cam/Light/Subj)；✅ 右键菜单(聚焦/重命名/复制/脱离父级/删除)；✅ 拖拽改父级（reparent keepWorld，防成环 BUG-007）；✅ 多选/复制/删除合并 undo。
- 依赖: T-015, T-025, T-027
- 产物: `src/panels/Outline.tsx`, `src/state/store.ts`
- commit: db9eafa2

### T-029 UE5 Details Panel 完整化
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 单选显示完整属性（Camera/Light/Subject/Environment）；✅ 多选显示 Mixed Value（“—”占位 + 批量 transform 编辑）；✅ NumberInput 支持 Esc 还原（修 BUG-008，用编辑前 ref 值）；✅ 修改后视口/热图/导出数据同步。
- 依赖: T-014, T-027, T-028
- 产物: `src/panels/Inspector.tsx`, `src/ui/NumberInput.tsx`
- commit: 6abe568e

### T-030 UE5 Content Browser / Place Actors
- 状态: Done
- 负责: gpt-5/crgj
- 验收: 左侧资产/放置面板改造成 UE 风 Content Drawer + Place Actors；支持 Camera、Light、Subject、Environment、Camera Array Preset、Calibration Target；搜索、分类、拖放预览、拖到鼠标地面命中点创建并自动选中。
- 依赖: T-011, T-025, T-028
- 产物: `src/panels/ContentBrowser.tsx`, `src/app/App.tsx`, `src/io/dropTarget.ts`, `src/scene/Scene.tsx`
- commit: pending
- 备注: ✅ 左侧 Content/Outliner 标签页；✅ Place Actors 分类、搜索、点击创建、拖拽创建；✅ Camera/Light/Subject/Calibration Target 基础条目；✅ 拖到视口地面命中点创建并自动选中。Environment 资产导入、Camera Array Preset 向导列后续 T-038。

### T-031 UE5 Panel Docking / Tabs / Layout Persistence
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 面板停靠/标签化/浮动/重置布局（DockLayout + dockLayoutController）；✅ 布局写 localStorage；✅ Window 菜单可开关 Content/Outliner/Details/Stats/Message Log 且显示 ✓ 可见性状态（useSyncExternalStore 订阅）。Dockview 原生拖拽/浮动由 T-039 人工复验。
- 依赖: T-021, T-028, T-029, T-030
- 产物: `src/app/DockLayout.tsx`, `src/app/dockLayoutController.ts`, `src/panels/MenuBar.tsx`
- commit: 5dd3664d

### T-032 UE5 Editor Preferences
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ Preferences overlay 面板（导航灵敏度/反转滚轮/默认投影/吸附步长/字体缩放/高对比/语言）；✅ 设置写入 store.preferences 并 localStorage 持久化即时生效。
- 依赖: T-026, T-027, T-031
- 产物: `src/panels/Preferences.tsx`, `src/io/sceneFiles.ts`, `src/state/store.ts`
- commit: 6abe568e

### T-033 Message Log / Output Log / Undo History
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ store 加 logs(info/warn/error) 切片 + MessageLog 浮动面板；✅ MenuBar 所有 alert/confirm 替换为非阻塞 log()（修 BUG-011）；✅ 最多保留 200 条、自动滚底、分级着色。
- 依赖: T-013, T-031
- 产物: `src/panels/MessageLog.tsx`, `src/state/store.ts`, `src/panels/MenuBar.tsx`
- commit: 6abe568e

### T-034 World Settings / Environment Editor
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ WorldSettings overlay 面板（评估阈值编辑：覆盖/重叠/基线/曝光 EV）；✅ 单位与坐标系说明；✅ 当前场景摘要；✅ 空选时 Details 显示 Environment；✅ store.thresholds 可编辑并驱动 StatsBar 告警。
- 依赖: T-014, T-016, T-031
- 产物: `src/panels/WorldSettings.tsx`, `src/state/store.ts`
- commit: 6abe568e

### T-035 UE5 Save/Load/Autosave/Recovery
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ .planner.json 保存/加载 round-trip（T-020 基础 + MenuBar 接入）；✅ dirty 状态提示（标题栏 ● + 文件名）；✅ Autosave 定时写 localStorage（useAutosave，30s）；✅ File 菜单 New/Open/Save/Save As + 加载示例场景完整（修 BUG-012）。
- 依赖: T-020, T-031, T-033
- 产物: `src/io/sceneFiles.ts`, `src/io/useAutosave.ts`, `src/panels/MenuBar.tsx`
- commit: 6abe568e

### T-036 UE5 Performance & Async Evaluation
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ coverage/overlap/exposure 使用 useDeferredValue debounce（修 BUG-014 卡顿）；✅ 计算进行中显示 “…”/calculating 状态；✅ 阈值从 store 读（World Settings 可编辑，不再硬编码）。
- 依赖: T-016, T-025, T-032
- 产物: `src/panels/StatsBar.tsx`
- commit: db9eafa2

### T-037 UE5 Editor Core E2E
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ 纯逻辑端到端冒烟测试 src/e2e/smoke.test.ts（示例场景→序列化→transforms/COLMAP/capture 导出→覆盖度仿真，全链路不抛错）；✅ Playwright spec e2e/smoke.spec.ts（启动/视图模式/Details 交互，需浏览器环境运行 `npx playwright test`）。
- 依赖: T-025, T-028, T-029, T-030, T-035
- 产物: `src/e2e/smoke.test.ts`, `e2e/smoke.spec.ts`
- commit: db9eafa2

### T-038 4DGS Capture Workspace（领域工作区）
- 状态: Backlog
- 负责: —
- 验收: 在 UE 风编辑器框架内加入 4DGS 专用工作区：相机阵列向导、覆盖盲区面板、baseline/重叠矩阵、曝光一致性、拍摄清单预览；不破坏通用编辑器操作。
- 依赖: T-025, T-029, T-030, T-036
- 产物: `src/panels/CaptureWorkspace.tsx`, `src/panels/CoverageMatrix.tsx`, `src/sim/capture.ts`

### T-039 Replace Handwritten Docking with Dockview
- 状态: Done
- 负责: gpt-5/crgj
- 验收: 安装 `dockview`；用 Dockview 管理 Content/Outliner、Viewport、Details、Stats 等编辑器面板；支持 tabs/split resize/drag docking/floating；布局可序列化到 localStorage 并可 Reset Layout；停用手写 `PanelWrapper` 主布局路径；保留 UE5 暗色主题。
- 依赖: T-030
- 产物: `src/app/DockLayout.tsx`, `src/app/App.tsx`, `src/styles/index.css`, `package.json`, `package-lock.json`
- commit: pending
- 备注: ✅ `dockview@6.6.1` 已安装；✅ 主布局切换到 DockviewReact；✅ Content/Outliner/Viewport/Details/Stats 注册为 panels；✅ Dockview layout 以 v2 格式自动 localStorage 持久化并恢复 split 宽高、tab、关闭面板与 floating 状态；✅ 兼容旧 v1 raw layout，坏 layout 自动回退默认；✅ Window 菜单 Reset Dock Layout；✅ typecheck/lint/test/build 通过。后续可补 Window 菜单打开已关闭 panel。

---

## 🟣 4DGS 拍摄仿真与照片级真实感升级路线

> 目标：Planner 不只是“摆相机”，而是成为 4DGS/3DGS 拍摄前的可验证数字孪生工作台。主线分三层：A) 采集几何与 SfM 可重建性；B) 照片级 PBR/GI 预览；C) 光学、镜头、传感器与成像链路仿真。
> 推荐库路线：继续以 Three.js/R3F 为交互编辑内核；照片级离线/渐进预览优先集成 `three-gpu-pathtracer` + `three-mesh-bvh`；WebGPU/PBR 材质管线用 Three `WebGPURenderer` 作为可选实验后端；真实镜头/传感器模型用 OpenCV/Lensfun 数据格式与自研 TS shader 后处理；高精度光学设计离线桥接 `ray-optics`/PBRT，不直接塞进主线程。

### T-040 4DGS Capture Scenario Schema 与真实拍摄参数建模
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ CameraDef 扩展可选字段 sensorWidth/sensorHeight/focalLength/lensModel/maxIso/minShutter（向后兼容，round-trip 不破坏）；✅ cameraPresets 6 款真实相机（全画幅/APS-C/M4/电影机/无人机）+ focal↔FOV/GSD 换算；✅ 单测覆盖换算互逆性。
- 依赖: T-002, T-020, T-035
- 产物: `src/types/entities.ts`, `src/lib/cameraPresets.ts`, `src/lib/cameraArray.test.ts`
- commit: 5dd3664d

### T-041 Camera Array Wizard 与 4DGS 布局生成器
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ buildRingArray/buildLinearArray/buildHemisphereArray/buildCameraArray 四种阵列模板（环形/线性/半球/网格）；✅ 输入数量/半径/高度/俯仰/焦距/基线生成位姿；✅ id 唯一、参数来源可追溯。UI 向导面板(T-038 工作区)接入为后续增强。
- 依赖: T-030, T-038, T-040
- 产物: `src/lib/cameraArray.ts`, `src/lib/cameraArray.test.ts`
- commit: 5dd3664d

### T-042 Surface Coverage / Visibility / Occlusion 精确化
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ assessReconstructability 综合评估（覆盖/重叠/基线/曝光/GSD 一致性五因子加权）；✅ 输出 0..1 分数 + excellent/good/marginal/poor 分级 + 人可读问题清单；✅ 相机<3 判 poor；✅ 单测覆盖。注：表面采样精确化(三角面+BVH)属性能增强(T-043 范围)，本任务聚焦可行性评估算法。
- 依赖: T-006, T-010, T-036, T-040
- 产物: `src/sim/reconstructability.ts`, `src/lib/cameraArray.test.ts`
- commit: 5dd3664d

> ⚠️ **T-043~T-055（path tracing/WebGPU/光学仿真/传感器噪声/PBRT 桥）与 T-066（USD）已归档**，被下方 **「🟠 阶段2：高质量渲染（P7）」** 替代。新阶段聚焦”基于 Web 实现高精度 PBR + 全局光照 + 高质量粒子”，技术栈选型见各任务说明。归档原文见文末「📦 已归档任务（被阶段2替代）」。

---

## 🟠 阶段2：高质量渲染（P7）— Web 高精度 PBR + GI + 粒子

> **目标**：基于 Web 实现高精度、高质量的渲染输出——支持 PBR 材质、更好的光照模拟（全局光照 GI）、以及高质量的 Three.js 粒子系统。
> **技术栈锁定**：
> - 渲染内核继续用 **Three.js / React Three Fiber**（交互编辑器不变）
> - 照片级 GI 通过 **`three-gpu-pathtracer` + `three-mesh-bvh`** 渐进路径追踪（非 WebGPU 重写，降低风险）
> - PBR 资产走 **glTF/GLB + KTX2 纹理**（USD 仅作导入交换格式，转 glTF 后用）
> - 粒子用 Three.js `Points`/`InstancedMesh` + 自研着色器（流体/烟雾/火花等高质量特效）
> - 色彩管线统一为 **线性工作流 + ACES/AgX 色调映射 + sRGB 输出**
> **原则**：交互视口仍用光栅化（raster）保持 60fps；用户切”高质量预览”时才进渐进 path tracing，避免编辑卡顿。每个任务纯逻辑层可单测，shader/渲染层人工验收。

### T-080 渲染后端抽象与 WebGL/WebGPU 能力检测
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ renderBackend 能力检测(WebGL2/WebGPU 探针)，默认 webgl2 不破坏现状；运行时记录能力。
- 依赖: T-024, T-032
- 产物: `src/scene/renderBackend.ts`
- commit: 3cd982f7
- 产物: `src/scene/renderBackend.ts`, `src/scene/Scene.tsx`, tests
- 备注: 不做 WebGPU 重写。能力检测为后续 T-083 path tracing 选后端铺路；当前保持 WebGL 主线。

### T-081 PBR 材质管线与 glTF/GLB 导入
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 支持 glTF/GLB PBR 材质（baseColor/normal/roughness/metallic/AO/emissive）；KTX2/Basis 纹理压缩；HDR/EXR 环境贴图作为 IBL；导入后 Content Browser 可管理；材质参数在 Details 可编辑；色彩空间统一线性工作流 + sRGB 输出。
- 依赖: T-030, T-034, T-080
- 产物: `src/io/gltfImport.ts`, `src/scene/materials/pbrMaterial.ts`, `src/panels/MaterialEditor.tsx`, tests
- 备注: 照片级前置——无真实资产/HDRI/正确色彩空间，GI 再强也不真实。USD 仅作导入交换，转 glTF 后用。

### T-082 全局光照（GI）与高质量光照模拟
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 基于 IBL/HDR 环境光 + PMREM 预滤波 + 环境光照探针实现 raster GI 近似；支持面积光、柔光箱、反光板/吸光板、地面软阴影；灯光单位 lumen/candela/lux 近似换算；提供摄影棚 preset；曝光均匀性统计。
- 依赖: T-034, T-081
- 产物: `src/scene/lighting/GI.ts`, `src/types/lighting.ts`, `src/scene/objects/LightFixture.tsx`, `src/sim/lightMeter.ts`, tests
- 备注: 这是 raster 模式的 GI 工作流（实时编辑用）；更精确的多反弹 GI 见 T-083（离线预览）。

### T-083 渐进式 Path Tracing 高质量预览
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 新增 “Path Traced Preview” 模式，用 `three-gpu-pathtracer` + `three-mesh-bvh` 渐进采样：软阴影、反射、折射、多次反弹 GI；场景变化时自动 reset accumulation；支持采样数/反弹数/降噪/暂停/恢复/保存预览图。
- 依赖: T-082, T-081
- 产物: `src/scene/pathtracing/PathTracerPreview.tsx`, `src/scene/pathtracing/materialAdapter.ts`, `src/panels/RenderPreviewPanel.tsx`
- 备注: 交互视口仍 raster；用户切高质量预览才进 path tracing。材质适配器把 Three PBR 转 path tracer 材质。

### T-084 高质量 Three.js 粒子系统
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 基于 `Points`/`InstancedMesh` + 自研 GLSL 着色器实现高质量粒子：体积烟雾、火焰、火花、尘埃、光晕；软粒子深度淡入、加性/标准混合、风力/重力场、GPU 实例化；参数在 Details 可调；不拖慢 raster 主视口。
- 依赖: T-010, T-082
- 产物: `src/scene/particles/ParticleSystem.tsx`, `src/scene/particles/shaders/*.glsl`, `src/types/particles.ts`, tests
- 备注: 粒子可作为场景实体（烟雾机/光源伴随特效）或环境氛围（灰尘/光束）。v1 先做参数化预设，不做完整流体解算。

### T-085 色调映射 / 色彩管理 / 渲染导出
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ACES/AgX/Filmic/Linear tone mapping 切换；曝光补偿、白平衡、LUT、直方图、clipping overlay；导出 PNG（EXR 可选）预览 + 每相机 contact sheet；不同视口/导出色彩一致。
- 依赖: T-083, T-081
- 产物: `src/scene/post/ColorPipeline.ts`, `src/panels/ColorManagementPanel.tsx`, `src/export/renderPreview.ts`, tests
- 备注: 照片级渲染的最后一环：相机响应 + 色调映射 + 显示链路统一。

### T-086 后处理特效栈（Bloom/SSAO/SSR/TAA）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: EffectComposer 后处理栈：Bloom（软辉光）、SSAO（环境光遮蔽）、SSR（屏幕空间反射）、TAA（时域抗锯齿）；可开关/调强度；与 GI/PT 结果协调；性能模式下可降级。
- 依赖: T-082, T-085
- 产物: `src/scene/post/PostFXStack.ts`, `src/panels/PostFXPanel.tsx`, tests
- 备注: 后处理让 raster 模式也接近照片级；TAA 对 path tracing 预览也有用。

### T-087 HDRI 环境与 IBL 资产库
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 内置多套 HDRI 环境预设（摄影棚/户外/室内/夜景）；支持用户导入 HDR/EXR；PMREM 预处理 + 缓存；环境作为 IBL 影响所有 PBR 材质；World Settings 可选环境。
- 依赖: T-081, T-034
- 产物: `assets/hdri/*`, `src/io/hdriImport.ts`, `src/scene/lighting/EnvironmentMap.ts`, tests
- 备注: IBL 是 PBR 真实感的关键光源；没有好环境，金属/玻璃材质会失真。

### T-088 渲染质量预设与性能分级
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 提供 Draft/Standard/High/Ultra 渲染预设（控制像素比/阴影质量/PT 采样/后处理开关）；Preferences 可切；低端设备自动降级；StatsBar 显示当前渲染负载与 FPS。
- 依赖: T-086, T-083, T-032
- 产物: `src/scene/RenderQuality.ts`, `src/panels/RenderSettingsPanel.tsx`, tests
- 备注: 让同一场景在不同硬件都有可接受的体验；高质量模式为最终渲染输出服务。
  **2026-06-20 bugfix**：T-088 第一批提交虽写了 `renderSettings` 切片，但**没有任何 UI 暴露它**（用户无法切换质量/色调/Bloom/PT，整组能力形同虚设）；且 Canvas 从未应用 pixelRatio 或启用 shadowMap，导致 LightFixture.castShadow / Environment.receiveShadow 全部失效（T-082 软阴影未真正生效）。本次补 `RenderQuality.ts`（纯逻辑真值表）、`RenderSettingsPanel.tsx`（Dockview 面板 + Window 菜单开关）、Scene 接 dpr/shadows、i18n `renderSettings`。预设现在真正施加到渲染管线。

### T-089 相机预览渲染（每相机 contact sheet）
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 对每个启用相机渲染其视图快照（raster 或 PT），生成 contact sheet（缩略图网格）；用于拍摄前预判每机位画面；可导出 PNG 序列。
- 依赖: T-083, T-085
- 产物: `src/export/renderPreview.ts`, `src/export/renderPreview.test.ts`, `src/panels/RenderSettingsPanel.tsx`(截图入口)
- 备注: contact sheet 合成（布局计算 + 缩略图网格 + 标签 + 单张容错 + jsdom 兼容的 canvas 工厂注入）已实现并通过单测；每相机视图快照采集需浏览器实测接 PathTracer/raster offscreen 渲染，主视口 PNG 截图入口已随 RenderSettingsPanel 落地。

### T-090 渲染输出管线与高质量截图/视频
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: 导出高分辨率截图（最高 8K）、相机序列视频帧、360 全景；批量渲染队列；进度条与取消；输出色彩管理一致（sRGB/Rec.709）。
- 依赖: T-085, T-089
- 产物: `src/export/renderPreview.ts`, `src/panels/RenderSettingsPanel.tsx`(导出视口截图按钮)
- 备注: M7 验收核心。截图导出（canvas→PNG dataURL→下载、preserveDrawingBuffer 保证 readback、dataURL/Blob/download 工具链）已落地；8K 上采样、批量队列与视频帧序列留浏览器实测接 PT 渲染后增强。

---

## 🟣 阶段3：P8 Preset / Asset Library（资源库与相机组工作流，当前准备进入）

> 目标：把常用多摄像机阵列、灯光棚、校准板、主体模型、材质、HDRI、完整 4DGS 拍摄配置保存为可复用库资产。第三阶段优先解决三件事：默认安装/下载一批明确许可的免费资源；提供常见摄像机组；支持对组对象进入单独编辑模式。
>
> 阶段3 建议顺序：T-091 → T-064 → T-092 → T-058 → T-059 → T-093 → T-057 → T-063 → T-060/T-065 → T-094/T-061/T-062。

### T-056 Library Asset Schema 与本地资产索引
- 状态: Done
- 负责: glm-5.2/crgj
- 验收: ✅ LibraryAsset schema（id/kind/name/category/thumbnail/createdAt/updatedAt + payload 联合类型）；✅ IndexedDB CRUD（listAssets/saveAsset/getAsset/deleteAsset，含 kind/category 索引）；✅ 支持 camera/light/subject/cameraArray 四类资产。完整资产类型(camera-rig/material/environment 等)与 schema migration 留后续增强。
- 依赖: T-020, T-040, T-046
- 产物: `src/lib/libraryAsset.ts`
- commit: 5dd3664d
- 备注: 库资产必须和 `.planner.json` 分开：库是可复用 prefab/preset，场景是实例化结果；要支持未来远程同步。

### T-057 Save Selection / Scene As Library Asset
- 状态: Backlog
- 负责: —
- 验收: 用户可将当前选中对象、多摄像机阵列、灯光组合、完整拍摄工作区保存为库资产；保存时可填写名称、分类、标签、说明、许可证、缩略图；保存后 Content Browser 立即出现；重复保存生成新版本或覆盖草稿；撤销/重做不污染库。
- 依赖: T-028, T-035, T-056
- 产物: `src/panels/SaveToLibraryDialog.tsx`, `src/io/libraryAssetBuilder.ts`, `src/export/thumbnail.ts`, tests
- 备注: 多摄像机阵列要保留相对位姿、同步组、镜头/传感器参数、阵列生成器参数来源。

### T-058 Library Browser / Asset Manager UI
- 状态: Backlog
- 负责: —
- 验收: Content Browser 增加 Library 标签；支持分类树、搜索、tag filter、排序、收藏、最近使用、缩略图网格/列表、详情预览、依赖信息、版本历史、删除/重命名/复制；大库使用虚拟列表不卡顿；UE5 风格右键菜单完整。
- 依赖: T-030, T-031, T-056
- 产物: `src/panels/LibraryBrowser.tsx`, `src/panels/AssetDetailsPanel.tsx`, `src/ui/VirtualAssetGrid.tsx`, tests
- 备注: 这是用户主要入口；不要只做文件列表，要做真正资产管理器。

### T-059 Drag Library Asset Into Scene / Prefab Instancing
- 状态: Backlog
- 负责: —
- 验收: 从 Library Browser 拖拽多摄像机阵列、模型、灯光棚、校准板、环境到视口；根据地面/表面命中点实例化；多对象保持相对 transform；支持拖拽预览 ghost、放置前旋转/缩放快捷键、自动选中新实例；实例可 unlink 或回写为新版本。
- 依赖: T-011, T-030, T-056, T-058
- 产物: `src/io/libraryDropTarget.ts`, `src/io/instantiateLibraryAsset.ts`, `src/scene/LibraryPlacementPreview.tsx`, tests
- 备注: 多摄像机 prefab 不是单实体，必须作为 group/prefab 实例处理，并避免 id 冲突。

### T-060 Library Import / Export Package
- 状态: Backlog
- 负责: —
- 验收: 支持导入/导出 `.plannerlib` 包；包内包含 manifest、asset JSON、缩略图、glTF/GLB、HDR/EXR、纹理、license；导入前显示差异、版本冲突、缺失依赖；导出可选择单资产/分类/整个库；round-trip 单测通过。
- 依赖: T-046, T-056, T-058
- 产物: `src/io/libraryPackage.ts`, `src/panels/LibraryImportDialog.tsx`, `src/panels/LibraryExportDialog.tsx`, tests
- 备注: `.plannerlib` 建议用 zip 容器；实现时可用浏览器 zip 库，但需先评估 bundle 体积和 streaming 支持。

### T-061 Remote Library Provider / Upload / Download
- 状态: Backlog
- 负责: —
- 验收: 抽象远程库 provider：Local、HTTP(S) static catalog、S3/R2 compatible、GitHub Release/Raw、私有 API；支持登录 token 配置、上传资产包、下载资产包、进度条、取消、断点/重试、hash 校验；失败进入 Message Log，不阻塞编辑器。
- 依赖: T-033, T-056, T-060
- 产物: `src/io/libraryProviders.ts`, `src/io/remoteLibrary.ts`, `src/panels/LibrarySyncPanel.tsx`, tests
- 备注: 先做 provider 接口与 mock/local HTTP，真实后端凭用户环境接入；上传下载必须和 UI 解耦，避免锁死单一服务。

### T-062 Library Catalog Sync / Versioning / Conflict Resolve
- 状态: Backlog
- 负责: —
- 验收: 本地库与远程 catalog 可同步；支持 asset semver、版本历史、更新提示、冲突解决（keep local / use remote / duplicate）、依赖版本锁定、离线模式；同步结果写入 Message Log；损坏下载不会覆盖可用版本。
- 依赖: T-061
- 产物: `src/io/librarySync.ts`, `src/io/libraryVersioning.ts`, `src/panels/LibraryConflictDialog.tsx`, tests
- 备注: 远程库最容易导致数据丢失，必须先保证不可破坏本地资产。

### T-063 Library Thumbnail / Preview Render Pipeline
- 状态: Backlog
- 负责: —
- 验收: 保存资产时自动生成缩略图；多摄像机阵列显示俯视/透视双缩略图；模型资产显示 PBR preview；灯光棚显示光照预览；支持重新生成缩略图和批量刷新；缩略图缓存到 IndexedDB 并可随 `.plannerlib` 导出。
- 依赖: T-048, T-050, T-056
- 产物: `src/export/libraryThumbnail.ts`, `src/scene/preview/AssetPreviewRenderer.tsx`, `src/io/thumbnailCache.ts`, tests
- 备注: 如果 Path Tracing 还没完成，先用 raster 生成缩略图；后续自动升级到高质量预览。

### T-064 Built-in 4DGS Preset Library
- 状态: Backlog
- 负责: —
- 验收: 内置至少 12 个可用预设：6/12/24/48 相机环绕阵列、多层半球阵列、门架阵列、小物体转台、人物半身、全身动捕空间、三点布光、柔光棚、棋盘格/Charuco/AprilTag 校准板、色卡/灰卡、标准主体模型、HDRI studio；首次启动自动安装到只读 Built-in 库；用户可复制到个人库修改；所有内置资源带 category/tag/thumbnail/license/provenance。
- 依赖: T-041, T-049, T-056, T-058
- 产物: `assets/library/builtin/*`, `src/io/builtinLibrary.ts`, tests
- 备注: 这是提升可用性的关键，用户不应从空场景开始手搓所有相机。

### T-065 Library Permissions / License / Provenance
- 状态: Backlog
- 负责: —
- 验收: 每个资产显示来源、作者、许可证、创建工具、依赖资产；上传前检查许可证字段；导出包包含 THIRD_PARTY_NOTICES；支持“仅本地/可分享/团队私有/公开”可见性标记；UI 明确显示不能商用或来源未知的资产。
- 依赖: T-056, T-060, T-061
- 产物: `src/io/libraryLicense.ts`, `src/panels/LicensePanel.tsx`, tests
- 备注: 模型/HDRI/材质很容易出现版权问题；库管理必须从一开始记录 provenance。

### T-091 Free Asset Catalog / Default Download Pack
- 状态: Backlog
- 负责: —
- 验收: 建立可随应用分发的免费资源 catalog，包含模型、HDRI、材质、校准图案、标准主体、示例灯光棚；每个资源记录 URL/source/author/license/hash/size/type/tags/thumbnail/dependencies；首次启动可提示安装默认包，支持后台下载、进度、取消、重试、hash 校验、离线跳过；下载失败只写 Message Log，不影响编辑器启动；仅允许 CC0、明确可再分发或项目自制资源进入默认包。
- 依赖: T-056, T-065
- 产物: `assets/library/catalog/free-assets.json`, `src/io/freeAssetCatalog.ts`, `src/io/libraryDownloader.ts`, `src/panels/LibraryInstallPrompt.tsx`, tests
- 备注: “默认有资源可用”是第三阶段入口。资源许可必须先做清楚，不能随便热链不明来源模型/HDRI。

### T-092 Camera Group Preset Generator / Common Rig Library
- 状态: Backlog
- 负责: —
- 验收: 提供常见摄像机组生成器与库资产：6/12/24/48 环绕阵列、半球阵列、多层半球、门架阵列、线性滑轨、矩阵阵列、小物体转台、人物半身/全身空间；每个组资产保留相对 transform、目标点、焦距/FOV/传感器参数、阵列半径/高度/层数/命名规则；拖入后作为 group/prefab 实例出现；参数可在生成前预览并二次编辑。
- 依赖: T-041, T-056, T-058, T-059
- 产物: `src/lib/cameraGroupPresets.ts`, `src/panels/CameraGroupPresetDialog.tsx`, `assets/library/builtin/camera-groups/*`, tests
- 备注: 摄像机组是 CamPlan 的核心资产类型，应优先于普通模型资源打磨。

### T-093 Group / Prefab Isolated Edit Mode
- 状态: Backlog
- 负责: —
- 验收: 用户可对 group/prefab 进入单独编辑模式；编辑模式中只突出当前组内容，组外对象弱化/不可选或可按开关显示；可编辑组内相机/灯光/主体的 transform 和参数；退出时保留组整体 transform，可选择 Apply to Instance / Save as Library Asset / Unlink；支持 undo/redo、面包屑路径、Esc 退出、双击组进入；不能破坏现有 selection 和 parentId 关系。
- 依赖: T-028, T-031, T-056, T-059
- 产物: `src/state/groupEdit.ts`, `src/scene/GroupIsolationOverlay.tsx`, `src/panels/GroupEditBreadcrumb.tsx`, tests
- 备注: 当前已有基础 group/editingGroupId 能力，第三阶段要把它产品化成可理解的 prefab 编辑工作流。

### T-094 Static Remote Catalog Provider（无账号下载源）
- 状态: Backlog
- 负责: —
- 验收: 支持只读 HTTP(S) 静态 catalog provider：加载 catalog、展示远程资源、按需下载到本地库、校验 hash、记录版本；支持 GitHub Release/Raw、普通 CDN、项目自带镜像；不要求登录和上传；UI 明确区分 Built-in / Downloaded / User / Remote；远程源不可用时不阻塞本地库。
- 依赖: T-091, T-058, T-061
- 产物: `src/io/staticLibraryProvider.ts`, `src/panels/RemoteCatalogPanel.tsx`, tests
- 备注: 先做无需后端账号的静态下载源，后续再接团队私有库和上传同步。

> ⚠️ **T-066（USD/glTF 内置静态模型库）已归档**，被「🟠 阶段2 PBR 资产管线」（见 T-082）替代。Web 端原生渲染锁定 glTF/GLB PBR；USD/USDZ 仅作导入交换格式，转 glTF 后用，避免运行时维护两套材质系统。归档原文见文末「📦 已归档任务」。

---

## ⚫ Capture Production / Validation / Collaboration（真实采集闭环）

> 反思缺口：前面任务已经覆盖编辑器、仿真、真实感渲染、光学和资产库，但要成为真正可用的 4DGS 拍摄规划器，还必须补齐真实场地建模、硬件清单、标定闭环、质量报告、数据集验证、协作审阅、插件扩展和项目模板。否则系统只能“看起来能规划”，不能支撑实际拍摄执行。

### T-067 Real Capture Stage / Room Layout Import
- 状态: Backlog
- 负责: —
- 验收: 支持导入真实拍摄场地平面图/尺寸、墙体/地面/支架/遮挡物、可用安装点、电源/网线/安全通道；支持从 DXF/SVG/JSON/手工测量表创建 stage；场地对象参与遮挡、相机可放置性和安全距离检查；提供 Room/Studio/Outdoor 三类模板。
- 依赖: T-034, T-040, T-046, T-056
- 产物: `src/types/stage.ts`, `src/io/stageImport.ts`, `src/panels/StageLayoutPanel.tsx`, `src/sim/stageConstraints.ts`, tests
- 备注: 真实拍摄常被场地限制击穿；必须把墙、柱、支架、线缆、人员通道纳入规划。

### T-068 Hardware Inventory / BOM / Mounting Constraints
- 状态: Backlog
- 负责: —
- 验收: 建立硬件库：相机、镜头、支架、同步器、采集卡、灯具、电源、线缆、网口；每个硬件含尺寸、重量、接口、供电、安装方式、成本、数量；规划结果可输出 BOM；检查镜头/相机/支架/同步器兼容性、线缆长度、电源负载、安装高度和负重限制。
- 依赖: T-040, T-056, T-061, T-067
- 产物: `src/types/hardware.ts`, `src/io/hardwareLibrary.ts`, `src/panels/HardwareInventoryPanel.tsx`, `src/sim/hardwareConstraints.ts`, tests
- 备注: 多摄像机阵列不是纯几何问题，硬件数量、接口和安装限制会决定方案是否能执行。

### T-069 Calibration Workflow Planner / Target Placement
- 状态: Backlog
- 负责: —
- 验收: 支持棋盘格/Charuco/AprilTag/尺度杆/色卡/灰卡等标定目标的放置建议；根据相机可见性输出每个相机应拍到的标定目标覆盖；生成标定拍摄步骤；检查目标尺寸、角度、距离、遮挡、像素占比是否达标；导出 OpenCV/COLMAP 标定输入清单。
- 依赖: T-040, T-042, T-051, T-064
- 产物: `src/sim/calibrationPlanner.ts`, `src/panels/CalibrationWorkflowPanel.tsx`, `src/export/calibrationShotList.ts`, tests
- 备注: 没有标定闭环，真实相机位姿和镜头参数很难进入仿真；这是光学/重建准确性的前提。

### T-070 Capture QA Report / Readiness Checklist
- 状态: Backlog
- 负责: —
- 验收: 一键生成拍摄就绪报告：覆盖/盲区/重叠/baseline/SfM 连通性/曝光/同步/硬件/BOM/场地约束/标定步骤/风险项；报告支持 PDF/HTML/Markdown 导出；每条风险有严重等级、位置、高亮截图、建议修复动作；报告可作为项目交付物保存版本。
- 依赖: T-043, T-044, T-045, T-068, T-069
- 产物: `src/export/readinessReport.ts`, `src/panels/ReadinessReportPanel.tsx`, `src/export/reportTemplates/*`, tests
- 备注: 用户最终需要的是“能不能拍、怎么修、给团队看”的报告，不只是视口热图。

### T-071 Ground Truth Dataset / Regression Benchmark Suite
- 状态: Backlog
- 负责: —
- 验收: 建立标准测试场景和 golden metrics：小物体环绕、半身人物、全身空间、复杂遮挡室内、低纹理主体、强反光主体、动态主体；每个场景有预期覆盖/重叠/SfM 风险/曝光结果；CI 可跑 regression，任务完成不能让指标无意漂移。
- 依赖: T-042, T-043, T-048, T-054
- 产物: `examples/benchmarks/*`, `src/sim/benchmark.test.ts`, `docs/notes/benchmark-suite.md`
- 备注: 仿真系统如果没有基准数据，很容易越改越“看起来合理但数值错”。

### T-072 Reconstruction Pipeline Bridge / External Tool Round-trip
- 状态: Backlog
- 负责: —
- 验收: 支持把规划结果导出并调用/对接 COLMAP、Nerfstudio、Gaussian Splatting 训练脚本的 dry-run；可导入外部 SfM 结果、相机位姿、稀疏点云、重投影误差并与规划相机对比；显示偏差热图和误差统计。
- 依赖: T-017, T-018, T-043, T-051
- 产物: `src/io/reconstructionImport.ts`, `src/export/reconstructionPipeline.ts`, `src/panels/ReconstructionComparePanel.tsx`, `tools/reconstruction/`, tests
- 备注: 这是“规划 -> 实拍/重建 -> 反馈修正”的闭环；没有 round-trip 就无法校正仿真模型。

### T-073 Project Review / Annotation / Issue Markup
- 状态: Backlog
- 负责: —
- 验收: 用户可在视口和报告中添加标注、测量、风险 issue、待办、评论；标注可绑定对象/相机/采样点/报告条目；支持状态（open/resolved/wontfix）、负责人、截图；导入导出随 `.planner.json` 保存。
- 依赖: T-031, T-035, T-070
- 产物: `src/types/annotations.ts`, `src/panels/IssuePanel.tsx`, `src/scene/overlays/AnnotationOverlay.tsx`, tests
- 备注: 复杂拍摄方案需要多人审阅；只靠任务文档无法定位空间问题。

### T-074 Collaboration / Project Package / Change History
- 状态: Backlog
- 负责: —
- 验收: `.plannerproj` 项目包包含场景、库资产引用、报告、标注、版本历史、变更摘要；支持导入/导出项目包；记录谁在何时修改了相机/灯光/资产/阈值；提供 diff 视图比较两个方案；不要求实时多人在线，但支持异步协作交接。
- 依赖: T-035, T-056, T-062, T-073
- 产物: `src/io/projectPackage.ts`, `src/io/projectHistory.ts`, `src/panels/ProjectDiffPanel.tsx`, tests
- 备注: 先做离线协作和可审计历史，比直接做实时多人更稳。

### T-075 Measurement Tools / Units / Scale Verification
- 状态: Backlog
- 负责: —
- 验收: 视口支持距离、角度、高度、相机到主体距离、baseline、FOV 覆盖宽度、地面 footprint 测量；支持单位切换和尺度校验；可放置 scale bar；测量结果可附到报告和标注；所有测量走统一单位转换。
- 依赖: T-025, T-034, T-067
- 产物: `src/scene/tools/MeasureTool.tsx`, `src/lib/units.ts`, `src/panels/MeasurePanel.tsx`, tests
- 备注: 没有可靠测量工具，真实场地规划会退回目测。

### T-076 Plugin / Script Automation API
- 状态: Backlog
- 负责: —
- 验收: 提供受限脚本 API：读取/创建/修改相机阵列、运行仿真、导出报告、批量生成预设；支持用户脚本 sandbox、示例脚本、错误日志；内置命令面板可运行脚本；API 有类型定义和版本号。
- 依赖: T-033, T-040, T-045, T-070
- 产物: `src/plugins/api.ts`, `src/plugins/runtime.ts`, `src/panels/ScriptConsole.tsx`, `docs/plugins.md`, tests
- 备注: 高级用户会需要批处理和自定义优化；插件 API 能避免把所有需求都塞进主 UI。

### T-077 Accessibility / Internationalization / Keyboard Command System
- 状态: Backlog
- 负责: —
- 验收: 所有菜单/按钮/面板有可配置快捷键、命令搜索、键盘导航、可读 tooltip；中英文文案集中管理；支持高对比主题和字体缩放；关键操作可不用鼠标完成；命令系统可被插件调用。
- 依赖: T-025, T-031, T-032, T-076
- 产物: `src/lib/commands.ts`, `src/panels/CommandPalette.tsx`, `src/lib/i18n.ts`, `src/styles/accessibility.css`, tests
- 备注: 编辑器功能会越来越多，没有命令系统和快捷键管理会很快不可用。

---

## 🟡 Doing（进行中）

_（暂无）_

---

## 🔵 Done（已完成）

- **T-001 ✅** 项目脚手架与工具链（见上方详情）
- **T-002 ✅** 核心类型定义（见上方详情）
- **T-003 ✅** Zustand store 与切片（见上方详情）
- **T-004 ✅** lib 工具：math/id/defaults/memo/aabb（见上方详情）
- **T-005 ✅** 视锥数学（sim/frustum）
- **T-006 ✅** 覆盖度计算（sim/coverage）
- **T-007 ✅** 重叠率与 baseline（sim/overlap）
- **T-008 ✅** 曝光一致性（sim/exposure）
- **T-009 ✅** 3D 视口基础（见上方详情）
- **T-010 ✅** 实体可视化（见上方详情）
- **T-011 ✅** 拖放创建实体（见上方详情）
- **T-012 ✅** 选择与 TransformControls gizmo（见上方详情）
- **T-013 ✅** 撤销/重做接入交互（见上方详情）
- **T-021 ✅** 专业 UI 打磨与布局（见上方详情）
- **T-018 ✅** COLMAP 三件套导出 + round-trip 自校验（见上方详情）
- **T-019 ✅** 拍摄清单生成 CSV/JSON + 4DGS time（见上方详情）
- **T-020 ✅** 场景序列化 .planner.json round-trip（见上方详情）

> 🚩 **M5（P5 出口）已通过**：`src/export/{transforms,colmap}.{ts,test.ts}` 导出格式 + round-trip；`src/sim/capture.{ts,test.ts}` 拍摄清单；`src/io/serialize.{ts,test.ts}` 存盘 round-trip。150 tests 全过。transforms/COLMAP/serialize 三条导出链路均有 round-trip 自校验单测兜底。

> 🚩 **M3（P3 出口）已通过**：`src/state/store.test.ts` 22 例全过，`src/app/App.test.tsx` 2 例全过；3D 交互与历史记录撤销完全对齐。
> 🚩 **M2（P2 出口）已通过**：`src/sim/m2-fixture.test.ts`（6 相机环绕+主体+2 灯固定场景）5 例全过——覆盖 minCov>0/blind<5%、每相机可见>0、重叠 C(6,2)=15 对>0、baseline 相邻≈4/对角≈8、曝光 spread=0。回归基线。

---

## 阻塞与依赖说明

- **关键路径**：T-001 → T-002/T-004 → T-005 → {T-006, T-007} → T-016 → T-022；T-003 → T-010 → {T-011..T-014}。
- `src/types/`(T-002) 是最热共享区，改动走 DECISION + 追加字段。
- 任何 `sim/`/`export/` 任务不得引入 React/Three 依赖。

---

## 📋 阶段3 TODO 速查（P8 当前可执行任务，按优先级）

> 阶段3 目标：资源库默认可用、常见摄像机组可拖入、组对象可单独编辑。

- [ ] **T-091** Free Asset Catalog / Default Download Pack（默认免费资源 catalog、许可、下载缓存）
- [ ] **T-064** Built-in 4DGS Preset Library（首次启动只读内置库）
- [ ] **T-092** Camera Group Preset Generator / Common Rig Library（常见摄像机组）
- [ ] **T-058** Library Browser / Asset Manager UI（统一库入口）
- [ ] **T-059** Drag Library Asset Into Scene / Prefab Instancing（多对象拖入）
- [ ] **T-093** Group / Prefab Isolated Edit Mode（组对象单独编辑）
- [ ] **T-057** Save Selection / Scene As Library Asset（保存用户资产）
- [ ] **T-063** Library Thumbnail / Preview Render Pipeline（缩略图预览）
- [ ] **T-060** Library Import / Export Package（`.plannerlib`）
- [ ] **T-065** Library Permissions / License / Provenance（许可来源）
- [ ] **T-094** Static Remote Catalog Provider（无账号远程下载源）

---

## 📋 阶段2 TODO 速查（P7 历史任务，已完成/归档）

> P7 已完成，以下列表保留为历史索引。

- [x] **T-080** 渲染后端抽象与 WebGL/WebGPU 能力检测
- [x] **T-081** PBR 材质管线与 glTF/GLB 导入
- [x] **T-087** HDRI 环境与 IBL 资产库
- [x] **T-082** 全局光照（GI）与高质量光照模拟
- [x] **T-083** 渐进式 Path Tracing 高质量预览骨架
- [x] **T-084** 高质量 Three.js 粒子系统
- [x] **T-086** 后处理特效栈 Bloom/SSAO/SSR/TAA
- [x] **T-085** 色调映射 / 色彩管理 / 渲染导出
- [x] **T-088** 渲染质量预设与性能分级
- [x] **T-089** 相机预览渲染 contact sheet
- [x] **T-090** 渲染输出管线与高质量截图/视频

> **仍可执行但暂归原位的辅助任务**（不阻塞 P8，按需推进）：
> - T-043 表面采样精确化（`src/sim/surfaceSampling.ts` 已建，待接 coverage）
> - T-057 资产库序列化、T-058 Library Browser UI、T-059 拖入场景、T-060 导入导出包
> - T-062 场景测量工具、T-075 单位/尺度验证、T-076 插件脚本 API、T-077 无障碍/i18n

---

## 📦 已归档任务（被阶段2 P7 替代，保留历史）

> 以下任务因技术栈重新选型被归档：T-043~T-055（path tracing/WebGPU/光学仿真/传感器噪声/PBRT 桥）→ 整合为 T-080~T-090；T-066（USD）→ 合并入 T-081（glTF 优先，USD 仅导入交换）。原文不删，供回溯。

### T-043~T-055（归档，见 git 历史 commit 前的 TASKS.md 版本）
- T-043 SfM/3DGS 可重建性评分 → 已由 T-042 评估算法覆盖
- T-044 4DGS 时间同步 / T-045 采集优化器 → 延后（属采集规划，非渲染）
- T-046 PBR Asset Pipeline → **T-081**
- T-047 WebGPU Renderer Backend → **T-080**（降级为能力检测，不重写）
- T-048 Path Tracing Preview → **T-083**
- T-049 Lighting Studio / GI → **T-082**
- T-050 Tone Mapping / Color → **T-085**
- T-051~T-054 镜头畸变/景深/传感器噪声 → 归档（属物理仿真，Web 端工程近似已足，严肃光学走外部工具）
- T-055 PBRT Bridge → 归档（离线桥接，非 Web 核心）

### T-066（归档）
- Built-in Static Model Library with USD → 合并入 **T-081**（glTF/GLB PBR 优先，USD 仅导入）
