import { describe, it, expect, beforeEach } from 'vitest';
import {
  SCHEMA_VERSION,
  defaultCamera,
  defaultEnv,
  defaultLight,
  defaultScene,
  defaultSubject,
  defaultThresholds,
  resetDefaultCounters,
} from './defaults';
import { aabbOfSubject } from './aabb';

beforeEach(() => resetDefaultCounters());

describe('defaults / 相机', () => {
  it('默认相机字段齐全且看向原点方向(-Z)', () => {
    const c = defaultCamera();
    expect(c.kind).toBe('camera');
    expect(c.model).toBe('PINHOLE');
    expect(c.fov).toBe(50);
    expect(c.resolution).toEqual({ width: 1920, height: 1080 });
    expect(c.exposure.aperture).toBe(2.8);
    expect(c.id).toMatch(/^cam_/);
  });
  it('计数器递增命名', () => {
    expect(defaultCamera().name).toBe('Camera 1');
    expect(defaultCamera().name).toBe('Camera 2');
  });
  it('overrides 可覆盖', () => {
    const c = defaultCamera(undefined, { fov: 90 });
    expect(c.fov).toBe(90);
  });
});

describe('defaults / 灯光', () => {
  it('spot 带锥角与范围', () => {
    const l = defaultLight('spot');
    expect(l.lightKind).toBe('spot');
    expect(l.spotAngle).toBe(45);
    expect(l.range).toBe(20);
  });
  it('directional 强度量级为 lux', () => {
    const l = defaultLight('directional');
    expect(l.intensity).toBeLessThan(10);
  });
  it('point 带范围', () => {
    const l = defaultLight('point');
    expect(l.range).toBe(15);
  });
});

describe('defaults / 主体与场景', () => {
  it('默认主体 bounds 由几何算得', () => {
    const s = defaultSubject();
    const expected = aabbOfSubject(s);
    expect(s.bounds).toEqual(expected);
  });
  it('默认场景含版本与空实体数组 + 环境', () => {
    const sc = defaultScene();
    expect(sc.version).toBe(SCHEMA_VERSION);
    expect(sc.cameras).toEqual([]);
    expect(sc.env.ground.enabled).toBe(true);
  });
  it('defaultEnv 无 hdri', () => {
    expect(defaultEnv().hdri).toBeUndefined();
  });
});

describe('defaults / 阈值', () => {
  it('默认阈值符合 4dgs-capture 经验值', () => {
    const t = defaultThresholds();
    expect(t.minCoverage).toBe(8);
    expect(t.minOverlap).toBe(0.6);
    expect(t.baselineRange).toEqual([0.2, 5]);
    expect(t.maxExposureSpread).toBe(0.5);
  });
});
