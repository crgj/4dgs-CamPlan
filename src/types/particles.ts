/**
 * T-084 粒子系统类型（src/types/particles.ts）。
 * 参数化粒子预设：烟雾、火焰、火花、尘埃、光晕。
 */
export type ParticlePreset = 'smoke' | 'fire' | 'sparks' | 'dust' | 'glow';

export interface ParticleSystemDef {
  id: string;
  /** 预设类型。 */
  preset: ParticlePreset;
  /** 发射器位置。 */
  position: [number, number, number];
  /** 粒子数量。 */
  count: number;
  /** 粒子初始速度。 */
  speed: number;
  /** 粒子寿命（秒）。 */
  lifetime: number;
  /** 粒子尺寸。 */
  size: number;
  /** 颜色（hex）。 */
  color: number;
  /** 混合模式：加性（发光）或标准（烟雾）。 */
  additive: boolean;
}

/** 预设默认参数。 */
export const PARTICLE_PRESET_DEFAULTS: Record<ParticlePreset, Partial<ParticleSystemDef>> = {
  smoke: { count: 200, speed: 0.3, lifetime: 4, size: 1.2, color: 0x888888, additive: false },
  fire: { count: 300, speed: 0.8, lifetime: 1.5, size: 0.8, color: 0xff6600, additive: true },
  sparks: { count: 150, speed: 2, lifetime: 0.8, size: 0.1, color: 0xffdd88, additive: true },
  dust: { count: 500, speed: 0.1, lifetime: 8, size: 0.05, color: 0xddccaa, additive: false },
  glow: { count: 100, speed: 0.05, lifetime: 3, size: 1.5, color: 0x88aaff, additive: true },
};
