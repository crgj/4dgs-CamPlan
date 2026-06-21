// T-082/T-088 渲染层纯逻辑单测：光照度量、渲染设置默认值。
import { describe, it, expect } from 'vitest';
import { meterScene } from './lightMeter';
import { buildExampleScene } from '@/lib/exampleScene';
import { usePlanner } from '@/state/store';

describe('lightMeter (T-082)', () => {
  it('示例场景返回合法光照报告', () => {
    const scene = buildExampleScene();
    const r = meterScene(scene);
    expect(r.avgIlluminance).toBeGreaterThanOrEqual(0);
    expect(r.uniformity).toBeGreaterThanOrEqual(0);
    expect(r.uniformity).toBeLessThanOrEqual(1);
    expect(r.overexposureRatio).toBeGreaterThanOrEqual(0);
    expect(r.underexposureRatio).toBeGreaterThanOrEqual(0);
  });

  it('无灯光时欠曝占比为 1', () => {
    const scene = buildExampleScene();
    scene.lights = [];
    const r = meterScene(scene);
    expect(r.underexposureRatio).toBe(1);
    expect(r.avgIlluminance).toBe(0);
  });

  it('禁用灯光等同无光', () => {
    const scene = buildExampleScene();
    scene.lights.forEach((l) => (l.enabled = false));
    const r = meterScene(scene);
    expect(r.avgIlluminance).toBe(0);
  });
});

describe('renderSettings (T-088)', () => {
  it('默认渲染设置为 standard/ACES/bloom 开', () => {
    const { renderSettings } = usePlanner.getState();
    expect(renderSettings.quality).toBe('standard');
    expect(renderSettings.toneMapping).toBe('aces');
    expect(renderSettings.bloom).toBe(true);
    expect(renderSettings.ssao).toBe(true);
    expect(renderSettings.pathTracing).toBe(false);
  });

  it('默认地面网格偏好为 1m 大格与 0.5 主线宽度', () => {
    const { preferences } = usePlanner.getState();
    expect(preferences.gridSectionSize).toBe(1);
    expect(preferences.gridSectionThickness).toBe(0.5);
    expect(preferences.gridCellColor).toBe('#484d54');
    expect(preferences.gridSectionColor).toBe('#28a8ff');
  });

  it('默认显示视口 HUD', () => {
    expect(usePlanner.getState().view.showViewportHud).toBe(true);
  });

  it('setRenderSettings 局部更新', () => {
    usePlanner.getState().setRenderSettings({ quality: 'high', ptBounces: 5 });
    const { renderSettings } = usePlanner.getState();
    expect(renderSettings.quality).toBe('high');
    expect(renderSettings.ptBounces).toBe(5);
    // 未改的保持
    expect(renderSettings.toneMapping).toBe('aces');
    // 还原
    usePlanner.getState().setRenderSettings({ quality: 'standard', ptBounces: 3 });
  });
});
