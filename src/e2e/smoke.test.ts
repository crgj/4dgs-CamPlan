/**
 * T-022/T-037 端到端逻辑冒烟（src/e2e/smoke.test.ts）。
 * 不依赖浏览器，覆盖整条数据链路：示例场景 → 序列化/反序列化 →
 * transforms.json / COLMAP / capture list 导出 → 校验产物有效。
 * 这是 v1 发布候选的核心验收：任何环节抛错即失败。
 */
import { describe, it, expect } from 'vitest';
import { buildExampleScene } from '@/lib/exampleScene';
import { serializeScene, deserializeScene, validateScene } from '@/io/serialize';
import { exportToTransformsJson } from '@/export/transforms';
import { exportToColmap } from '@/export/colmap';
import { buildCaptureList, captureListToCsv } from '@/sim/capture';
import { coverageOf } from '@/sim/coverage';
import { defaultThresholds } from '@/lib/defaults';

describe('端到端冒烟：示例场景全链路', () => {
  const scene = buildExampleScene();

  it('1. 示例场景结构有效', () => {
    expect(validateScene(scene)).toEqual([]);
    expect(scene.cameras.length).toBeGreaterThan(0);
  });

  it('2. 序列化 round-trip 无损', () => {
    const json = serializeScene(scene);
    const restored = deserializeScene(json);
    expect(restored.cameras).toHaveLength(scene.cameras.length);
    expect(validateScene(restored)).toEqual([]);
  });

  it('3. transforms.json 导出有效', () => {
    const json = exportToTransformsJson(scene);
    const parsed = JSON.parse(json);
    expect(parsed.frames).toBeDefined();
    expect(parsed.frames.length).toBe(scene.cameras.length);
  });

  it('4. COLMAP 导出三件套有效', () => {
    const { camerasTxt, imagesTxt, points3DTxt } = exportToColmap(scene);
    expect(camerasTxt).toContain('PINHOLE');
    // images.txt 每张图一行（含空行分隔）
    const imgLines = imagesTxt.trim().split('\n').filter((l) => l && !l.startsWith('#'));
    expect(imgLines.length).toBeGreaterThanOrEqual(scene.cameras.length);
    expect(points3DTxt).toContain('POINT3D_ID'); // 点云占位（无实际 3D 点）
    // 不含实际坐标数据行（仅注释/表头）
    expect(points3DTxt.trim().split('\n').every((l) => l.startsWith('#'))).toBe(true);
  });

  it('5. 拍摄清单 CSV 有效', () => {
    const list = buildCaptureList(scene);
    expect(list.rows).toHaveLength(scene.cameras.length);
    const csv = captureListToCsv(list);
    expect(csv).toContain('id');
    expect(csv.split('\n').length).toBeGreaterThan(scene.cameras.length);
  });

  it('6. 覆盖度仿真可计算（不抛错）', () => {
    const stats = coverageOf(scene, defaultThresholds(), 16);
    expect(stats.totalSamples).toBeGreaterThan(0);
    expect(stats.avgCoverage).toBeGreaterThanOrEqual(0);
  });
});
