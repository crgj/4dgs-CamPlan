// T-040/T-041/T-042 单测：相机预设换算、阵列生成、重建可行性。
import { describe, it, expect } from 'vitest';
import { focalToFov, fovToFocal, groundSampleDistance, CAMERA_PRESETS } from './cameraPresets';
import { buildRingArray, buildLinearArray, buildHemisphereArray, buildCameraArray } from './cameraArray';
import { assessReconstructability } from '@/sim/reconstructability';
import { buildExampleScene } from './exampleScene';
import { defaultThresholds } from './defaults';

describe('cameraPresets (T-040)', () => {
  it('焦距↔FOV 互为反函数', () => {
    const fov = focalToFov(35, 36);
    expect(fovToFocal(fov, 36)).toBeCloseTo(35, 3);
  });
  it('预设库非空且字段完整', () => {
    expect(CAMERA_PRESETS.length).toBeGreaterThan(0);
    for (const p of CAMERA_PRESETS) {
      expect(p.sensorWidth).toBeGreaterThan(0);
      expect(p.focalRange[0]).toBeLessThan(p.focalRange[1]);
    }
  });
  it('GSD 计算：距离越远 GSD 越大', () => {
    const near = groundSampleDistance(2, 36, 35, 1920);
    const far = groundSampleDistance(10, 36, 35, 1920);
    expect(far).toBeGreaterThan(near);
  });
});

describe('cameraArray (T-041)', () => {
  it('环形阵列生成指定数量、半径一致', () => {
    const cams = buildRingArray({ pattern: 'ring', count: 8, radius: 5, height: 2, pitch: 20 }, new Set());
    expect(cams).toHaveLength(8);
    cams.forEach((c) => {
      const r = Math.hypot(c.transform.position[0], c.transform.position[2]);
      expect(r).toBeCloseTo(5, 1);
    });
  });
  it('线性阵列基线间距正确', () => {
    const cams = buildLinearArray({ pattern: 'linear', count: 4, radius: 5, height: 2, pitch: 0, baseline: 0.5 }, new Set());
    expect(cams).toHaveLength(4);
    const dx = cams[1].transform.position[0] - cams[0].transform.position[0];
    expect(dx).toBeCloseTo(0.5, 2);
  });
  it('半球阵列层数≥3', () => {
    const cams = buildHemisphereArray({ pattern: 'hemisphere', count: 9, radius: 4, height: 0, pitch: 0 }, new Set());
    // 至少 9 台（3 层 × 3）
    expect(cams.length).toBeGreaterThanOrEqual(9);
    const heights = new Set(cams.map((c) => Math.round(c.transform.position[1])));
    expect(heights.size).toBeGreaterThanOrEqual(3);
  });
  it('buildCameraArray 按 pattern 分发', () => {
    const ring = buildCameraArray({ pattern: 'ring', count: 6, radius: 4, height: 2, pitch: 0 }, new Set());
    expect(ring).toHaveLength(6);
    const lin = buildCameraArray({ pattern: 'linear', count: 5, radius: 4, height: 2, pitch: 0 }, new Set());
    expect(lin).toHaveLength(5);
  });
  it('生成的相机 id 唯一', () => {
    const cams = buildRingArray({ pattern: 'ring', count: 10, radius: 4, height: 2, pitch: 0 }, new Set());
    const ids = cams.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('reconstructability (T-042)', () => {
  it('示例场景评估返回合法分数与分级', () => {
    const scene = buildExampleScene();
    const report = assessReconstructability(scene, defaultThresholds());
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThanOrEqual(1);
    expect(['excellent', 'good', 'marginal', 'poor']).toContain(report.grade);
    expect(report.factors.coverage).toBeGreaterThanOrEqual(0);
  });
  it('相机不足 3 台判为 poor', () => {
    const scene = buildExampleScene();
    scene.cameras = scene.cameras.slice(0, 2);
    const report = assessReconstructability(scene, defaultThresholds());
    expect(report.grade).toBe('poor');
    expect(report.issues.length).toBeGreaterThan(0);
  });
});
