/**
 * T-042 SfM/4DGS 重建可行性评估（src/sim/reconstructability.ts）。
 * 综合覆盖度、重叠率、基线范围、GSD 一致性，给出 0..1 的可重建性分数与分级建议。
 * 纯函数，依赖现有 coverage/overlap 模块。
 */
import type { SceneDef, Vec3 } from '@/types';
import type { EvalThresholds } from '@/types';
import { coverageOf } from './coverage';
import { overlapOf } from './overlap';
import { exposureOf } from './exposure';
import { groundSampleDistance } from '@/lib/cameraPresets';
import { aabbCenter } from '@/lib/aabb';

export type ReconstructabilityGrade = 'excellent' | 'good' | 'marginal' | 'poor';

export interface ReconstructabilityReport {
  /** 综合 0..1，越高越易重建。 */
  score: number;
  grade: ReconstructabilityGrade;
  /** 各子项 0..1。 */
  factors: {
    coverage: number;
    overlap: number;
    baseline: number;
    exposure: number;
    gsdConsistency: number;
  };
  /** 人可读的问题列表。 */
  issues: string[];
}

/**
 * 评估场景的可重建性。
 * @param resolution 采样栅格分辨率（与 coverage 一致）
 */
export function assessReconstructability(
  scene: SceneDef,
  thresholds: EvalThresholds,
  resolution = 16,
): ReconstructabilityReport {
  const issues: string[] = [];
  const activeCams = scene.cameras.filter((c) => c.enabled);

  if (activeCams.length < 3) {
    issues.push('SfM 至少需要 3 个视角，当前启用相机不足');
    return {
      score: 0,
      grade: 'poor',
      factors: { coverage: 0, overlap: 0, baseline: 0, exposure: 0, gsdConsistency: 1 },
      issues,
    };
  }

  // 1. 覆盖度因子
  const cov = coverageOf(scene, thresholds, resolution);
  const coverageScore = Math.max(0, 1 - cov.blindRatio * 4) * Math.min(1, cov.avgCoverage / Math.max(1, thresholds.minCoverage));
  if (cov.blindRatio > 0.1) issues.push(`盲区过大 (${(cov.blindRatio * 100).toFixed(1)}%)，存在无法重建区域`);

  // 2. 重叠因子
  const ov = overlapOf(scene, thresholds, resolution);
  const totalPairs = activeCams.length * (activeCams.length - 1) / 2;
  const overlapScore = totalPairs > 0 ? 1 - ov.belowThresholdPairs / totalPairs : 0;
  if (ov.belowThresholdPairs > 0) issues.push(`${ov.belowThresholdPairs} 对相机重叠不足，特征匹配可能失败`);

  // 3. 基线因子：相邻相机间距应在 [min,max] 范围内
  const baselines = computeBaselines(activeCams.map((c) => c.transform.position));
  const [minB, maxB] = thresholds.baselineRange;
  const inRange = baselines.filter((b) => b >= minB && b <= maxB).length;
  const baselineScore = baselines.length > 0 ? inRange / baselines.length : 0;
  if (baselineScore < 0.7) issues.push(`仅 ${(baselineScore * 100).toFixed(0)}% 相邻基线在合理范围 [${minB}, ${maxB}]m`);

  // 4. 曝光因子
  const exp = exposureOf(scene, thresholds);
  const exposureScore = exp.exceedsThreshold ? 0.4 : 1;
  if (exp.exceedsThreshold) issues.push(`曝光极差 ${exp.spread.toFixed(2)} EV 超阈值，影响特征一致性`);

  // 5. GSD 一致性（相机到主体距离 + 分辨率应相近）
  const gsdConsistency = computeGsdConsistency(activeCams, scene);
  if (gsdConsistency < 0.7) issues.push('相机到主体距离差异大，GSD 不一致，细节重建质量不均');

  // 加权综合
  const score =
    coverageScore * 0.35 +
    overlapScore * 0.30 +
    baselineScore * 0.20 +
    exposureScore * 0.10 +
    gsdConsistency * 0.05;

  const grade: ReconstructabilityGrade =
    score >= 0.85 ? 'excellent' : score >= 0.65 ? 'good' : score >= 0.4 ? 'marginal' : 'poor';

  return {
    score,
    grade,
    factors: {
      coverage: coverageScore,
      overlap: overlapScore,
      baseline: baselineScore,
      exposure: exposureScore,
      gsdConsistency,
    },
    issues,
  };
}

/** 计算按角度排序后相邻相机的基线（欧氏距离）。 */
function computeBaselines(positions: readonly Vec3[]): number[] {
  if (positions.length < 2) return [];
  // 按相对原点的方位角排序，使"相邻"语义稳定
  const sorted = [...positions].sort((a, b) => Math.atan2(a[2], a[0]) - Math.atan2(b[2], b[0]));
  const baselines: number[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const next = sorted[(i + 1) % sorted.length];
    baselines.push(Math.hypot(next[0] - sorted[i][0], next[1] - sorted[i][1], next[2] - sorted[i][2]));
  }
  return baselines;
}

/** GSD 一致性：计算每台相机到主体中心的 GSD，返回 1 - 变异系数。 */
function computeGsdConsistency(
  cams: ReadonlyArray<{
    transform: { position: Vec3 };
    focalLength?: number;
    sensorWidth?: number;
    resolution: { width: number };
  }>,
  scene: SceneDef,
): number {
  if (cams.length === 0 || scene.subjects.length === 0) return 1;
  const center = aabbCenter(scene.subjects[0].bounds);
  const gsds = cams.map((c) => {
    const dist = Math.hypot(
      c.transform.position[0] - center[0],
      c.transform.position[1] - center[1],
      c.transform.position[2] - center[2],
    );
    return groundSampleDistance(dist, c.sensorWidth ?? 36, c.focalLength ?? 35, c.resolution.width);
  });
  const mean = gsds.reduce((a, b) => a + b, 0) / gsds.length;
  if (mean < 1e-9) return 1;
  const variance = gsds.reduce((a, b) => a + (b - mean) ** 2, 0) / gsds.length;
  const cv = Math.sqrt(variance) / mean; // 变异系数
  return Math.max(0, 1 - cv);
}
