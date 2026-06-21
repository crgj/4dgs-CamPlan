// WDD -gemini 2026-06-19 新增 transforms.json 的单元测试，包含 schema 验证与多相机/4DGS round-trip 还原精度测试

import { describe, it, expect } from 'vitest';
import type { SceneDef, CameraDef } from '@/types';
import { exportToTransformsJson, importFromTransformsJson } from './transforms';
import { validateTransformsJson } from './schema';

describe('transforms.json Export & Import Round-trip', () => {
  const createMockScene = (cameras: CameraDef[]): SceneDef => ({
    version: 1,
    cameras,
    lights: [],
    subjects: [],
    env: {
      kind: 'environment',
      ambientIntensity: 0.5,
      ground: { enabled: true, y: 0, color: 0x222222 },
    },
  });

  const baseCamera: CameraDef = {
    id: 'cam_1',
    kind: 'camera',
    name: 'Camera 1',
    transform: {
      position: [1.2, -3.4, 5.6],
      rotation: [15, -45, 30], // 旋转角度
      scale: [1, 1, 1],
    },
    model: 'PINHOLE',
    fov: 60,
    aspect: 16 / 9,
    near: 0.1,
    far: 1000,
    resolution: { width: 1920, height: 1080 },
    exposure: { iso: 100, shutter: 0.008, aperture: 2.8 },
    enabled: true,
  };

  it('should export empty frames when no active cameras', () => {
    const scene = createMockScene([{ ...baseCamera, enabled: false }]);
    const jsonStr = exportToTransformsJson(scene);
    const data = JSON.parse(jsonStr);
    expect(data.frames).toEqual([]);
    expect(validateTransformsJson(data)).toBe(true);
  });

  it('should pass schema validation and round-trip successfully for a single camera', () => {
    const scene = createMockScene([baseCamera]);
    const jsonStr = exportToTransformsJson(scene);
    
    // 验证符合 Schema
    const data = JSON.parse(jsonStr);
    expect(validateTransformsJson(data)).toBe(true);

    // 焦距、主点是否提取到顶层
    expect(data.fl_x).toBeCloseTo(1920 / (2 * Math.tan(deg2rad(60) / 2)), 4);
    expect(data.cx).toBe(960);
    expect(data.cy).toBe(540);

    // 导入并比对
    const imported = importFromTransformsJson(jsonStr);
    expect(imported.length).toBe(1);
    
    const cam = imported[0];
    expect(cam.id).toBe(baseCamera.id);
    expect(cam.name).toBe(baseCamera.name);
    
    // 浮点数比较
    expect(cam.transform.position[0]).toBeCloseTo(baseCamera.transform.position[0], 4);
    expect(cam.transform.position[1]).toBeCloseTo(baseCamera.transform.position[1], 4);
    expect(cam.transform.position[2]).toBeCloseTo(baseCamera.transform.position[2], 4);
    
    expect(cam.transform.rotation[0]).toBeCloseTo(baseCamera.transform.rotation[0], 4);
    expect(cam.transform.rotation[1]).toBeCloseTo(baseCamera.transform.rotation[1], 4);
    expect(cam.transform.rotation[2]).toBeCloseTo(baseCamera.transform.rotation[2], 4);

    expect(cam.fov).toBeCloseTo(baseCamera.fov, 4);
    expect(cam.aspect).toBeCloseTo(baseCamera.aspect, 4);
    expect(cam.near).toBe(baseCamera.near);
    expect(cam.far).toBe(baseCamera.far);
    expect(cam.exposure).toEqual(baseCamera.exposure);
  });

  it('should support mixed camera profiles with frame-level intrinsics', () => {
    const cam1 = { ...baseCamera, id: 'cam_1', name: 'Cam1' };
    const cam2: CameraDef = {
      ...baseCamera,
      id: 'cam_2',
      name: 'Cam2',
      fov: 45, // 不同的 FOV
      resolution: { width: 1280, height: 720 }, // 不同的分辨率
      transform: {
        position: [-2.0, 1.5, 3.0],
        rotation: [0, 90, 0], // 测试万向锁边缘或 90 度特殊角
        scale: [1, 1, 1],
      },
    };

    const scene = createMockScene([cam1, cam2]);
    const jsonStr = exportToTransformsJson(scene);
    
    // 验证 Schema
    const data = JSON.parse(jsonStr);
    expect(validateTransformsJson(data)).toBe(true);

    // 应该因为内参不一致而不把 fl_x 提取到顶层
    expect(data.fl_x).toBeUndefined();
    expect(data.frames[0].fl_x).toBeDefined();
    expect(data.frames[1].fl_x).toBeDefined();

    // 导入并比对
    const imported = importFromTransformsJson(jsonStr);
    expect(imported.length).toBe(2);
    
    // 检查第二台相机
    const importedCam2 = imported[1];
    expect(importedCam2.fov).toBeCloseTo(cam2.fov, 4);
    expect(importedCam2.resolution).toEqual(cam2.resolution);
    expect(importedCam2.transform.position).toEqual(cam2.transform.position);
    expect(importedCam2.transform.rotation[0]).toBeCloseTo(cam2.transform.rotation[0], 4);
    expect(importedCam2.transform.rotation[1]).toBeCloseTo(cam2.transform.rotation[1], 4);
    expect(importedCam2.transform.rotation[2]).toBeCloseTo(cam2.transform.rotation[2], 4);
  });

  it('should correctly preserve 4DGS time field', () => {
    const camWithTime: CameraDef = {
      ...baseCamera,
      time: 12.34,
    };
    const scene = createMockScene([camWithTime]);
    const jsonStr = exportToTransformsJson(scene);

    const imported = importFromTransformsJson(jsonStr);
    expect(imported[0].time).toBe(12.34);
  });
});

// 辅助度弧度转换，与 runtime math.ts 一致
function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
