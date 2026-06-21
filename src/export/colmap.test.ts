// T-018 COLMAP 导出测试 + round-trip 自校验。
import { describe, it, expect } from 'vitest';
import type { CameraDef, SceneDef } from '@/types';
import { defaultEnv } from '@/lib/defaults';
import { exportToColmap, importFromColmap } from './colmap';

const cam = (
  pos: [number, number, number],
  id: string,
  fov = 50,
): CameraDef => ({
  id,
  kind: 'camera',
  name: id,
  transform: { position: pos, rotation: [0, 0, 0], scale: [1, 1, 1] },
  model: 'PINHOLE',
  fov,
  aspect: 16 / 9,
  near: 0.1,
  far: 1000,
  resolution: { width: 1920, height: 1080 },
  exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
  enabled: true,
});

const sceneWith = (cameras: CameraDef[]): SceneDef => ({
  version: 1,
  cameras,
  lights: [],
  subjects: [],
  env: defaultEnv(),
});

describe('colmap / 导出格式', () => {
  it('cameras.txt 含 PINHOLE 行与表头', () => {
    const out = exportToColmap(sceneWith([cam([0, 0, 5], 'a')]));
    expect(out.camerasTxt).toContain('PINHOLE');
    expect(out.camerasTxt.split('\n').length).toBeGreaterThan(1);
  });
  it('images.txt 每相机一行数据 + 空行（COLMAP 约定）', () => {
    const out = exportToColmap(sceneWith([cam([0, 0, 5], 'a'), cam([5, 0, 0], 'b')]));
    const dataRows = out.imagesTxt
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'));
    // 2 相机 ×（1 数据行 + 1 空行）= 4；非空数据行 = 2
    expect(dataRows.length).toBe(2);
  });
  it('points3D.txt 仅注释（v1 无点云）', () => {
    const out = exportToColmap(sceneWith([cam([0, 0, 5], 'a')]));
    expect(out.points3DTxt.startsWith('#')).toBe(true);
  });
  it('无启用相机时三件套仅表头', () => {
    const out = exportToColmap(sceneWith([]));
    expect(out.camerasTxt.trim()).toContain('CAMERA_ID');
    expect(out.imagesTxt.trim()).toContain('IMAGE_ID');
  });
});

describe('colmap / world→camera 变换', () => {
  it('相机在 +Z 朝 -Z：w2c 平移 z 分量为负（相机原点在世界的 +Z）', () => {
    const out = exportToColmap(sceneWith([cam([0, 0, 5], 'a')]));
    const dataRow = out.imagesTxt
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))[0];
    const parts = dataRow.split(/\s+/);
    // QW QX QY QZ TX TY TZ ... → 索引 5,6,7
    const tz = Number(parts[7]);
    expect(tz).toBeLessThan(0); // world→camera：相机在 +Z，原点在相机 -Z
  });
});

describe('colmap / round-trip', () => {
  it('导出→导入：位置与内参可恢复（容差）', () => {
    const src = cam([0, 0, 5], 'a', 50);
    const out = exportToColmap(sceneWith([src]));
    const restored = importFromColmap(out);
    expect(restored).toHaveLength(1);
    const r = restored[0];
    // 位置：相机在 +Z=5
    expect(r.transform.position[2]).toBeCloseTo(5, 3);
    // 内参：fx 由 fov 推
    expect(r.fov).toBeCloseTo(50, 1);
    expect(r.resolution.width).toBe(1920);
  });
});
