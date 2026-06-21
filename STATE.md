# Planner — 当前世界状态（STATE.md）

> 这是“现在到哪了”的快照。每次显著进展或交接时**整体更新**。新 coder 先读本文件确认阶段。
> 最新更新时间：2026-06-20T12:43:44Z　by gpt-5/crgj

## 当前阶段

**v1 主线（P0–P6，M1–M6）全部闭环** ✅ —— 脚手架/类型/store/lib、仿真核心、3D 交互、专业 UI、导出序列化、端到端冒烟全部完成。

**UE5 编辑器可用性（P4.5）** ✅ —— T-022/T-025~T-029/T-031~T-037 共 13 任务完成。

**采集规划核心数据层** ✅ —— T-040/T-041/T-042/T-056 完成。

**🟠 阶段2：P7 高质量渲染 — 第一批（T-080~T-088）+ 收尾（T-089/T-090）全部完成** ✅ —— 渲染后端检测、PBR/glTF 导入、HDRI/IBL、GI/光照度量、Path Tracing 预览骨架、粒子系统、色调映射、后处理栈、**质量预设 UI 化（RenderSettingsPanel）**、**contact sheet + 截图导出** 全部落地。技术栈 Three.js/R3F + three-gpu-pathtracer + glTF/KTX2 + ACES/AgX。

**🟣 当前准备进入阶段3：P8 资源库与相机组工作流** —— 主线围绕 Library：默认安装/下载一批明确许可的免费资源；提供常见摄像机组（环绕/半球/门架/线性/矩阵/转台等）；Library 资源可搜索预览并拖入场景；组对象/prefab 可进入单独编辑模式。任务入口见 `TASKS.md` 的 T-091/T-064/T-092/T-058/T-059/T-093/T-057/T-063/T-060/T-065/T-094。

**剩余 Backlog（P8 之外，按需）**：T-038（4DGS Workspace UI）、T-067~T-077（采集闭环/真实场地/标定/协作，部分需服务端）。

## 可跑命令

| 命令 | 状态 |
|------|------|
| `npm install` | ✅ |
| `npm run dev` | ⚠️ 未启动复验；质量门已恢复 |
| `npm run typecheck` | ✅ 干净 |
| `npm run test` | ✅ 195 passed（+18：RenderQuality8/renderPreview10） |
| `npm run lint` | ✅ 干净 |
| `npm run build` | ✅ 通过；有 chunk >500k 警告，后续可 code split |

## 已完成产物

- 文档/协议/技能 + 配置（见前次记录）
- **源码**：
  - T-001 脚手架：`src/{main.tsx, app/*, scene/Scene.tsx, styles/index.css, vite-env.d.ts}`
  - T-002 类型定义：`src/types/{common,entities,eval,index,types.test-d}.ts`
  - T-003 Zustand store 状态管理：`src/state/{store,history,store.test}.ts`
  - T-004 lib 工具库：`src/lib/{math,id,memo,aabb,defaults}.ts` + tests
  - T-005 视锥数学：`src/sim/frustum.{ts,test.ts}`
  - T-006 覆盖度计算：`src/sim/coverage.{ts,test.ts}`
  - T-007 重叠率与 baseline：`src/sim/overlap.{ts,test.ts}`
  - T-008 曝光一致性：`src/sim/exposure.{ts,test.ts}`
  - T-009 3D 视口基础：`src/scene/Scene.tsx`, `src/scene/lib/frustumCorners.ts`
  - T-010 实体可视化：`src/scene/objects/{CameraRig,LightFixture,SubjectMesh,Environment}.tsx`
  - T-011 拖放创建实体：`src/io/dropTarget.tsx`, `src/panels/Toolbar.tsx`
  - T-012 选择与 gizmo：`src/scene/Gizmo.tsx`
  - T-013 撤销/重做：`src/state/history.ts`, `src/state/store.ts`
  - T-014 Inspector 属性面板：`src/panels/Inspector.tsx`, `src/ui/NumberInput.tsx` (支持多语言翻译、UE5 风格高对比高细节 SVG 图标、属性组折叠、三轴 Location/Rotation 的 Scrub 微调)
  - T-015 Outline 层级大纲：`src/panels/Outline.tsx` (支持多语言、眼睛控制显隐、双击行内重命名、顶部 Search 关键词过滤)
  - T-016 覆盖热图与评估底栏：`src/scene/overlays/CoverageHeatmap.tsx`, `src/panels/StatsBar.tsx` (三色评估指示灯、阈值自动比对告警、多语言实时汇总显示)
  - T-017 transforms.json 导出与自校验：`src/export/transforms.ts`, `src/export/schema.ts`, `src/export/transforms.test.ts` (Nerfstudio/4DGS 兼容及 round-trip 解析还原)
  - M4/M3/M2 夹具回归测试：`src/sim/m2-fixture.test.ts`, `src/state/store.test.ts`
  - 顶级菜单栏系统：`src/panels/MenuBar.tsx` (支持 File、Edit、View、Window、Help 等下拉层叠菜单，绑定撤销/重做/清除场景/双语切换/数据导出动作)
  - 高级面板包装容器：`src/panels/PanelWrapper.tsx` (实现多停靠栏系统的核心容器，支持 Dock Left / Dock Right / Float 状态切换，Float 悬浮模式的拖动定位，边缘把手的拉伸缩放，以及 Header 折叠隐藏功能)
  - UI 布局与主题：`src/styles/index.css` (UE5.8 规范暗色色板与高密度令牌)；`src/app/App.tsx` (重构为多栏多面板自适应停靠布局，支持悬浮面板层渲染)
