# CamPlan

基于 Web 的 **相机机位规划工具**。在 3D 场景中拖放摄像机阵列、灯光、环境与被拍主体，实时评估视锥、覆盖热图、盲区、重叠率与曝光一致性，并生成拍摄清单与仿真数据（Nerfstudio `transforms.json` / COLMAP 三件套），用于指导 4D/3D 高斯泼溅（4DGS/3DGS）等多视角采集工作。

## 技术栈

Three.js · React Three Fiber · @react-three/drei · Zustand · Tailwind CSS v4 · Vite · TypeScript · Vitest

## 开发

```bash
npm install      # 安装依赖
npm run dev      # 启动开发服 (Vite)
npm run build    # 类型检查 + 生产构建
```

## 质量门禁（提交前三连）

```bash
npm run typecheck   # tsc -b --noEmit
npm run test        # Vitest
npm run lint        # ESLint
```

## 文档

- [HANDBOOK.md](./HANDBOOK.md) — 项目上手手册
- [.coder-protocol.md](./.coder-protocol.md) — 多 AI coder 协作协议
- [PLAN.md](./PLAN.md) — V1 总体规划与里程碑
- [TASKS.md](./TASKS.md) — 任务看板
- [LOG.md](./LOG.md) — 共享时间线日志
- [STATE.md](./STATE.md) — 当前世界状态
- [docs/architecture.md](./docs/architecture.md) — 架构与数据流

## 状态

Phase 1（脚手架与核心数据）开发中。详见 [STATE.md](./STATE.md)。
