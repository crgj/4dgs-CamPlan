/**
 * 类型 barrel（src/types/index.ts）。
 * 全项目统一从 `@/types` 导入：`import type { CameraDef, SceneDef } from '@/types'`。
 *
 * 分文件：
 * - common.ts   基础类型（Vec3/Transform/AABB/EntityId/ColorHex/Timed）
 * - entities.ts 实体与场景（CameraDef/LightDef/SubjectDef/EnvDef/SceneDef + 阈值）
 * - eval.ts     仿真输出契约（CoverageStats/OverlapStats/ExposureStats/CaptureList）
 *
 * 维护规则（.coder-protocol.md §7）：
 * - 这是高风险共享区。改前在 LOG 发 DECISION。
 * - 优先**追加可选字段**而非修改已有字段签名，保持向后兼容。
 */
export * from './common';
export * from './entities';
export * from './eval';
