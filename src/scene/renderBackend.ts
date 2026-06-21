/**
 * T-080 渲染后端抽象与能力检测（src/scene/renderBackend.ts）。
 * 检测 WebGPU 能力（不强制切换），记录到 Message Log；默认 WebGL 主线。
 * 为后续 T-083 path tracing 选后端铺路。
 */
export interface RenderCapabilities {
  webgpu: boolean;
  webgl2: boolean;
  /** WebGPU 适配器信息（若可用）。 */
  adapter?: string;
}

let cached: RenderCapabilities | null = null;

/** 检测当前浏览器的渲染后端能力（结果缓存）。 */
export function detectRenderCapabilities(): RenderCapabilities {
  if (cached) return cached;
  const caps: RenderCapabilities = {
    webgpu: false,
    webgl2: false,
  };
  try {
    const canvas = document.createElement('canvas');
    caps.webgl2 = Boolean(canvas.getContext('webgl2'));
  } catch {
    caps.webgl2 = false;
  }
  // WebGPU 检测（异步 API，这里同步判 navigator.gpu 存在性）
  caps.webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  cached = caps;
  return caps;
}

/** 异步获取 WebGPU 适配器详情（用于日志）。 */
export async function probeWebGpuAdapter(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter ? `WebGPU adapter available` : null;
  } catch {
    return null;
  }
}

/** 当前默认后端标识（v1 固定 webgl2）。 */
export const DEFAULT_BACKEND = 'webgl2' as const;
