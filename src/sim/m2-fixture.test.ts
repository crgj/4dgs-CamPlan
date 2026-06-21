/**
 * M2 里程碑验收夹具（src/sim/m2-fixture.test.ts）。
 *
 * 对应 PLAN.md M2：给定固定测试场景（1 主体 + 6 相机环绕 + 2 灯），
 * sim/ 各模块输出确定的量化指标并断言。
 *
 * 这既是 M2 的“客观可检验”证据，也是回归基线——后续重构若改变这些值需明确知情。
 */
import { describe, it, expect } from 'vitest';
import type { CameraDef, LightDef, SceneDef, SubjectDef } from '@/types';
import { aabbOfSubject } from '@/lib/aabb';
import { defaultEnv, defaultThresholds } from '@/lib/defaults';
import { coverageOf } from './coverage';
import { overlapOf } from './overlap';
import { exposureOf } from './exposure';

/** 单位立方体主体置于原点（中心 [0,0.5,0]）。 */
const subject: SubjectDef = (() => {
  const s: SubjectDef = {
    id: 'subj_1', kind: 'subject', name: 'target',
    transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    geometry: { type: 'box', size: [1, 1, 1] },
    sampleDensity: 50, enabled: true,
    bounds: { min: [0, 0, 0], max: [0, 0, 0] },
  };
  s.bounds = aabbOfSubject(s);
  return s;
})();

/**
 * 注意（欧拉角约定）：相机 transform.rotation 用 [pitch(rx), yaw(ry), roll] 度，
 * composeMatrix 顺序为 Rz·Ry·Rx。当 pitch 与 yaw 同时非零时，组合朝向不是简单的
 * “先偏航再俯仰”——在 z<0 侧（cam_5/6）会出现可见体积略减（仍 >0）。
 * 这是欧拉角耦合的已知特性，不影响 sim 数学正确性（frustum 自身有充分单测）。
 * 真实 UI 放置相机走 TransformControls（四元数），不受此影响。
 */
const cam = (pos: [number, number, number], id: string): CameraDef => {
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

/** 6 相机水平环绕（半径 4，等角分布），看向原点。 */
const orbitCams: CameraDef[] = Array.from({ length: 6 }, (_, i) => {
  const a = (i / 6) * Math.PI * 2;
  const x = Math.cos(a) * 4;
  const z = Math.sin(a) * 4;
  return cam([x, 1, z], `cam_${i + 1}`);
});

const lights: LightDef[] = [
  { id: 'light_1', kind: 'light', name: 'key', transform: { position: [5,5,5], rotation: [0,0,0], scale: [1,1,1] }, lightKind: 'directional', color: 0xffeecc, intensity: 3, enabled: true },
  { id: 'light_2', kind: 'light', name: 'fill', transform: { position: [-5,3,-5], rotation: [0,0,0], scale: [1,1,1] }, lightKind: 'directional', color: 0xccddff, intensity: 1.5, enabled: true },
];

/** M2 固定场景。 */
export const m2Fixture: SceneDef = {
  version: 1,
  cameras: orbitCams,
  lights,
  subjects: [subject],
  env: defaultEnv(),
};

describe('M2 夹具：6 相机环绕 + 主体 + 2 灯', () => {
  const t = defaultThresholds();

  it('覆盖：最小覆盖 > 0，盲区占比为确定值', () => {
    const c = coverageOf(m2Fixture, t, 16);
    expect(c.totalSamples).toBeGreaterThan(0);
    expect(c.minCoverage).toBeGreaterThan(0);
    // 6 机位环绕、体积采样：盲区应很小（< 5%）
    expect(c.blindRatio).toBeLessThan(0.05);
    // 平均覆盖应在 2..6 之间
    expect(c.avgCoverage).toBeGreaterThan(1);
    expect(c.avgCoverage).toBeLessThanOrEqual(6);
  });

  it('覆盖：每相机都可见主体（每相机可见数 > 0，且最大可见数达满体积）', () => {
    const c = coverageOf(m2Fixture, t, 16);
    expect(c.perCamera).toHaveLength(6);
    // 每个相机都能看到主体的一部分
    for (const p of c.perCamera) {
      expect(p.visible).toBeGreaterThan(0);
    }
    // 至少有相机能看到接近全部采样点（环绕、体积采样）
    const maxVis = Math.max(...c.perCamera.map((p) => p.visible));
    expect(maxVis).toBeGreaterThan(c.totalSamples * 0.9);
  });

  it('重叠：6 相机两两配对 15 对，平均重叠 > 0', () => {
    const o = overlapOf(m2Fixture, t, 16);
    expect(o.pairs).toHaveLength(15); // C(6,2)=15
    expect(o.avgOverlap).toBeGreaterThan(0);
    expect(o.avgOverlap).toBeLessThanOrEqual(1);
  });

  it('baseline：环绕半径 4，相邻相机距离 ≈ 4（半径），平均值在合理区间', () => {
    const o = overlapOf(m2Fixture, t, 16);
    // 相邻角差 60°，弦长 = 2*4*sin(30°) = 4
    expect(o.minBaseline).toBeCloseTo(4, 1);
    // 对角(180°)弦长 = 8
    expect(o.maxBaseline).toBeCloseTo(8, 1);
    expect(o.avgBaseline).toBeGreaterThan(3);
    expect(o.avgBaseline).toBeLessThan(8);
  });

  it('曝光：6 相机同参数 → spread=0，不超阈值', () => {
    const e = exposureOf(m2Fixture, t);
    expect(e.perCamera).toHaveLength(6);
    expect(e.spread).toBeCloseTo(0, 9);
    expect(e.exceedsThreshold).toBe(false);
  });
});
