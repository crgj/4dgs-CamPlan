// T-088 RenderQuality 纯逻辑单测：质量预设阈值与钳制。
import { describe, it, expect } from 'vitest';
import {
  QUALITY_PROFILES,
  resolvePixelRatio,
  clampPathTracingSettings,
  qualityHasShadows,
  type RenderQuality,
} from './RenderQuality';

describe('RenderQuality (T-088)', () => {
  it('四个质量等级都有完整 profile', () => {
    const levels: RenderQuality[] = ['draft', 'standard', 'high', 'ultra'];
    for (const q of levels) {
      const p = QUALITY_PROFILES[q];
      expect(p.pixelRatioCap).toBeGreaterThan(0);
      expect(p.shadowMapSize).toBeGreaterThanOrEqual(0);
      expect(typeof p.postFX).toBe('boolean');
      expect(p.ptSamplesCap).toBeGreaterThanOrEqual(1);
      expect(p.ptBouncesCap).toBeGreaterThanOrEqual(1);
    }
  });

  it('质量越高，DPR/阴影/PT 上限单调不降', () => {
    const order: RenderQuality[] = ['draft', 'standard', 'high', 'ultra'];
    for (let i = 1; i < order.length; i++) {
      expect(QUALITY_PROFILES[order[i]].pixelRatioCap).toBeGreaterThanOrEqual(
        QUALITY_PROFILES[order[i - 1]].pixelRatioCap,
      );
      expect(QUALITY_PROFILES[order[i]].shadowMapSize).toBeGreaterThanOrEqual(
        QUALITY_PROFILES[order[i - 1]].shadowMapSize,
      );
      expect(QUALITY_PROFILES[order[i]].ptSamplesCap).toBeGreaterThanOrEqual(
        QUALITY_PROFILES[order[i - 1]].ptSamplesCap,
      );
    }
  });

  it('Draft 模式关闭后处理与阴影以保性能', () => {
    expect(QUALITY_PROFILES.draft.postFX).toBe(false);
    expect(qualityHasShadows('draft')).toBe(false);
  });

  it('Ultra 启用后处理、阴影与高 DPR', () => {
    expect(QUALITY_PROFILES.ultra.postFX).toBe(true);
    expect(qualityHasShadows('ultra')).toBe(true);
    expect(QUALITY_PROFILES.ultra.pixelRatioCap).toBeGreaterThanOrEqual(2);
  });

  it('resolvePixelRatio 受设备 DPR 与质量上限双重约束', () => {
    // 草稿上限为 1：即便 Retina 也应降到 1
    expect(resolvePixelRatio('draft')).toBeLessThanOrEqual(1);
    // 任何等级都不应超过质量上限
    expect(resolvePixelRatio('standard')).toBeLessThanOrEqual(QUALITY_PROFILES.standard.pixelRatioCap);
  });

  it('clampPathTracingSettings 把超限采样钳到当前质量上限', () => {
    // Draft 上限 16/1：设 512 应被钳到 16
    const r = clampPathTracingSettings('draft', 512, 8);
    expect(r.samples).toBe(QUALITY_PROFILES.draft.ptSamplesCap);
    expect(r.bounces).toBe(QUALITY_PROFILES.draft.ptBouncesCap);
  });

  it('clampPathTracingSettings 不放大合法值', () => {
    const r = clampPathTracingSettings('standard', 32, 2);
    expect(r.samples).toBe(32);
    expect(r.bounces).toBe(2);
  });

  it('clampPathTracingSettings 最低保持 1（不允许 0 采样/反弹）', () => {
    const r = clampPathTracingSettings('ultra', 0, 0);
    expect(r.samples).toBeGreaterThanOrEqual(1);
    expect(r.bounces).toBeGreaterThanOrEqual(1);
  });
});
