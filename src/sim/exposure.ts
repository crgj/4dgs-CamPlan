/**
 * 曝光一致性（src/sim/exposure.ts）。
 *
 * 输入：SceneDef（cameras）+ 阈值。
 * 输出：ExposureStats（每相机等价曝光值 EV、阵列极差/标准差、是否超阈值）。
 *
 * 等价曝光值 EV（relative，仅用于阵列一致性比较，绝对标定非 v1 目标）：
 *   EV = log2( N² / t ) − log2( ISO / 100 )
 *   N=光圈, t=快门(秒), ISO=感光度。
 *   EV 越大画面越暗（同场景）。阵列内 EV 极差大 → 曝光不一致 → 重建风险。
 *
 * 说明：灯光强度对最终成像亮度也有影响，但 v1 仅评估“相机曝光参数一致性”
 * （多机阵列应锁定同一曝光组）。灯光-曝光联合评估列 v2。
 *
 * 纯 TS，不依赖 react/three。
 */
import type {
  CameraDef,
  EvalThresholds,
  ExposureStats,
  SceneDef,
} from '@/types';
import { memoize } from '@/lib/memo';

export interface ExposureInput {
  scene: SceneDef;
  thresholds: EvalThresholds;
}

/** 单相机等价曝光值 EV = log2(N²/t) − log2(ISO/100)。 */
export function cameraEV(cam: CameraDef): number {
  const { aperture: N, shutter: t, iso } = cam.exposure;
  if (t <= 0 || N <= 0 || iso <= 0) return 0;
  return Math.log2((N * N) / t) - Math.log2(iso / 100);
}

/**
 * 计算阵列曝光一致性。结果 memoize。
 */
export const computeExposure = memoize((input: ExposureInput): ExposureStats => {
  const cams = input.scene.cameras.filter((c) => c.enabled);
  const perCamera = cams.map((c) => ({ id: c.id, ev: cameraEV(c) }));
  const evs = perCamera.map((p) => p.ev);

  const n = evs.length;
  const mean = n === 0 ? 0 : evs.reduce((s, x) => s + x, 0) / n;
  const spread = n === 0 ? 0 : Math.max(...evs) - Math.min(...evs);
  const variance =
    n === 0 ? 0 : evs.reduce((s, x) => s + (x - mean) ** 2, 0) / n;
  const stddev = Math.sqrt(variance);

  return {
    perCamera,
    spread,
    stddev,
    exceedsThreshold: spread > input.thresholds.maxExposureSpread,
  };
});

/** 便捷封装。 */
export const exposureOf = (scene: SceneDef, thresholds: EvalThresholds): ExposureStats =>
  computeExposure({ scene, thresholds });
