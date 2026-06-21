import { describe, it, expect } from 'vitest';
import {
  deg2rad,
  rad2deg,
  deg3ToRad3,
  wrapDeg,
  wrapDegSigned,
  hexToRgb,
  rgbToHex,
  identity4,
  composeMatrix,
  multiply4,
  invert4,
  transformPoint,
  distance3,
  approx,
  EPS,
  lookAtRotation,
} from './math';

describe('math / 角度换算', () => {
  it('deg2rad/rad2deg 互逆', () => {
    expect(deg2rad(180)).toBeCloseTo(Math.PI, 9);
    expect(rad2deg(Math.PI)).toBeCloseTo(180, 9);
    expect(rad2deg(deg2rad(37))).toBeCloseTo(37, 9);
  });
  it('deg3ToRad3 逐元素', () => {
    const r = deg3ToRad3([90, 180, 0]);
    expect(r[0]).toBeCloseTo(Math.PI / 2, 9);
    expect(r[1]).toBeCloseTo(Math.PI, 9);
    expect(r[2]).toBe(0);
  });
  it('wrapDeg 归一到 [0,360)', () => {
    expect(wrapDeg(370)).toBe(10);
    expect(wrapDeg(-10)).toBe(350);
    expect(wrapDeg(0)).toBe(0);
  });
  it('wrapDegSigned 归一到 [-180,180)', () => {
    expect(wrapDegSigned(190)).toBe(-170);
    expect(wrapDegSigned(-190)).toBe(170);
    expect(wrapDegSigned(180)).toBe(-180);
  });
});

describe('math / 颜色换算', () => {
  it('hexToRgb 解析 0xff8800', () => {
    const c = hexToRgb(0xff8800);
    expect(c.r).toBeCloseTo(1, 2); // 0xff
    expect(c.g).toBeCloseTo(0x88 / 255, 2); // 0x88 = 136
    expect(c.b).toBe(0);
  });
  it('rgbToHex 往返', () => {
    expect(rgbToHex({ r: 1, g: 0.5, b: 0 })).toBe(0xff8000);
  });
  it('rgbToHex clamp 越界', () => {
    expect(rgbToHex({ r: 2, g: -1, b: 0.5 })).toBe(0xff0080);
  });
});

describe('math / 矩阵', () => {
  it('identity4 乘任意矩阵 = 原矩阵', () => {
    const m = composeMatrix([1, 2, 3], [10, 20, 30]);
    expect(approx(multiply4(identity4(), m), m)).toBe(true);
  });
  it('composeMatrix 纯平移：原点矩阵的平移列正确', () => {
    const m = composeMatrix([3, 4, 5], [0, 0, 0]);
    // 列主序：平移在 index 12,13,14
    expect([m[12], m[13], m[14]]).toEqual([3, 4, 5]);
  });
  it('invert4 ∘ 原矩阵 = 单位（平移+旋转）', () => {
    const m = composeMatrix([1, 2, 3], [15, -25, 40]);
    const inv = invert4(m);
    const prod = multiply4(m, inv);
    const I = identity4();
    expect(approx(prod, I, 1e-6)).toBe(true);
  });
  it('transformPoint 应用平移', () => {
    const m = composeMatrix([10, 20, 30], [0, 0, 0]);
    const p = transformPoint(m, [0, 0, 0]);
    expect([p[0], p[1], p[2]]).toEqual([10, 20, 30]);
    expect(p[3]).toBe(1);
  });
  it('transformPoint 应用旋转 90°(y) 把 +X 转到 -Z', () => {
    const m = composeMatrix([0, 0, 0], [0, 90, 0]);
    const p = transformPoint(m, [1, 0, 0]);
    expect(p[0]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(-1, 6);
  });
  it('invert4 奇异矩阵返回单位', () => {
    const singular = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(approx(invert4(singular), identity4())).toBe(true);
  });
});

describe('math / 向量与容差', () => {
  it('distance3', () => {
    expect(distance3([0, 0, 0], [3, 4, 0])).toBeCloseTo(5, 9);
  });
  it('approx 区分微小差异', () => {
    expect(approx([1, 2], [1, 2], EPS)).toBe(true);
    expect(approx([1, 2], [1, 2 + 1e-6], EPS)).toBe(false);
  });
});

describe('math / lookAtRotation', () => {
  // 把相机默认前向 (0,0,-1) 经 lookAt 给出的旋转后，应指向 from→target 方向。
  const rotatedForward = (from: number[], target: number[]): number[] => {
    const rot = lookAtRotation(from as never, target as never);
    const m = composeMatrix([0, 0, 0], rot);
    const p = transformPoint(m, [0, 0, -1]); // 局部 -Z 在世界空间的方向
    const len = Math.hypot(p[0], p[1], p[2]);
    return [p[0] / len, p[1] / len, p[2] / len];
  };
  const expectedDir = (from: number[], target: number[]): number[] => {
    const dx = target[0] - from[0];
    const dy = target[1] - from[1];
    const dz = target[2] - from[2];
    const len = Math.hypot(dx, dy, dz);
    return [dx / len, dy / len, dz / len];
  };

  it('正前方（from 在 +Z，看向原点）→ 零旋转', () => {
    const r = lookAtRotation([0, 0, 5], [0, 0, 0]);
    expect(Math.abs(r[0])).toBeLessThan(1e-6);
    expect(Math.abs(r[1])).toBeLessThan(1e-6);
    expect(Math.abs(r[2])).toBeLessThan(1e-6);
  });
  it('仅俯视（from 在 +Z 高处）→ 负 pitch、yaw/roll≈0', () => {
    const r = lookAtRotation([0, 3.5, 6], [0, 1, 0]);
    expect(r[0]).toBeCloseTo(-22.62, 1); // 向下俯视
    expect(r[1]).toBeCloseTo(0, 1);
  });
  it('任意方向：旋转后的 -Z 前向 = from→target（四象限各点 + 俯仰混合）', () => {
    const cases: [number[], number[]][] = [
      [[6, 3.5, 0], [0, 1, 0]],
      [[-6, 3.5, 0], [0, 1, 0]],
      [[0, 3.5, 6], [0, 1, 0]],
      [[0, 3.5, -6], [0, 1, 0]],
      [[4.24, 3.5, 4.24], [0, 1, 0]],
      [[2, 2, 2], [1, 0, -1]],
      [[6, 0, 0], [0, 0, 0]],
    ];
    for (const [from, target] of cases) {
      const got = rotatedForward(from, target);
      const want = expectedDir(from, target);
      expect(approx(got, want, 1e-6)).toBe(true);
    }
  });
  it('from==target 不崩（退化到默认朝 -Z）', () => {
    const r = lookAtRotation([1, 1, 1], [1, 1, 1]);
    // 退化后 forward=(0,0,-1)，等价 from=[0,0,0]→[0,0,-1]
    const got = rotatedForward([1, 1, 1], [1, 1, 1]);
    expect(approx(got, [0, 0, -1], 1e-6)).toBe(true);
    void r;
  });
});
