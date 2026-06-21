# Planner — 项目手册（HANDBOOK）

> 这是新接手的 AI coder **第一个**要读的文件。读完应知道：这是什么、现在到哪了、目录在哪、怎么开始干活。
> 配套必读：`.coder-protocol.md`（协议）、`PLAN.md`（规划）、`TASKS.md`（看板）、`LOG.md`（日志）、`STATE.md`（状态）。

## 这是什么

**Planner** 是一个基于 Web 的 **4DGS 拍摄规划仿真系统**。用户在 3D 场景里**拖放**摄像机、灯光、环境、被拍主体，系统仿真拍摄效果，评估**覆盖度/盲区/重叠率**，生成**拍摄清单与仿真数据**（transforms.json / COLMAP），用于指导 4D 高斯泼溅（4DGS）/3DGS 的真实采集。

## 技术栈（已定）

- **渲染**：Three.js + React Three Fiber (R3F) + @react-three/drei
- **状态**：Zustand（单一 store，切片组合）
- **UI**：Tailwind CSS + 少量 CSS 变量；深色专业工具风（类 Blender/Houdini/Unreal）
- **构建**：Vite + TypeScript
- **测试**：Vitest（sim/export 纯函数）+ Playwright（端到端，后期）
- **虚拟列表**：@tanstack/react-virtual

> ⚠️ 注意：本目录原本是 `playcanvas/editor` 的 git 仓库克隆，工作区文件已被清空（只剩 `.git`）。**本项目不复用 playcanvas 代码**，从零搭建。已删除的文件保持删除状态即可，不要 restore。

## 目录地图

```
Planner/
├── HANDBOOK.md            ← 你在这里：上手指南
├── .coder-protocol.md     ← 多 coder 协作协议（权威）
├── PLAN.md                ← 总体规划 + 里程碑 + 验收
├── TASKS.md               ← 任务看板（领取/进行/完成）
├── LOG.md                 ← 共享时间线日志（倒序追加）
├── STATE.md               ← 当前世界状态快照
├── docs/
│   ├── architecture.md    ← 架构与数据流
│   └── notes/<module>.md  ← 模块级设计笔记
├── .agents/skills/        ← 4 个项目技能（见下）
└── src/                   ← （待建）源码，分层见 planner-conventions
    ├── app/ scene/ panels/ sim/ export/ io/ lib/ types/ state/
```

## 项目技能（每个 coder 必读相关项）

位于 `.agents/skills/`，ZCode 会按描述自动触发：

1. **planner-conventions** —— 编码约定与架构分层。**写任何代码前必读。**
2. **coder-handoff** —— 多 coder 协作与日志。**接手第一件事必读。**
3. **ue5-ui-reference** —— 视觉/交互**最高准则**：严格参考 Unreal Editor 5.8（颜色/字体/布局/控件/交互）。做任何 UI（`src/styles`/`src/panels`/`src/scene` 视觉）前必读。
4. **4dgs-capture** —— 4DGS 采集领域知识（覆盖/重叠/曝光/导出格式）。做 `sim/`、`export/` 时读。
5. **scene-edit-interactions** —— 3D 编辑器交互逻辑。做 `scene/`、`panels/` 时读。

## 怎么开始（新 coder 上手 6 步）

1. 读本文件 + `.coder-protocol.md` + `STATE.md`（确认当前阶段）。
2. 读 `LOG.md` 顶部最近 20 行（知道刚发生了什么）。
3. 读 `TASKS.md`，挑一个 **Backlog 且依赖已满足** 的任务。
4. 建分支 `T-NNN/<slug>`，在 LOG 追加 `START` 行。
5. 开发，遵守 `planner-conventions`；每个有意义步骤追加 LOG。
6. 完成 → 跑 `typecheck/test/lint` → 追加 `DONE` → 更新 `TASKS.md`/`STATE.md` → push/PR →（结束则）`HANDOFF`。

## 当前阶段（详见 STATE.md，以 STATE.md 为准）

**Phase 0：规划与协议就绪**（本次会话产物）。下一步进入 **Phase 1：脚手架与类型**。尚无 `src/`，`npm run dev` 不可用。

## 快速命令（Phase 1 完成后生效）

```bash
npm install
npm run dev          # Vite 开发服
npm run typecheck    # tsc --noEmit
npm run test         # Vitest
npm run lint         # ESLint
```

## 沟通约定

- 有疑问写进 `LOG.md` 的 `NOTE`，@ 相关 coder；不要私改别人 Doing 中的任务。
- 决策写 `DECISION`（含原因）；坑写 `NOTE`。
- 时间戳一律 UTC ISO8601。