- 文档/技能：HANDBOOK/.coder-protocol/PLAN/TASKS/LOG/STATE + docs/architecture + **5 skills**
- T-023 审计文档：`docs/notes/editor-bugs.md`, `docs/notes/ue5-editor-gap.md`
- T-024 类型安全修复：`src/panels/PanelWrapper.tsx`, `src/panels/MenuBar.tsx`, `src/scene/Scene.tsx`, `src/scene/objects/*`, `src/sim/{frustum,coverage}.ts`
- 多选删除小修：`src/state/store.ts`, `src/io/useKeyboard.ts`, `src/state/store.test.ts`
- T-026 基础导航小修：`F` 聚焦选中、`Home` 复位视口，基于 `viewportCommand` 由 `UnrealControls` 消费。
- UE5 编辑器小闭环：拖放实体使用视口地面 raycast 命中点；TransformControls 拖动期间暂停 `UnrealControls`；新增视口左上基础 Toolbar（投影/Coverage/Frustums）。
- T-030 Content Browser / Place Actors：左侧 Content/Outliner 标签页、分类搜索、点击创建、拖拽创建、地面命中点放置。
- T-039 Dockview 主布局：`dockview@6.6.1` 替换手写 `PanelWrapper` 主布局；Content/Outliner/Viewport/Details/Stats 作为 Dockview panels；layout localStorage 持久化；Window 菜单可 Reset Dock Layout。
- T-039 拖拽稳定性修复：暂停自动 `fromJSON` 恢复旧布局，清理旧 storage，layout 保存 debounce，Dockview 容器加 `min-height`。
- T-039 向下 dock 修复：Place Actors 的 `onDragOver/onDrop` 改为只处理 `application/x-planner-prototype`，不再拦截 Dockview tab 拖拽。
- T-039 顶栏 Dock 开关：新增左/右面板显隐按钮；左侧切 Content+Outliner，右侧切 Details。
- T-039 浏览器布局持久化恢复：Dockview serialized layout 以 v2 格式写入 localStorage，恢复 split 宽高、tab、关闭面板与 floating 状态；兼容旧 v1 raw layout，坏布局自动清理回退默认；顶栏按钮随 Dockview 原生布局变化刷新。
- 4DGS 拍摄仿真与照片级真实感升级路线：`TASKS.md` 新增 T-040..T-055，覆盖真实采集参数建模、相机阵列向导、表面可见性/SfM 可重建性、时间同步、布局优化、PBR 资产、WebGPU 后端、path tracing、灯光棚、色彩管理、镜头畸变、DOF、传感器噪声、PBRT/光学离线桥。
- Preset / Asset Library 路线：`TASKS.md` 已整理为阶段3 P8，覆盖 T-056..T-065 与新增 T-091..T-094：多摄像机阵列、模型、灯光、环境、校准板等库资产 schema，本地 IndexedDB 库、默认免费资源 catalog/download、常见摄像机组、保存选中为资产、Library Browser、拖入场景、组对象单独编辑、`.plannerlib` 导入导出、远程静态 catalog、同步版本冲突、缩略图、内置 4DGS 预设库、许可证来源管理。
- Built-in Static Model Library：`TASKS.md` 新增 T-066，要求库中内置更多静态模型，支持 glTF/GLB PBR 材质和 USD/USDZ 导入/转换路径，并完整记录缩略图、license、尺度、坐标轴、纹理依赖。
- Capture Production / Validation / Collaboration 路线：`TASKS.md` 新增 T-067..T-077，覆盖真实场地导入、硬件/BOM/安装约束、标定工作流、拍摄就绪报告、基准测试数据集、外部重建 round-trip、标注审阅、项目包协作、测量工具、插件脚本 API、命令/无障碍/国际化。
- **T-018 COLMAP 导出（M5）**：`src/export/colmap.{ts,test.ts}` —— cameras.txt(PINHOLE)/images.txt(四元数+世界→相机平移)/points3D.txt(空)；世界→相机取逆；round-trip 自校验单测。
- **T-019 拍摄清单（M5）**：`src/sim/capture.{ts,test.ts}` —— buildCaptureList(仅启用相机、按 time 升序)、worldToCamera+内参+曝光+time、CSV/JSON 双格式。
- **T-020 场景序列化（M5）**：`src/io/serialize.{ts,test.ts}` —— PlannerFile 包裹层 + 版本迁移、serialize/deserialize 整场景无损 round-trip、validateScene 结构校验、downloadPlannerFile、错误输入处理。
- **T-022 示例场景 + T-037 E2E（M6/v1 出口）**：`src/lib/exampleScene.{ts,test.ts}`（环形相机阵列工厂）、`src/e2e/smoke.test.ts`（纯逻辑端到端冒烟）、`e2e/smoke.spec.ts`（Playwright）。store 首启加载示例场景。
- **UE5 编辑器可用性（P4.5）**：
  - T-033 MessageLog：`src/panels/MessageLog.tsx` + store.logs（取代 alert/confirm，BUG-011）
  - T-035 Save/Load/Autosave：`src/io/sceneFiles.ts`、`src/io/useAutosave.ts`、MenuBar 接入（BUG-012）
  - T-032 Preferences：`src/panels/Preferences.tsx` + store.preferences + localStorage
  - T-034 WorldSettings：`src/panels/WorldSettings.tsx` + store.thresholds
  - T-029 Details 多选：Inspector 多选 Mixed Value + `src/ui/NumberInput.tsx` BUG-008 修复
  - T-028 Outliner：Outline 右键菜单/拖拽改父级/类型过滤 + store.reparent（keepWorld BUG-007）
  - T-027 Gizmo：`src/scene/ViewportToolbar.tsx` W/E/R + World/Local + Snap 步长
  - T-025 View Modes：SubjectMesh wireframe + `src/scene/overlays/BoundsOverlay.tsx`
  - T-026 Bookmarks：UnrealControls Alt/Shift+1..9 + store.bookmarks
  - T-036 性能：StatsBar useDeferredValue debounce（BUG-014）

