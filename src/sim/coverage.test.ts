import { describe, it, expect } from 'vitest';
import type {
  CameraDef,
  EvalThresholds,
  SceneDef,
  SubjectDef,
} from '@/types';
import { aabbOfSubject } from '@/lib/aabb';
import { defaultEnv, defaultThresholds } from '@/lib/defaults';
import {
  computeCoverage,
  coverageForSubject,
  coverageOf,
  sampleSubjectVolume,
} from './coverage';

// --- fixtures ---
const thresholds: EvalThresholds = { ...defaultThresholds(), minCoverage: 3 };

/** 单位立方体主体置于原点。 */
const boxSubject = (overrides?: Partial<SubjectDef>): SubjectDef => {
  const s: SubjectDef = {
    id: 'subj_1',
    kind: 'subject',
    name: 'box',
    transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    geometry: { type: 'box', size: [1, 1, 1] },
    sampleDensity: 50,
    enabled: true,
    bounds: { min: [0, 0, 0], max: [0, 0, 0] },
  };
  s.bounds = aabbOfSubject(s);
  return { ...s, ...overrides };
};

/** 相机：位于指定位置、看向原点（近似）、50° FOV。 */
const camAt = (pos: [number, number, number], id = 'cam_1'): CameraDef => {
  // 让相机朝向原点：相机局部 forward=-Z。yaw/pitch 由 pos→原点 方向反推。
  // 推导（见开发日志）：旋转 [0,0,-1] 绕 Y 得 forward=[-sin(ry),*,-cos(ry)]，
  // 要 forward 指向 -pos 方向 ⇒ yaw=atan2(pos.x, pos.z)；pitch=asin(-pos.y/|xz|)。
  const [x, y, z] = pos;
  const yaw = (Math.atan2(x, z) * 180) / Math.PI;
  const xz = Math.hypot(x, z) || 1;
  const pitch = (Math.asin(-y / Math.hypot(xz, y)) * 180) / Math.PI;
  return {
    id,
    kind: 'camera',
    name: id,
    transform: { position: pos, rotation: [pitch, yaw, 0], scale: [1, 1, 1] },
    model: 'PINHOLE',
    fov: 50,
    aspect: 16 / 9,
    near: 0.1,
    far: 1000,
    resolution: { width: 1920, height: 1080 },
    exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
    enabled: true,
  };
};

const sceneWith = (
  cameras: CameraDef[],
  subjects: SubjectDef[],
): SceneDef => ({
  version: 1,
  cameras,
  lights: [],
  subjects,
  env: defaultEnv(),
});

describe('coverage / sampleSubjectVolume', () => {
  it('生成立方体内部采样点，全在 AABB 内', () => {
    const s = boxSubject();
    const pts = sampleSubjectVolume(s, 8);
    expect(pts.length).toBeGreaterThan(0);
    for (const p of pts) {
      expect(p[0]).toBeGreaterThanOrEqual(s.bounds.min[0]);
      expect(p[0]).toBeLessThanOrEqual(s.bounds.max[0]);
    }
  });
  it('grid 越大点越多', () => {
    const s = boxSubject();
    expect(sampleSubjectVolume(s, 4).length).toBeLessThan(
      sampleSubjectVolume(s, 8).length,
    );
  });
});

describe('coverage / 无相机 → 全盲', () => {
  it('没有相机时所有采样点覆盖为 0，盲区占比 1', () => {
    const scene = sceneWith([], [boxSubject()]);
    const stats = coverageOf(scene, thresholds, 6);
    expect(stats.totalSamples).toBeGreaterThan(0);
    expect(stats.minCoverage).toBe(0);
    expect(stats.maxCoverage).toBe(0);
    expect(stats.blindRatio).toBeCloseTo(1, 6);
    expect(stats.underCoveredRatio).toBeCloseTo(1, 6);
  });
});

