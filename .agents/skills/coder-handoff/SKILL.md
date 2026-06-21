---
name: coder-handoff
description: 多个 AI coder 并行/接力开发同一项目（Planner）时的协作规程。强制规定信息交换文件、日志写入、领取任务、交接顺序与冲突避免。当用户提到"多个 coder/agent 协作""交接""handoff""并行开发""按计划推进"或要在本仓库做开发任务时都应触发。任何在本仓库写代码的 coder 必须先读本技能。
---

# 多 AI Coder 协作规程（Planner）

本项目支持多个 AI coder（可能来自不同模型/会话）并行或接力开发。为避免互相覆盖、重复劳动和丢失上下文，**每个 coder 在动手前和动手后都必须读写交接文件与共享日志**。

## 必读文件（每个 coder 接手第一件事）

1. `HANDBOOK.md` —— 项目总览、当前阶段、目录地图。
2. `.coder-protocol.md` —— 信息交换协议（本技能的完整版）。
3. `PLAN.md` —— 总体规划与里程碑。
4. `TASKS.md` —— 任务看板（领取/进行中/完成）。
5. `LOG.md` —— 共享时间线日志（**最重要**，见下）。
6. `docs/architecture.md`、`.agents/skills/planner-conventions/SKILL.md` —— 架构与编码约定。

**动手前先通读以上文件，否则不要开始。**

## 三层信息交换文件

| 文件 | 作用 | 写入时机 |
|------|------|----------|
| `TASKS.md` | 任务看板：Backlog/Doing(id)/Done。每个任务有 id、标题、验收标准、负责 coder。 | 领取时标 Doing、完成时标 Done 并填 commit/产物路径。 |
| `LOG.md` | 共享时间线日志：按时间倒序，每条一行，带 ISO 时间戳与 coder 标识。 | **每完成一个可观察步骤就追加一行**（开始任务/关键决策/遇到阻塞/完成验证）。 |
| `STATE.md` | 当前“世界状态”快照：哪个阶段、哪些模块可跑、已知问题、下一步指针。 | 每次显著进展或交接时整体更新。 |

另有每模块 `NOTES.md`（放在各模块目录或 `docs/notes/<module>.md`），记录该模块的设计决策与坑，供后来者参考。

## LOG.md 一行日志格式（强制）

```
[2026-06-19T07:21:33Z] [glm-5.2/crgj] START task-012: 视锥栅格化覆盖计数 | 文件: src/sim/coverage.ts(新建)
[2026-06-19T07:55:10Z] [glm-5.2/crgj] DECISION 覆盖栅格分辨率默认 256³，按主体 AABB 归一化 | 原因: 平衡精度与性能
[2026-06-19T08:12:00Z] [glm-5.2/crgj] DONE task-012 | tests: coverage.test.ts 18 passed | commit: a1b2c3d
[2026-06-19T08:13:05Z] [glm-5.2/crgj] BLOCKED task-014 依赖 transforms.json schema 未定，等待 task-007
```

行首标签取值：`START | PROGRESS | DECISION | BLOCKED | UNBLOCK | DONE | HANDOFF | NOTE`。

- **时间戳**用 UTC ISO8601（`date -u +%Y-%m-%dT%H:%M:%SZ`）。
- **coder 标识**：`<模型或代号>/<操作者>`，例如 `glm-5.2/crgj`、`claude-sonnet-4/alice`。多 coder 时这是区分彼此的唯一依据。
- **追加到文件顶部**（最新在上），用原子写避免并发截断（见下）。
- 不要删别人的日志；只追加。

## 领取任务流程

1. 读 `TASKS.md`，从 Backlog 选一个**未被领取**且**依赖已满足**的任务。
2. 用原子操作把该任务从 Backlog 移到 Doing 并写上你的 coder 标识与起始时间：
   ```bash
   # 原子领取：写临时文件再 mv，避免并发互相覆盖
   flock TASKS.lock -c '...编辑 TASKS.md...'   # 或用 git 风格：先 pull，改完 commit
   ```
   推荐简单做法：**每个 coder 在独立 git 分支工作**（`task-012/coverage`），领取即建分支，完成即开 PR 合回 main，靠 git 做并发控制。
3. 在 `LOG.md` 顶部追加一行 `START task-...`。
4. 开发，遵守 `planner-conventions`。
5. 完成 → 跑测试/校验（见 PLAN.md 里程碑）→ 追加 `DONE` 日志 → `TASKS.md` 标 Done 并写 commit/产物。

## 避免冲突

- **按模块切分任务边界**，尽量让不同 coder 动不同目录（如一个做 `sim/`，一个做 `panels/`）。
- **共享类型 `src/types/` 是高风险区**：要改类型时，先在 `LOG.md` 发 `DECISION` 声明意图，并尽量用**追加字段**而非修改已有字段，避免破坏其他 coder 的代码。
- 频繁 `git pull --rebase`，小步提交。
- 不要一次重构大范围；重构任务单独成 task 并在 LOG 广播。

## 交接（HANDOFF）检查清单

当你要结束本次会话或把任务交给下一个 coder 时，确保完成：

- [ ] 所有改动已 commit 并 push（或在分支上）
- [ ] `TASKS.md` 状态已更新
- [ ] `LOG.md` 顶部有本次会话的 `HANDOFF` 行，内容包含：未完成事项、下一个 coder 该从哪开始、任何注意事项
- [ ] `STATE.md` 已更新到当前真实状态
- [ ] 测试与类型检查在本地通过（或注明失败原因）
- [ ] 若有阻塞，`BLOCKED` 行已写明等待什么

`HANDOFF` 日志示例：
```
[2026-06-19T09:00:00Z] [glm-5.2/crgj] HANDOFF task-012 完成；task-014 进行到 60%，下一步：完成 transforms 导出 schema 校验，参考 src/export/transforms.ts 当前 TODO。注意 coverage.ts 第 88 行的栅格大小常量需与 export 侧对齐。
```

## 当本技能触发时你应该做的事

1. 先读所有必读文件，确认自己掌握当前世界状态。
2. 领取任务前检查 `TASKS.md` 是否已被别人领取。
3. 每个有意义的步骤都往 `LOG.md` 追加一行——宁可多记，不要断档。
4. 结束前完成 HANDOFF 清单。
5. 任何不确定的事，写进 `LOG.md` 的 `BLOCKED` 或 `NOTE`，让下一个 coder 看到。
