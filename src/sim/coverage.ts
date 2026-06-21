/**
 * 覆盖度计算（src/sim/coverage.ts）。
 *
 * 输入：SceneDef（cameras + subjects）+ 阈值。
 * 输出：CoverageStats（逐采样点覆盖数 + 盲区/欠覆盖/每相机可见数）。
 *
 * 算法（见 4dgs-capture 技能）：
 * 1. 对每个启用的主体，在其世界 AABB 内做栅格采样（默认 256³ 上限，按主体最长边归一）。
 * 2. 对每个采样点，统计有多少**启用**相机的视锥包含它。
 *    遮挡：v1 用**保守近似**——若采样点在某主体 AABB 内部，则视为被该主体遮挡（剔除）。
 *    这对外侧表面覆盖评估足够；精确光线投射列 v2（见文件尾注释）。
 * 3. 汇总最小/最大/平均覆盖、盲区占比、欠覆盖占比、每相机可见采样数。
 *
 * 纯 TS，不依赖 react/three。角度换算只在 lib/math（经 frustum 间接）。
 */
import type {
	  CameraDef,
	  CoverageSample,
	  CoverageStats,
	  EvalThresholds,
	  AnyEntity,
	  SceneDef,
	  SubjectDef,
	  Vec3,
} from '@/types';
import { pointVisibleToCamera } from './frustum';
import {
  aabbSize,
  pointInAABB,
} from '@/lib/aabb';
import { memoize } from '@/lib/memo';

/** 栅格采样分辨率上限（每轴最大点数）。默认在 thresholds/调用方可覆盖。 */
export const DEFAULT_GRID = 64;

/**
 * 在主体 AABB 内生成栅格采样点（仅 AABB 内部，不含边界外）。
 * 按最长边归一到 grid 点，其余轴按比例。采样点数 ≈ grid³ ×（体积占比）。
 */
export function sampleSubjectVolume(subject: SubjectDef, grid: number): Vec3[] {
  const size = aabbSize(subject.bounds);
  const longest = Math.max(size[0], size[1], size[2]) || 1;
  const nx = Math.max(2, Math.round((size[0] / longest) * grid));
  const ny = Math.max(2, Math.round((size[1] / longest) * grid));
  const nz = Math.max(2, Math.round((size[2] / longest) * grid));
  const c = subject.bounds.min;
  const pts: Vec3[] = [];
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      for (let k = 0; k < nz; k++) {
        // 取每个格子的中心，避免重复落在边界
        const x = c[0] + (size[0] * (i + 0.5)) / nx;
        const y = c[1] + (size[1] * (j + 0.5)) / ny;
        const z = c[2] + (size[2] * (k + 0.5)) / nz;
        pts.push([x, y, z]);
      }
    }
  }
  return pts;
}

/**
 * 计算单主体覆盖（不含跨主体遮挡）。
 * @param subject 目标主体。
 * @param occluders 可能遮挡的其他主体（含自身则视为对自身内部遮挡，通常应排除自身）。
 * @param cameras 相机列表（仅 enabled 的会被使用）。
 * @param grid 栅格分辨率。
 */
export function coverageForSubject(
  subject: SubjectDef,
  occluders: readonly SubjectDef[],
  cameras: readonly CameraDef[],
  grid: number,
	  // #WDD-gpt  2026-06-19 - 覆盖计算的层级实体参数改为 AnyEntity[]，保持纯 TS 类型契约
	  allEntities?: AnyEntity[],
): CoverageSample[] {
  const samples = sampleSubjectVolume(subject, grid);
  const activeCams = cameras.filter((c) => c.enabled);
  return samples.map((p) => {
    const by: string[] = [];
    for (const cam of activeCams) {
      if (!pointVisibleToCamera(cam, p, allEntities)) continue;
      // 遮挡近似：被任一遮挡主体的 AABB 包含（且点在该主体内部）则剔除该相机对该点的覆盖
      let occluded = false;
      for (const oc of occluders) {
        if (oc.id === subject.id) continue; // 不让主体遮挡自身
        if (!oc.enabled) continue;
        if (pointInAABB(p, oc.bounds)) {
          occluded = true;
          break;
        }
      }
      if (occluded) continue;
      by.push(cam.id);
    }
    return { position: p, count: by.length, by };
  });
}

/** 合并多个主体的覆盖采样点。 */
function flatten(samples: CoverageSample[][]): CoverageSample[] {
  // WDD -gemini 2026-06-19 修复多采样点时 out.push(...s) 展开运算符导致 Maximum call stack size exceeded 的问题
  const out: CoverageSample[] = [];
  for (const s of samples) {
    for (const item of s) {
      out.push(item);
    }
  }
  return out;
}

/**
 * 覆盖度评估输入（便于 memoize 以“场景哈希 + 阈值 + grid”为键）。
 */
export interface CoverageInput {
  scene: SceneDef;
  thresholds: EvalThresholds;
  /** 栅格分辨率（可选，默认 DEFAULT_GRID）。 */
  grid?: number;
}

/**
 * 计算整个场景的覆盖度统计。
 * 输出盲区/欠覆盖/每相机可见数。结果用 memoize 缓存（依赖 input 哈希）。
 */
export const computeCoverage = memoize((input: CoverageInput): CoverageStats => {
  const { scene, thresholds } = input;
  const grid = input.grid ?? DEFAULT_GRID;
  const subjects = scene.subjects.filter((s) => s.enabled);
  const cameras = scene.cameras;

  const allEntities = [
    ...scene.cameras,
    ...scene.lights,
    ...scene.subjects,
  ];

  const perSubject = subjects.map((s) =>
    coverageForSubject(s, subjects, cameras, grid, allEntities),
  );
  const samples = flatten(perSubject);
  const total = samples.length;

  let min = Infinity;
  let max = 0;
  let sum = 0;
  let blind = 0;
  let under = 0;
  const camVisible = new Map<string, number>();

  for (const s of samples) {
    const n = s.count;
    if (n < min) min = n;
    if (n > max) max = n;
    sum += n;
    if (n === 0) blind++;
    if (n < thresholds.minCoverage) under++;
    if (s.by) for (const id of s.by) camVisible.set(id, (camVisible.get(id) ?? 0) + 1);
  }

  if (total === 0) {
    min = 0;
  }

  const perCamera = [...camVisible.entries()]
    .map(([id, visible]) => ({ id, visible }))
    .sort((a, b) => b.visible - a.visible);

  return {
    totalSamples: total,
    samples,
    minCoverage: min === Infinity ? 0 : min,
    maxCoverage: max,
    avgCoverage: total === 0 ? 0 : sum / total,
    blindRatio: total === 0 ? 0 : blind / total,
    underCoveredRatio: total === 0 ? 0 : under / total,
    perCamera,
  };
});

/** 便捷：给定场景算覆盖（用默认阈值，便于测试与 UI 快速调用）。 */
export const coverageOf = (
  scene: SceneDef,
  thresholds: EvalThresholds,
  grid?: number,
): CoverageStats =>
  computeCoverage({ scene, thresholds, grid });

// v1 遮挡近似说明：
// 当前用“AABB 包含即遮挡”，对凸主体（box）外侧表面覆盖评估基本正确，
// 但对凹形/多主体交叠会有偏差；且只判“点在某 occluder 的 AABB 内”，
// 不判 occluder 是否真在“相机→采样点”视线上。精确方案需对每条相机射线做
// 射线-主体求交（v2，用加速结构 BVH）。在覆盖热图与盲区告警里注明此近似。