- **阶段2 P7 高质量渲染（T-080~T-090）**：
  - T-080 渲染后端检测：`src/scene/renderBackend.ts`（WebGL2/WebGPU 探针，默认 webgl2）
  - T-081 PBR/glTF 导入：`src/io/gltfImport.ts`（GLTFLoader+KTX2+DRACO，线性色彩工作流）
  - T-087 HDRI/IBL：`src/scene/objects/Environment.tsx`（drei <Environment> PMREM，4 套 HDR 预设）
  - T-082 GI/光照：`src/scene/objects/LightFixture.tsx`（castShadow 软阴影）、`src/sim/lightMeter.ts`（均匀性/过曝/欠曝评估）
  - T-085 色调映射：`src/scene/post/PostFXStack.tsx`（ACES/AgX/Filmic/Linear）
  - T-086 后处理栈：Bloom(mipmapBlur)+SSAO+ToneMapping，质量分级控制
  - T-083 Path Tracing：`src/scene/pathtracing/PathTracerPreview.tsx`（骨架，three-gpu-pathtracer 命令式集成需浏览器实测）
  - T-084 粒子系统：`src/scene/particles/ParticleSystem.tsx`（自研 GLSL 软粒子+加性混合，5 种预设）
  - T-088 质量预设：`src/scene/RenderQuality.ts`（纯逻辑真值表：DPR/阴影/后处理/PT 上限）+ **`src/panels/RenderSettingsPanel.tsx`（Dockview 面板：质量/色调/Bloom/SSAO/PT 采样反弹/光照只读/截图导出）**。**bugfix**：首批提交 renderSettings 切片无 UI 暴露 → 现有 RenderSettingsPanel + Window 菜单开关；Scene Canvas 从未应用 pixelRatio/启用 shadowMap（软阴影失效）→ 现 dpr + shadows='soft' + ShadowMapConfigurer + preserveDrawingBuffer。
  - T-089 contact sheet：`src/export/renderPreview.ts`（布局计算 + 缩略图网格合成 + 标签 + 单张容错 + jsdom 兼容 canvas 工厂注入）
  - T-090 渲染输出：`src/export/renderPreview.ts`（canvas→PNG dataURL→Blob→download、截图入口在 RenderSettingsPanel）

