import { describe, it, expect } from 'vitest';
import type { CameraDef, EvalThresholds, SceneDef } from '@/types';
import { defaultEnv, defaultThresholds } from '@/lib/defaults';
import { cameraEV, computeExposure, exposureOf } from './exposure';

const thresholds: EvalThresholds = defaultThresholds(); // maxExposureSpread 0.5

const cam = (
  id: string,
  exp: { iso: number; shutter: number; aperture: number },
): CameraDef => ({
  id, kind: 'camera', name: id,
  transform: { position: [0, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1] },
  model: 'PINHOLE', fov: 50, aspect: 16 / 9, near: 0.1, far: 1000,
  resolution: { width: 1920, height: 1080 },
  exposure: exp, enabled: true,
});

const sceneWith = (cameras: CameraDef[]): SceneDef => ({
  version: 1, cameras, lights: [], subjects: [], env: defaultEnv(),
});

describe('exposure / cameraEV', () => {
  it('ISO 100 / 1/125 / f2.8 为基准 EV（正值）', () => {
    const ev = cameraEV(cam('c', { iso: 100, shutter: 1 / 125, aperture: 2.8 }));
    // log2(2.8²/(1/125)) - log2(1) = log2(7.84*125) ≈ 9.94
    expect(ev).toBeCloseTo(Math.log2((2.8 * 2.8) / (1 / 125)), 4);
  });
  it('更小光圈（f 值大）→ EV 更大（更暗）', () => {
    const wide = cameraEV(cam('c', { iso: 100, shutter: 1 / 125, aperture: 2.8 }));
    const narrow = cameraEV(cam('c', { iso: 100, shutter: 1 / 125, aperture: 8 }));
    expect(narrow).toBeGreaterThan(wide);
  });
  it('更高 ISO → EV 更小（更亮）', () => {
    const low = cameraEV(cam('c', { iso: 100, shutter: 1 / 125, aperture: 2.8 }));
    const high = cameraEV(cam('c', { iso: 1600, shutter: 1 / 125, aperture: 2.8 }));
    expect(high).toBeLessThan(low);
  });
  it('非法参数（t<=0）返回 0 不抛', () => {
    expect(cameraEV(cam('c', { iso: 100, shutter: 0, aperture: 2.8 }))).toBe(0);
  });
});

describe('exposure / 一致性统计', () => {
  it('同曝光阵列 spread=0，不超阈值', () => {
    const s = sceneWith([
      cam('a', { iso: 100, shutter: 1 / 125, aperture: 2.8 }),
      cam('b', { iso: 100, shutter: 1 / 125, aperture: 2.8 }),
    ]);
    const st = exposureOf(s, thresholds);
    expect(st.spread).toBeCloseTo(0, 9);
    expect(st.stddev).toBeCloseTo(0, 9);
    expect(st.exceedsThreshold).toBe(false);
  });
  it('曝光差异大 → spread 大且超阈值', () => {
    const s = sceneWith([
      cam('a', { iso: 100, shutter: 1 / 1000, aperture: 8 }),
      cam('b', { iso: 1600, shutter: 1 / 30, aperture: 1.4 }),
    ]);
    const st = exposureOf(s, thresholds);
    expect(st.spread).toBeGreaterThan(thresholds.maxExposureSpread);
    expect(st.exceedsThreshold).toBe(true);
  });
  it('禁用相机不计入', () => {
    const c = cam('a', { iso: 100, shutter: 1 / 125, aperture: 2.8 });
    c.enabled = false;
    const st = exposureOf(sceneWith([c]), thresholds);
    expect(st.perCamera).toHaveLength(0);
    expect(st.spread).toBe(0);
  });
});

describe('exposure / memoize', () => {
  it('相同输入命中缓存', () => {
    const s = sceneWith([cam('a', { iso: 100, shutter: 1 / 125, aperture: 2.8 })]);
    const a = computeExposure({ scene: s, thresholds });
    const b = computeExposure({ scene: s, thresholds });
    expect(a).toBe(b);
  });
});
