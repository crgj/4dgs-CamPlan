/**
 * T-041 相机阵列向导（src/lib/cameraArray.ts）。
 * 生成 4DGS/摄影测量常用阵列：环形、线性滑轨、半球、网格。
 * 纯函数，可单测；UI 向导调用 buildXxxArray 后逐个 addCamera。
 */
import type { CameraDef } from '@/types';
import { uid } from './id';

const TAU = Math.PI * 2;

export type ArrayPattern = 'ring' | 'linear' | 'hemisphere' | 'grid';

/** 阵列生成参数。 */
export interface ArrayParams {
  pattern: ArrayPattern;
  /** 相机数量。 */
  count: number;
  /** 环形/半球半径（米）。 */
  radius: number;
  /** 相机高度（米，环形用）。 */
  height: number;
  /** 俯仰角（度，环形俯仰）。 */
  pitch: number;
  /** 焦距（mm），写入 focalLength。 */
  focalMm?: number;
  /** 传感器宽（mm）。 */
  sensorWidth?: number;
  /** 基线目标（米，线性滑轨间距）。 */
  baseline?: number;
  /** 起点 XZ（默认环绕原点）。 */
  center?: [number, number];
}

const baseCamera = (i: number, usedIds: Set<string>): Pick<CameraDef, 'id' | 'kind' | 'name' | 'model' | 'fov' | 'aspect' | 'near' | 'far' | 'resolution' | 'exposure' | 'enabled'> => ({
  id: uid('cam', usedIds),
  kind: 'camera' as const,
  name: `Cam_${String(i + 1).padStart(2, '0')}`,
  model: 'PINHOLE' as const,
  fov: 55,
  aspect: 16 / 9,
  near: 0.1,
  far: 100,
  resolution: { width: 1920, height: 1080 },
  exposure: { iso: 200, shutter: 1 / 250, aperture: 4 },
  enabled: true,
});

/** 环形阵列：等角分布、固定俯仰、看向中心。 */
export function buildRingArray(params: ArrayParams, usedIds: Set<string>): CameraDef[] {
  const { count, radius, height, pitch, focalMm, sensorWidth } = params;
  const center = params.center ?? [0, 0];
  const cams: CameraDef[] = [];
  const ids = new Set(usedIds);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    const x = center[0] + Math.cos(angle) * radius;
    const z = center[1] + Math.sin(angle) * radius;
    cams.push({
      ...baseCamera(i, ids),
      transform: {
        position: [x, height, z],
        rotation: [pitch, -(angle * 180) / Math.PI + 180, 0],
        scale: [1, 1, 1],
      },
      focalLength: focalMm,
      sensorWidth: sensorWidth ?? 36,
      sensorHeight: sensorWidth ? sensorWidth * (2 / 3) : 24,
    } as CameraDef);
  }
  return cams;
}

/** 线性滑轨阵列：沿 X 轴等距、平视。 */
export function buildLinearArray(params: ArrayParams, usedIds: Set<string>): CameraDef[] {
  const { count, height, baseline = 0.3 } = params;
  const center = params.center ?? [0, 0];
  const totalSpan = (count - 1) * baseline;
  const cams: CameraDef[] = [];
  const ids = new Set(usedIds);
  for (let i = 0; i < count; i++) {
    const x = center[0] - totalSpan / 2 + i * baseline;
    cams.push({
      ...baseCamera(i, ids),
      transform: {
        position: [x, height, center[1] + 5],
        rotation: [0, 180, 0],
        scale: [1, 1, 1],
      },
      focalLength: params.focalMm,
      sensorWidth: params.sensorWidth ?? 36,
      sensorHeight: params.sensorWidth ? params.sensorWidth * (2 / 3) : 24,
    } as CameraDef);
  }
  return cams;
}

/** 半球阵列：多层环 + 顶点，看向中心。 */
export function buildHemisphereArray(params: ArrayParams, usedIds: Set<string>): CameraDef[] {
  const { count, radius } = params;
  const cams: CameraDef[] = [];
  const ids = new Set(usedIds);
  // 分 3 层（仰角 20°/50°/80°），每层等分
  const elevations = [20, 50, 80];
  const perRing = Math.max(3, Math.floor(count / elevations.length));
  let idx = 0;
  for (const elev of elevations) {
    const elevRad = (elev * Math.PI) / 180;
    const r = radius * Math.cos(elevRad);
    const y = radius * Math.sin(elevRad);
    for (let i = 0; i < perRing; i++) {
      const angle = (i / perRing) * TAU;
      cams.push({
        ...baseCamera(idx++, ids),
        transform: {
          position: [Math.cos(angle) * r, y, Math.sin(angle) * r],
          rotation: [-elev, -(angle * 180) / Math.PI + 180, 0],
          scale: [1, 1, 1],
        },
        focalLength: params.focalMm,
        sensorWidth: params.sensorWidth ?? 36,
        sensorHeight: params.sensorWidth ? params.sensorWidth * (2 / 3) : 24,
      } as CameraDef);
    }
  }
  return cams;
}

/** 统一入口：按 pattern 分发。 */
export function buildCameraArray(params: ArrayParams, usedIds: Set<string>): CameraDef[] {
  switch (params.pattern) {
    case 'ring':
      return buildRingArray(params, usedIds);
    case 'linear':
      return buildLinearArray(params, usedIds);
    case 'hemisphere':
      return buildHemisphereArray(params, usedIds);
    case 'grid':
      // 网格 = 2D 平面阵列（正面拍摄墙/平面主体）
      return buildLinearArray({ ...params, baseline: params.baseline ?? 0.5 }, usedIds);
    default:
      return [];
  }
}
