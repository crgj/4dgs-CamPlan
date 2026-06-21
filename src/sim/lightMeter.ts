/**
 * T-082 光照度量（src/sim/lightMeter.ts）。
 * 评估场景光照均匀性、过曝高光风险、阴影覆盖率——纯逻辑，不依赖 Three。
 * 用近似模型：每盏灯的贡献按距离平方衰减，统计主体表面采样点的照度分布。
 */
import type { LightDef, SceneDef, SubjectDef } from '@/types';
import { aabbCenter } from '@/lib/aabb';

export interface LightMeterReport {
  /** 主体中心平均照度（相对值）。 */
  avgIlluminance: number;
  /** 照度均匀性 0..1（1=完全均匀）。 */
  uniformity: number;
  /** 过曝风险点占比（照度 > 阈值）。 */
  overexposureRatio: number;
  /** 欠曝风险点占比。 */
  underexposureRatio: number;
}

const SAMPLE_GRID = 6;
const OVER_THRESHOLD = 5.0;
const UNDER_THRESHOLD = 0.3;

/** 单灯在某点的照度贡献（lambert 近似，方向光简化）。 */
function contrib(light: LightDef, point: number[]): number {
  if (!light.enabled) return 0;
  if (light.lightKind === 'directional') return light.intensity * 0.3;
  const lp = light.transform.position;
  const dist = Math.hypot(lp[0] - point[0], lp[1] - point[1], lp[2] - point[2]);
  if (dist < 1e-6) return light.intensity;
  // 点/聚光：平方反比衰减；spot 额外受角度约束（简化为全方向）
  return light.intensity / (dist * dist * 50);
}

/** 评估场景光照。 */
export function meterScene(scene: SceneDef, subject?: SubjectDef): LightMeterReport {
  const subj = subject ?? scene.subjects.find((s) => s.enabled);
  if (!subj || scene.lights.length === 0) {
    return { avgIlluminance: 0, uniformity: 0, overexposureRatio: 0, underexposureRatio: 1 };
  }
  // 在主体 AABB 内采样
  const center = aabbCenter(subj.bounds);
  const size = [
    subj.bounds.max[0] - subj.bounds.min[0],
    subj.bounds.max[1] - subj.bounds.min[1],
    subj.bounds.max[2] - subj.bounds.min[2],
  ];
  const samples: number[] = [];
  for (let i = 0; i < SAMPLE_GRID; i++) {
    for (let j = 0; j < SAMPLE_GRID; j++) {
      for (let k = 0; k < SAMPLE_GRID; k++) {
        const p = [
          center[0] - size[0] / 2 + (size[0] * (i + 0.5)) / SAMPLE_GRID,
          center[1] - size[1] / 2 + (size[1] * (j + 0.5)) / SAMPLE_GRID,
          center[2] - size[2] / 2 + (size[2] * (k + 0.5)) / SAMPLE_GRID,
        ];
        samples.push(scene.lights.reduce((sum, l) => sum + contrib(l, p), 0));
      }
    }
  }

  const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
  const variance = samples.reduce((a, b) => a + (b - avg) ** 2, 0) / samples.length;
  const cv = avg > 1e-9 ? Math.sqrt(variance) / avg : 1;
  const over = samples.filter((s) => s > OVER_THRESHOLD).length;
  const under = samples.filter((s) => s < UNDER_THRESHOLD).length;

  return {
    avgIlluminance: avg,
    uniformity: Math.max(0, 1 - cv),
    overexposureRatio: over / samples.length,
    underexposureRatio: under / samples.length,
  };
}
