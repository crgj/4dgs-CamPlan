import type { CameraDef } from '@/types';
import presetJson from '@/data/cameraPresets.json?raw';

export interface CameraParameterPreset {
  id: string;
  labelZh: string;
  labelEn: string;
  fov: number;
  aspect: number;
  near: number;
  far: number;
  resolution: CameraDef['resolution'];
  exposure: CameraDef['exposure'];
}

function isCameraParameterPreset(value: unknown): value is CameraParameterPreset {
  if (!value || typeof value !== 'object') return false;
  const preset = value as Partial<CameraParameterPreset>;
  return (
    typeof preset.id === 'string' &&
    typeof preset.labelZh === 'string' &&
    typeof preset.labelEn === 'string' &&
    typeof preset.fov === 'number' &&
    typeof preset.aspect === 'number' &&
    typeof preset.near === 'number' &&
    typeof preset.far === 'number' &&
    typeof preset.resolution?.width === 'number' &&
    typeof preset.resolution.height === 'number' &&
    typeof preset.exposure?.iso === 'number' &&
    typeof preset.exposure.shutter === 'number' &&
    typeof preset.exposure.aperture === 'number'
  );
}

// #WDD-gpt  2026-06-21 - 相机参数预设保存在独立 JSON，通过 raw 读取后做运行时校验，避免污染 tsconfig JSON 设置
export const cameraParameterPresets: CameraParameterPreset[] = (() => {
  const parsed: unknown = JSON.parse(presetJson);
  if (!Array.isArray(parsed) || !parsed.every(isCameraParameterPreset)) {
    throw new Error('Invalid camera preset JSON');
  }
  return parsed;
})();

export function cameraParameterPresetPatch(
  preset: CameraParameterPreset,
): Pick<CameraDef, 'fov' | 'aspect' | 'near' | 'far' | 'resolution' | 'exposure'> {
  return {
    fov: preset.fov,
    aspect: preset.aspect,
    near: preset.near,
    far: preset.far,
    resolution: { ...preset.resolution },
    exposure: { ...preset.exposure },
  };
}