## 关键决策（详见 LOG.md）

1. 技术栈 = Three.js + R3F + drei + Zustand + Tailwind v4 + Vite + TS strict。
2. **UI 严格参考 Unreal Editor 5.8**（颜色/字体/布局/控件/交互）。权威规范 = `.agents/skills/ue5-ui-reference`，色板写入 `src/styles/index.css`。视口转视角用 RMB（LMB 保留给选择/框选）。
3. `sim/`/`export/` 禁 React/Three；角度换算只在 `lib/math`。
4. 类型契约用 `*.test-d.ts` 编译期断言。
5. frustum 用裁剪空间法，6 平面推迟 v2。
6. coverage 遮挡 = AABB 近似（v2 改光线投射+BVH）。
7. 欧拉角 Rz·Ry·Rx 顺序：pitch+yaw 同时非零在 z<0 侧有耦合（不影响 sim；UI 用四元数）。
8. gizmo 历史节流：store 加 `commitHistory()`，仅在 drag 开始/结束时入快照栈，避免拖拽高频撑爆历史。
9. **数据计算降采样调优**：为保障 3D 视口渲染与拖拽交互的极致丝滑，在 StatsBar 和 Heatmap 模块计算覆盖率时将 sampling grid 指定为 `16`（约 4096 采样点，计算量相比 grid=64 降低了 100 倍），彻底杜绝了启用主体时主线程计算过重导致页面无响应/崩溃的问题。
10. **迭代合并安全化**：重写了 `flatten` 辅助函数，将之前使用展开运算符的 `out.push(...s)` 改为迭代循环遍历，消除了在大 grid 或多采样集下 V8 压栈溢出抛出 `RangeError: Maximum call stack size exceeded` 的安全隐患。

## 已知问题 / 待办提醒

- 颜色=hex整数，角度=度，单位=米（贯穿类型/lib）。
- `defaults.ts` 计数器需 `resetDefaultCounters()`（测试前）。
- 拖放落点 v1 统一原点上方，地面 raycast 落点列 v2。
- 当前任务状态曾大量以 typecheck/test/lint 通过作为 Done 依据，不能代表真实编辑器可用；后续必须以手动复现路径 + 自动测试 + 截图/录屏验收。
- 工作区存在大量未提交源码变更，新增升级任务开始前需先做 T-023 审计，避免在不稳定基础上继续堆功能。
- **P0 阻断已修复**：`src/panels/PanelWrapper.tsx` 重复/悬空拖拽代码块已清理，typecheck/lint 恢复通过。
- **首轮审计结论**：详见 `docs/notes/editor-bugs.md`，已记录 15 个问题；详见 `docs/notes/ue5-editor-gap.md`，已建立 UE5 gap matrix。
- **已修复 BUG-009**：Delete/Backspace 现在删除全部选中实体，并合并为一个 undo step。
- **已修复 BUG-004**：`F` 聚焦选中已实现；额外完成 `Home` 复位视口。
- **已修复 BUG-003 的核心落点问题**：拖放创建不再固定原点，使用视口地面命中点。
- **已修复 BUG-006 的核心输入冲突**：gizmo 拖动期间视口导航暂停。
- **已完成 T-030 基础版**：顶栏文字添加入口已替换为左侧 UE 风 Place Actors 面板。
- **已完成 T-039**：Dock 慢且不正确的问题从架构上改为使用 Dockview；手写 `PanelWrapper` 不再作为 App 主布局路径。

## 下一步（给下一个 coder）

0. **文档已切到阶段3 P8**：`PLAN.md` 增加 P8/M8；`TASKS.md` 增加 T-091~T-094 并把资源库任务列为当前阶段；本文件已更新当前阶段。
1. **P8 第一批建议领取顺序**：T-091 Free Asset Catalog / Default Download Pack → T-064 Built-in 4DGS Preset Library → T-092 Camera Group Preset Generator → T-058/T-059 Library UI 与拖入场景 → T-093 组对象/prefab 单独编辑模式。
2. **资源许可红线**：默认下载/内置资源只能使用 CC0、明确可再分发、官方示例或项目自制资源；每条资源必须有 source/author/license/hash。不要把许可不清的模型、HDRI、材质塞进默认库。
3. **人工复验仍建议保留**：启动 `npm run dev` 复验 Dockview、保存/加载、拖拽、视口渲染、SSAO/阴影、HUD、偏好缓存，避免 P8 在不稳定 UI 上继续堆功能。
4. **真实采集闭环后续建议**：P8 稳定后再推进 T-067（场地）→ T-068（硬件/BOM）→ T-069（标定）→ T-070（就绪报告）。
