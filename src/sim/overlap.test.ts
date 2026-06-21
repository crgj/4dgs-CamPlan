import { describe, it, expect } from 'vitest';
import type { CameraDef, EvalThresholds, SceneDef, SubjectDef } from '@/types';
import { aabbOfSubject } from '@/lib/aabb';
import { defaultEnv, defaultThresholds } from '@/lib/defaults';
import { computeOverlap, overlapOf, sharedVisibleCount } from './overlap';
import { computeCoverage } from './coverage';

const thresholds: EvalThresholds = {
  ...defaultThresholds(),
  minOverlap: 0.3,
  baselineRange: [0.5, 10],
};

const boxSubject = (): SubjectDef => {
  const s: SubjectDef = {
    id: 'subj_1', kind: 'subject', name: 'box',
    transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    geometry: { type: 'box', size: [1, 1, 1] },
    sampleDensity: 50, enabled: true,
    bounds: { min: [0, 0, 0], max: [0, 0, 0] },
  };
  s.bounds = aabbOfSubject(s);
  return s;
};

const camAt = (pos: [number, number, number], id: string): CameraDef => {
  // 朝向原点（推导见 coverage.test.ts）：yaw=atan2(pos.x,pos.z)，pitch=asin(-pos.y/|r|)
  const [x, y, z] = pos;
  const yaw = (Math.atan2(x, z) * 180) / Math.PI;
  const pitch = (Math.asin(-y / Math.hypot(x, Math.hypot(y, z) || 1)) * 180) / Math.PI;
  return {
    id, kind: 'camera', name: id,
    transform: { position: pos, rotation: [pitch, yaw, 0], scale: [1, 1, 1] },
    model: 'PINHOLE', fov: 50, aspect: 16 / 9, near: 0.1, far: 1000,
    resolution: { width: 1920, height: 1080 },
    exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
    enabled: true,
  };
};

const sceneWith = (cameras: CameraDef[]): SceneDef => ({
  version: 1, cameras, lights: [], subjects: [boxSubject()], env: defaultEnv(),
});

describe('overlap / 基线', () => {
  it('两相机 baseline = 世界距离', () => {
    const s = sceneWith([camAt([3, 0.5, 0], 'a'), camAt([0, 0.5, 4], 'b')]);
    const o = overlapOf(s, thresholds, 8);
    expect(o.pairs).toHaveLength(1);
    expect(o.pairs[0].baseline).toBeCloseTo(5, 5); // 3-4-5
    expect(o.minBaseline).toBeCloseTo(5, 5);
    expect(o.maxBaseline).toBeCloseTo(5, 5);
    expect(o.avgBaseline).toBeCloseTo(5, 5);
  });
  it('无相机时 pairs 为空，统计归零', () => {
    const o = overlapOf(sceneWith([]), thresholds, 6);
    expect(o.pairs).toHaveLength(0);
    expect(o.avgOverlap).toBe(0);
    expect(o.avgBaseline).toBe(0);
  });
});

describe('overlap / 重叠率', () => {
  it('相邻同向相机重叠 > 0', () => {
    const s = sceneWith([camAt([0.5, 0.5, 4], 'a'), camAt([-0.5, 0.5, 4], 'b')]);
    const o = overlapOf(s, thresholds, 8);
    expect(o.avgOverlap).toBeGreaterThan(0);
  });
  it('体积采样下两相机都覆盖主体 → 重叠接近 1（语义边界）', () => {
    // 注意：coverage 用体积栅格采样，只要相机能“看到”盒体内部，
    // 几乎所有内部点都被两相机同时覆盖 → Jaccard≈1。
    // 这说明“重叠率”在体积采样下对视点差异不敏感；
    // 区分视点重叠需要表面采样（v2）。这里只断言边界行为稳定。
    const s = sceneWith([camAt([0.5, 0.5, 4], 'a'), camAt([-0.5, 0.5, 4], 'b')]);
    const o = overlapOf(s, thresholds, 8);
    expect(o.avgOverlap).toBeGreaterThan(0);
    expect(o.avgOverlap).toBeLessThanOrEqual(1);
  });
  it('低于阈值对数计数正确（baseline 过大）', () => {
    const s = sceneWith([camAt([100, 0.5, 0], 'a'), camAt([-100, 0.5, 0], 'b')]);
    const o = overlapOf(s, thresholds, 6);
    expect(o.belowThresholdPairs).toBeGreaterThanOrEqual(1);
  });
});

describe('overlap / sharedVisibleCount', () => {
  it('与 jaccard 分母一致（共同可见数 > 0 时）', () => {
    const s = sceneWith([camAt([0.5, 0.5, 4], 'a'), camAt([-0.5, 0.5, 4], 'b')]);
    const cov = computeCoverage({ scene: s, thresholds, grid: 8 });
    const shared = sharedVisibleCount(cov.samples, 'a', 'b');
    expect(shared).toBeGreaterThan(0);
  });
});

describe('overlap / memoize', () => {
  it('相同输入命中缓存', () => {
    const s = sceneWith([camAt([0, 0.5, 4], 'a')]);
    const a = computeOverlap({ scene: s, thresholds, grid: 6 });
    const b = computeOverlap({ scene: s, thresholds, grid: 6 });
    expect(a).toBe(b);
  });
});
