import { describe, it, expect } from 'vitest';
import type { CameraDef } from '@/types';
import {
  perspectiveFovY,
  verticalFovFromHorizontal,
  viewMatrix,
  viewProjection,
  pointVisibleToCamera,
  pointInFrustumClip,
  toClip,
} from './frustum';
import {
  approx,
  composeMatrix,
  deg2rad,
  multiply4,
  transformPoint,
} from '@/lib/math';

/** 原点相机：位于原点、无旋转、看向 -Z，50° 水平 FOV，16:9。 */
const makeCam = (overrides?: Partial<CameraDef>): CameraDef => ({
  id: 'cam_t',
  kind: 'camera',
  name: 't',
  transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
  model: 'PINHOLE',
  fov: 50,
  aspect: 16 / 9,
  near: 0.5,
  far: 50,
  resolution: { width: 1920, height: 1080 },
  exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
  enabled: true,
  ...overrides,
});

describe('frustum / perspectiveFovY', () => {
  it('非零有效矩阵，far 项为负（OpenGL 约定）', () => {
    const p = perspectiveFovY(deg2rad(90), 1, 1, 100);
    expect(p.length).toBe(16);
    // [10]=z 缩放 = far/(near-far) < 0
    expect(p[10]).toBeLessThan(0);
  });
  it('aspect=1 且 fov=90° 时 x/y 缩放 = 1', () => {
    const p = perspectiveFovY(deg2rad(90), 1, 0.1, 100);
    expect(p[0]).toBeCloseTo(1, 6);
    expect(p[5]).toBeCloseTo(1, 6);
  });
});

describe('frustum / verticalFovFromHorizontal', () => {
  it('aspect=1 时垂直=水平', () => {
    expect(verticalFovFromHorizontal(50, 1)).toBeCloseTo(deg2rad(50), 6);
  });
  it('aspect=2 时垂直 < 水平', () => {
    expect(verticalFovFromHorizontal(90, 2)).toBeLessThan(deg2rad(90));
  });
});

describe('frustum / viewMatrix', () => {
  it('view = invert(model)，原点相机 view = 单位', () => {
    const cam = makeCam();
    const v = viewMatrix(cam);
    expect(approx(v, [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], 1e-9)).toBe(true);
  });
  it('相机后移 +5z：view 把世界点 z 减 5', () => {
    const cam = makeCam({ transform: { position: [0, 0, 5], rotation: [0, 0, 0], scale: [1,1,1] } });
    const v = viewMatrix(cam);
    const p = transformPoint(v, [0, 0, 0]);
    expect([p[0], p[1], p[2]]).toEqual([0, 0, -5]);
  });
  it('view ∘ model = 单位（任意位姿）', () => {
    const cam = makeCam({ transform: { position: [1,2,3], rotation: [10,20,-30], scale: [1,1,1] } });
    const model = composeMatrix(cam.transform.position, cam.transform.rotation, cam.transform.scale ?? [1,1,1]);
    const prod = multiply4(viewMatrix(cam), model);
    expect(approx(prod, [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], 1e-6)).toBe(true);
  });
});

describe('frustum / 可见性（裁剪空间法）', () => {
  it('原点相机：前方 -Z 处的点可见', () => {
    const cam = makeCam();
    expect(pointVisibleToCamera(cam, [0, 0, -5])).toBe(true);
  });
  it('原点相机：后方 +Z 处的点不可见', () => {
    const cam = makeCam();
    expect(pointVisibleToCamera(cam, [0, 0, 5])).toBe(false);
  });
  it('近裁剪面内的点（更近 than near）不可见', () => {
    const cam = makeCam({ near: 1, far: 50 });
    // 在相机前 0.5（< near=1）
    expect(pointVisibleToCamera(cam, [0, 0, -0.5])).toBe(false);
  });
  it('远裁剪面外的点不可见', () => {
    const cam = makeCam({ near: 0.5, far: 10 });
    expect(pointVisibleToCamera(cam, [0, 0, -20])).toBe(false);
  });
  it('超出水平 FOV 的点不可见（沿 +X 偏出）', () => {
    const cam = makeCam({ fov: 10, aspect: 1 }); // 窄视场
    // 距离 5、横向 5：角度 45° > 5°/2 → 在外
    expect(pointVisibleToCamera(cam, [5, 0, -5])).toBe(false);
  });
  it('水平 FOV 边界内的点可见', () => {
    const cam = makeCam({ fov: 90, aspect: 1 }); // 半角 45°
    expect(pointVisibleToCamera(cam, [1, 0, -2])).toBe(true);
  });
  it('相机旋转后可见方向随之改变（绕 Y 转 90°，原 -Z 视线变 -X）', () => {
    const cam = makeCam({ transform: { position: [0,0,0], rotation: [0,90,0], scale: [1,1,1] } });
    // 视线朝 -X：[-5,0,0] 可见，[0,0,-5] 不可见
    expect(pointVisibleToCamera(cam, [-5, 0, 0])).toBe(true);
    expect(pointVisibleToCamera(cam, [0, 0, -5])).toBe(false);
  });
});

describe('frustum / 裁剪空间一致性', () => {
  it('pointVisibleToCamera 与直接 toClip+pointInFrustumClip 一致', () => {
    const cam = makeCam();
    const samples: [number, number, number][] = [
      [0,0,-5],[0,0,5],[0,0,-0.3],[0,0,-60],
      [3,0,-5],[0,3,-5],[-3,-3,-5],[1,1,-5],[10,10,-5],
    ];
    for (const s of samples) {
      const a = pointVisibleToCamera(cam, s);
      const b = pointInFrustumClip(toClip(viewProjection(cam), s));
      expect(a).toBe(b);
    }
  });
});