describe('coverage / 单相机正对主体', () => {
  it('面对主体的相机给若干采样点正覆盖', () => {
    const scene = sceneWith([camAt([0, 0.5, 4])], [boxSubject()]);
    const stats = coverageOf(scene, thresholds, 8);
    expect(stats.maxCoverage).toBeGreaterThanOrEqual(1);
    expect(stats.perCamera[0].visible).toBeGreaterThan(0);
  });
  it('相机背离主体 → 几乎无覆盖（maxCoverage 较低）', () => {
    // 相机在 +Z 侧但朝 +Z（背离原点）：朝向由位置推得朝原点，故此处用显式朝向 +Z
    const cam: CameraDef = {
      ...camAt([0, 0.5, 4]),
      transform: { position: [0, 0.5, 4], rotation: [0, 180, 0], scale: [1, 1, 1] },
    };
    const scene = sceneWith([cam], [boxSubject()]);
    const stats = coverageOf(scene, thresholds, 8);
    expect(stats.maxCoverage).toBe(0);
  });
});

describe('coverage / 多相机覆盖更高', () => {
  it('4 相机环绕 > 1 相机的平均覆盖', () => {
    const one = coverageOf(
      sceneWith([camAt([0, 0.5, 4], 'c1')], [boxSubject()]),
      thresholds,
      8,
    );
    const four = coverageOf(
      sceneWith(
        [
          camAt([4, 0.5, 0], 'c1'),
          camAt([-4, 0.5, 0], 'c2'),
          camAt([0, 0.5, 4], 'c3'),
          camAt([0, 0.5, -4], 'c4'),
        ],
        [boxSubject()],
      ),
      thresholds,
      8,
    );
    expect(four.avgCoverage).toBeGreaterThan(one.avgCoverage);
    expect(four.maxCoverage).toBeGreaterThanOrEqual(2);
  });
});

describe('coverage / 禁用相机不计入', () => {
  it('enabled=false 的相机不贡献覆盖', () => {
    const cam = camAt([0, 0.5, 4]);
    cam.enabled = false;
    const stats = coverageOf(sceneWith([cam], [boxSubject()]), thresholds, 6);
    expect(stats.maxCoverage).toBe(0);
    expect(stats.perCamera).toHaveLength(0);
  });
});

describe('coverage / 遮挡近似', () => {
  it('被另一主体 AABB 包含的采样点对该相机计为遮挡', () => {
    // 目标主体在前（z=0），遮挡主体叠在其上同位置 → 遮挡
    const target = boxSubject();
    const occluder = boxSubject({
      id: 'subj_2',
      name: 'occluder',
      transform: { position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    });
    // 当两者 AABB 完全重合，coverageForSubject 排除自身(同 id 不可能)，
    // 这里 occluder 不同 id 但同 AABB → 所有内部点被遮挡。
    const samples = coverageForSubject(target, [occluder], [camAt([0, 0.5, 4])], 6);
    // 几乎所有点 count 应为 0（被 occluder AABB 遮挡）
    const covered = samples.filter((s) => s.count > 0).length;
    expect(covered).toBe(0);
  });
});

describe('coverage / memoize 缓存', () => {
  it('相同输入返回同一对象引用（缓存命中）', () => {
    const scene = sceneWith([camAt([0, 0.5, 4])], [boxSubject()]);
    const a = computeCoverage({ scene, thresholds, grid: 6 });
    const b = computeCoverage({ scene, thresholds, grid: 6 });
    expect(a).toBe(b);
  });
  it('改动相机位置后重算（缓存失效）', () => {
    const s1 = sceneWith([camAt([0, 0.5, 4], 'c1')], [boxSubject()]);
    const s2 = sceneWith([camAt([0, 0.5, 8], 'c1')], [boxSubject()]);
    const a = computeCoverage({ scene: s1, thresholds, grid: 6 });
    const b = computeCoverage({ scene: s2, thresholds, grid: 6 });
    expect(a).not.toBe(b);
  });
});
