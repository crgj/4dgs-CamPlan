// T-019 拍摄清单测试。
import { describe, it, expect } from 'vitest';
import type { CameraDef, SceneDef } from '@/types';
import { defaultEnv } from '@/lib/defaults';
import { buildCaptureList, captureListToCsv, captureListToJson, captureRowForCamera } from './capture';

const cam = (
  pos: [number, number, number],
  id: string,
  time?: number,
): CameraDef => ({
  id, kind: 'camera', name: id,
  transform: { position: pos, rotation: [0, 0, 0], scale: [1, 1, 1] },
  model: 'PINHOLE', fov: 50, aspect: 16 / 9, near: 0.1, far: 1000,
  resolution: { width: 1920, height: 1080 },
  exposure: { iso: 100, shutter: 1 / 125, aperture: 2.8 },
  enabled: true,
  ...(time !== undefined ? { time } : {}),
});

const sceneWith = (cameras: CameraDef[]): SceneDef => ({
  version: 1, cameras, lights: [], subjects: [], env: defaultEnv(),
});

describe('capture / buildCaptureList', () => {
  it('仅含启用相机，生成时间存在', () => {
    const list = buildCaptureList(sceneWith([cam([0, 0, 5], 'a')]));
    expect(list.rows).toHaveLength(1);
    expect(list.generatedAt).toBeTruthy();
  });
  it('禁用相机被排除', () => {
    const c = cam([0, 0, 5], 'a');
    c.enabled = false;
    expect(buildCaptureList(sceneWith([c])).rows).toHaveLength(0);
  });
  it('按 time 升序排列（4DGS 时序）', () => {
    const list = buildCaptureList(
      sceneWith([cam([0, 0, 5], 'a', 2), cam([5, 0, 0], 'b', 0.5)]),
    );
    expect(list.rows[0].name).toBe('b');
    expect(list.rows[1].name).toBe('a');
  });
  it('每行含 worldToCamera(16) + 内参 + 曝光', () => {
    const row = captureRowForCamera(cam([0, 0, 5], 'a'), []);
    expect(row.worldToCamera).toHaveLength(16);
    expect(row.intrinsics.fx).toBeGreaterThan(0);
    expect(row.exposure.aperture).toBe(2.8);
  });
});

describe('capture / 输出格式', () => {
  it('CSV 含表头与数据行', () => {
    const list = buildCaptureList(sceneWith([cam([0, 0, 5], 'Hero')]));
    const csv = captureListToCsv(list);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('id,name,time');
    expect(lines[1]).toContain('Hero');
  });
  it('JSON 可解析回同等结构', () => {
    const list = buildCaptureList(sceneWith([cam([0, 0, 5], 'a')]));
    const json = captureListToJson(list);
    const back = JSON.parse(json);
    expect(back.rows).toHaveLength(1);
    expect(back.rows[0].intrinsics.fx).toBeCloseTo(list.rows[0].intrinsics.fx, 6);
  });
});
