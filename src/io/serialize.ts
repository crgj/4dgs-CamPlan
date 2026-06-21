// T-020 场景序列化（src/io/serialize.ts）。
// 纯 TS。把 SceneDef 序列化为 .planner.json（含 schema 版本），并可无损加载。
// 加载时做版本兼容校验：版本不同时尝试迁移（v1 无需迁移），不兼容则抛错。

import type { SceneDef } from '@/types';
import { SCHEMA_VERSION } from '@/lib/defaults';

/** .planner.json 文件结构。 */
export interface PlannerFile {
  /** 文件格式标识。 */
  kind: 'planner';
  /** schema 版本。 */
  version: number;
  /** 生成时间（UTC ISO）。 */
  savedAt: string;
  /** 场景数据。 */
  scene: SceneDef;
}

/** 序列化为 JSON 字符串。 */
export function serializeScene(scene: SceneDef): string {
  const file: PlannerFile = {
    kind: 'planner',
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    scene: { ...scene, version: SCHEMA_VERSION },
  };
  return JSON.stringify(file, null, 2);
}

/** 解析 .planner.json 为 SceneDef（含版本校验/迁移）。 */
export function deserializeScene(json: string): SceneDef {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Planner 文件不是合法 JSON');
  }
  const file = parsed as Partial<PlannerFile>;
  if (!file || file.kind !== 'planner' || !file.scene) {
    throw new Error('不是有效的 .planner.json（缺 kind/scene）');
  }
  if (typeof file.version !== 'number') {
    throw new Error('缺少 version 字段');
  }
  const scene = migrate(file.scene as SceneDef, file.version);
  return { ...scene, version: SCHEMA_VERSION };
}

/** 版本迁移表（当前仅 v1，预留扩展）。 */
function migrate(scene: SceneDef, fromVersion: number): SceneDef {
  const s = scene;
  // 未来: if (fromVersion < 2) s = v1_to_v2(s);
  if (fromVersion > SCHEMA_VERSION) {
    throw new Error(
      `文件版本 ${fromVersion} 高于当前支持 ${SCHEMA_VERSION}，请升级 Planner`,
    );
  }
  return s;
}

/** 校验 SceneDef 结构完整性（关键字段非空、类型对）。返回错误列表（空=通过）。 */
export function validateScene(scene: unknown): string[] {
  const errors: string[] = [];
  const s = scene as Partial<SceneDef>;
  if (!s) return ['scene 为空'];
  if (!Array.isArray(s.cameras)) errors.push('cameras 应为数组');
  if (!Array.isArray(s.lights)) errors.push('lights 应为数组');
  if (!Array.isArray(s.subjects)) errors.push('subjects 应为数组');
  // groups 可选（旧文件无此字段），存在则需为数组
  if (s.groups !== undefined && !Array.isArray(s.groups)) errors.push('groups 应为数组');
  if (!s.env || typeof s.env !== 'object') errors.push('env 缺失');
  // 抽样校验相机
  if (Array.isArray(s.cameras)) {
    s.cameras.forEach((c, i) => {
      if (!c.id || !c.transform || typeof c.fov !== 'number') {
        errors.push(`cameras[${i}] 字段不完整`);
      }
    });
  }
  return errors;
}

/** 触发浏览器下载（UI 用）。 */
export function downloadPlannerFile(scene: SceneDef, filename = 'scene.planner.json'): void {
  const blob = new Blob([serializeScene(scene)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
