/**
 * 重叠率与 baseline 计算（src/sim/overlap.ts）。
 *
 * 输入：SceneDef + 已算好的覆盖采样（或重算）+ 阈值。
 * 输出：OverlapStats（相邻相机对的重叠率与基线、平均/极值、低于阈值对数）。
 *
 * 定义：
 * - 重叠率(overlap) = |A∩B 可见采样| / |A∪B 可见采样|（Jaccard）。
 *   越高表示两相机共同视野越大，利于 SfM 特征匹配（见 4dgs-capture 技能）。
 * - baseline = 两相机世界距离（米）。过大特征匹配失败，过小三角化精度差。
 * - “相邻”对：v1 取所有相机两两组合（O(n²)），n 通常 < 数十，足够。
 *
 * 纯 TS，不依赖 react/three。
 */
import type {
  CoverageSample,
  CoverageStats,
  EvalThresholds,
  OverlapPair,
  OverlapStats,
  SceneDef,
} from '@/types';
import type { CoverageInput } from './coverage';
import { computeCoverage } from './coverage';
import { distance3, getWorldTransform } from '@/lib/math';
import { memoize } from '@/lib/memo';

/** 每个相机可见的采样点索引集合。 */
type VisibleSets = Map<string, Set<number>>;

/** 由覆盖采样构造每相机可见索引集合。 */
function visibleSetsFromCoverage(stats: CoverageStats): VisibleSets {
  const map: VisibleSets = new Map();
  stats.samples.forEach((s, i) => {
    if (!s.by) return;
    for (const camId of s.by) {
      let set = map.get(camId);
      if (!set) {
        set = new Set();
        map.set(camId, set);
      }
      set.add(i);
    }
  });
  return map;
}

/** Jaccard 交并比。 */
function jaccard(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const x of small) if (large.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** 重叠计算的输入 = 覆盖计算的输入（复用其 scene/thresholds/grid）。 */
export type OverlapInput = CoverageInput;

/**
 * 计算重叠与 baseline。
 * 复用覆盖采样（computeCoverage），避免重复栅格化。结果 memoize。
 */
export const computeOverlap = memoize((input: OverlapInput): OverlapStats => {
  const { scene, thresholds } = input;
  const cov: CoverageStats = computeCoverage(input);
  const vis = visibleSetsFromCoverage(cov);

  const cams = scene.cameras.filter((c) => c.enabled);
  const pairs: OverlapPair[] = [];

  const allEntities = [
    ...scene.cameras,
    ...scene.lights,
    ...scene.subjects,
  ];

  for (let i = 0; i < cams.length; i++) {
    for (let j = i + 1; j < cams.length; j++) {
      const a = cams[i];
      const b = cams[j];
      const setA = vis.get(a.id) ?? new Set<number>();
      const setB = vis.get(b.id) ?? new Set<number>();
      const overlap = jaccard(setA, setB);
      
      const posA = getWorldTransform(a, allEntities).position;
      const posB = getWorldTransform(b, allEntities).position;
      const baseline = distance3(posA, posB);
      pairs.push({ a: a.id, b: b.id, overlap, baseline });
    }
  }

  const avgOverlap =
    pairs.length === 0
      ? 0
      : pairs.reduce((s, p) => s + p.overlap, 0) / pairs.length;
  const baselines = pairs.map((p) => p.baseline);
  const avgBaseline =
    baselines.length === 0
      ? 0
      : baselines.reduce((s, x) => s + x, 0) / baselines.length;
  const minBaseline = baselines.length === 0 ? 0 : Math.min(...baselines);
  const maxBaseline = baselines.length === 0 ? 0 : Math.max(...baselines);
  const [bmin, bmax] = thresholds.baselineRange;
  const belowThresholdPairs = pairs.filter(
    (p) => p.overlap < thresholds.minOverlap || p.baseline < bmin || p.baseline > bmax,
  ).length;

  return {
    pairs,
    avgOverlap,
    avgBaseline,
    minBaseline,
    maxBaseline,
    belowThresholdPairs,
  };
});

/** 便捷封装。 */
export const overlapOf = (
  scene: SceneDef,
  thresholds: EvalThresholds,
  grid?: number,
): OverlapStats => computeOverlap({ scene, thresholds, grid });

/** 仅取覆盖采样里的“共同可见”计数（调试/统计用），不构造完整 stats。 */
export function sharedVisibleCount(
  samples: readonly CoverageSample[],
  a: string,
  b: string,
): number {
  let n = 0;
  for (const s of samples) {
    if (s.by && s.by.includes(a) && s.by.includes(b)) n++;
  }
  return n;
}
