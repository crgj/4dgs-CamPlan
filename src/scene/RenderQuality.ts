/**
 * T-088 渲染质量预设与性能分级（src/scene/RenderQuality.ts）。
 *
 * 纯逻辑：把抽象质量等级 (draft/standard/high/ultra) 映射为可观测的渲染参数：
 *   - Canvas device pixel ratio（影响光栅化采样锐度与 GPU 负载）
 *   - 阴影贴图分辨率（软阴影质量；0 = 关阴影）
 *   - 是否启用后处理（PostFXStack）
 *   - 是否启用 SMAA/MSAA（抗锯齿）
 *   - Path Tracing 默认采样/反弹上限（高质量放宽，草稿压低）
 *
 * 之所以独立成纯函数模块：可在不依赖浏览器/Canvas 的情况下单测各等级阈值，
 * 并让 Preferences/UI 与 Scene 共享同一份真值表，避免散落魔法数字。
 *
 * 设计约定：
 *   - Draft 模式目标是“可交互的低保真”：关阴影、关后处理、低 DPR，保证低端设备与
 *     大场景拖拽时仍 ≥60fps；这也是 PostFXStack 的早退条件来源。
 *   - Ultra 模式面向“最终出图”：高 DPR、高分辨率阴影、允许 PT 高采样。
 *   - 自适应降级由消费方（Scene）结合 detectRenderCapabilities() 与设备 DPR 决定，
 *     本模块只提供“目标”而非“最终值”。
 */
export type RenderQuality = 'draft' | 'standard' | 'high' | 'ultra';

/** 单一质量等级对应的渲染参数“目标值”。 */
export interface QualityProfile {
  /** Canvas device pixel ratio 上限（实际取 min(设备 DPR, 此值)）。 */
  pixelRatioCap: number;
  /** 阴影贴图边长（像素）；0 = 不开阴影。 */
  shadowMapSize: number;
  /** 是否允许后处理（Bloom/SSAO/ToneMapping）。 */
  postFX: boolean;
  /** 是否允许 MSAA 采样数（0 = 关）。 */
  multisampling: number;
  /** Path Tracing 默认采样数上限。 */
  ptSamplesCap: number;
  /** Path Tracing 默认光線反弹数。 */
  ptBouncesCap: number;
}

/** 质量等级 → 参数真值表。集中维护，避免魔法数字散落各组件。 */
export const QUALITY_PROFILES: Record<RenderQuality, QualityProfile> = {
  draft: {
    pixelRatioCap: 1,
    shadowMapSize: 0,
    postFX: false,
    multisampling: 0,
    ptSamplesCap: 16,
    ptBouncesCap: 1,
  },
  standard: {
    pixelRatioCap: 1.5,
    shadowMapSize: 1024,
    postFX: true,
    multisampling: 0,
    ptSamplesCap: 64,
    ptBouncesCap: 3,
  },
  high: {
    pixelRatioCap: 2,
    shadowMapSize: 2048,
    postFX: true,
    multisampling: 2,
    ptSamplesCap: 256,
    ptBouncesCap: 5,
  },
  ultra: {
    pixelRatioCap: 2,
    shadowMapSize: 4096,
    postFX: true,
    multisampling: 4,
    ptSamplesCap: 512,
    ptBouncesCap: 8,
  },
};

/**
 * 计算当前应施加到 Canvas 的实际 device pixel ratio。
 * 取设备原生 DPR（如 Retina=2）与质量上限的较小值，保证不超采样。
 * 在 SSR/无 window 环境降级返回 cap，避免崩溃。
 */
export function resolvePixelRatio(quality: RenderQuality): number {
  const cap = QUALITY_PROFILES[quality].pixelRatioCap;
  if (typeof window === 'undefined' || !window.devicePixelRatio) return cap;
  return Math.min(window.devicePixelRatio, cap);
}

/**
 * 把用户设定的 PT samples/bounces 钳到当前质量等级允许的上限。
 * 防止 Draft 模式被误设成 Ultra 的采样数导致卡死。
 */
export function clampPathTracingSettings(
  quality: RenderQuality,
  samples: number,
  bounces: number,
): { samples: number; bounces: number } {
  const p = QUALITY_PROFILES[quality];
  return {
    samples: Math.max(1, Math.min(samples, p.ptSamplesCap)),
    bounces: Math.max(1, Math.min(bounces, p.ptBouncesCap)),
  };
}

/** 便捷判定：该质量等级是否应启用阴影（与 Profile.shadowMapSize>0 等价）。 */
export function qualityHasShadows(quality: RenderQuality): boolean {
  return QUALITY_PROFILES[quality].shadowMapSize > 0;
}
