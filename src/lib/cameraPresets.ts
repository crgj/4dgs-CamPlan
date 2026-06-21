/**
 * T-040 真实相机/镜头预设库（src/lib/cameraPresets.ts）。
 * 常见 4DGS/摄影测量设备的传感器尺寸与镜头规格，供阵列向导与清单生成引用。
 * 数据来源：各厂商公开规格（全画幅 36×24、APS-C、M4/3、专业电影机等）。
 */
export interface CameraPreset {
  id: string;
  /** 显示名。 */
  name: string;
  /** 传感器宽（mm）。 */
  sensorWidth: number;
  /** 传感器高（mm）。 */
  sensorHeight: number;
  /** 推荐焦距范围（mm）。 */
  focalRange: [number, number];
  /** 原生 ISO 范围。 */
  isoRange: [number, number];
  /** 典型用途。 */
  useCase: 'photoscan' | '4dgs' | 'cinema' | 'drone';
}

export const CAMERA_PRESETS: CameraPreset[] = [
  {
    id: 'ff_a7r5',
    name: 'Sony A7R V (Full Frame)',
    sensorWidth: 35.7,
    sensorHeight: 23.8,
    focalRange: [24, 85],
    isoRange: [100, 3200],
    useCase: 'photoscan',
  },
  {
    id: 'ff_r5',
    name: 'Canon EOS R5 (Full Frame)',
    sensorWidth: 36,
    sensorHeight: 24,
    focalRange: [24, 70],
    isoRange: [100, 3200],
    useCase: '4dgs',
  },
  {
    id: 'apsc_a6700',
    name: 'Sony A6700 (APS-C)',
    sensorWidth: 23.3,
    sensorHeight: 15.5,
    focalRange: [16, 50],
    isoRange: [100, 3200],
    useCase: 'photoscan',
  },
  {
    id: 'm43_gh6',
    name: 'Panasonic GH6 (M4/3)',
    sensorWidth: 17.3,
    sensorHeight: 13,
    focalRange: [12, 35],
    isoRange: [100, 1600],
    useCase: '4dgs',
  },
  {
    id: 'cine_fx6',
    name: 'Sony FX6 (Cinema)',
    sensorWidth: 35.6,
    sensorHeight: 19.9,
    focalRange: [24, 70],
    isoRange: [800, 12800],
    useCase: 'cinema',
  },
  {
    id: 'drone_mavic3',
    name: 'DJI Mavic 3 (Drone)',
    sensorWidth: 17.3,
    sensorHeight: 13,
    focalRange: [6.7, 24],
    isoRange: [100, 1600],
    useCase: 'drone',
  },
];

/** 按 id 查预设。 */
export function findPreset(id: string): CameraPreset | undefined {
  return CAMERA_PRESETS.find((p) => p.id === id);
}

/**
 * T-040 焦距 → 水平 FOV（度）换算。
 * FOV = 2 * atan(sensorWidth / (2 * focal))
 */
export function focalToFov(focalMm: number, sensorWidthMm: number): number {
  return (2 * Math.atan(sensorWidthMm / (2 * focalMm)) * 180) / Math.PI;
}

/**
 * T-040 水平 FOV → 焦距（mm）换算。
 */
export function fovToFocal(fovDeg: number, sensorWidthMm: number): number {
  return sensorWidthMm / (2 * Math.tan((fovDeg * Math.PI) / 180 / 2));
}

/**
 * T-040 地面采样距离（GSD，米/像素）。
 * GSD = (distance * sensorWidth) / (focalLength * imageWidth)
 */
export function groundSampleDistance(
  distanceM: number,
  sensorWidthMm: number,
  focalMm: number,
  imageWidthPx: number,
): number {
  return (distanceM * sensorWidthMm) / (focalMm * imageWidthPx);
}
